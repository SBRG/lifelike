import bisect
import itertools
import time

from collections import defaultdict
from typing import Dict, List, Set, Tuple

from flask import current_app

from neo4japp.constants import LogEventType
from neo4japp.utils.logger import EventLog

from .annotation_service import AnnotationService
from .annotation_db_service import AnnotationDBService
from .annotation_graph_service import AnnotationGraphService
from .constants import EntityIdStr, EntityType
from .data_transfer_objects import (
    Annotation,
    CreateAnnotationObjParams,
    RecognizedEntities,
    LMDBMatch,
    SpecifiedOrganismStrain
)


class EnrichmentAnnotationService(AnnotationService):
    def __init__(
        self,
        db: AnnotationDBService,
        graph: AnnotationGraphService,
    ) -> None:
        super().__init__(db=db, graph=graph)

    def _annotate_type_gene(
        self,
        recognized_entities: RecognizedEntities
    ) -> List[Annotation]:
        matches_list: List[LMDBMatch] = recognized_entities.recognized_genes

        entities_to_create: List[CreateAnnotationObjParams] = []

        entity_token_pairs = []
        gene_names: Set[str] = set()
        for match in matches_list:
            entities_set = set()
            for entity in match.entities:
                gene_names.add(entity['synonym'])
                entities_set.add((entity['synonym'], entity['id_type'], entity.get('hyperlinks', '')))  # noqa
            for synonym, datasource, hyperlinks in entities_set:
                if hyperlinks == '':
                    hyperlinks = []
                entity_token_pairs.append((synonym, datasource, hyperlinks, match.token))

        gene_names_list = list(gene_names)

        gene_match_time = time.time()
        fallback_graph_results = \
            self.graph.get_genes_to_organisms(
                genes=gene_names_list,
                organisms=[self.specified_organism.organism_id],
            )
        current_app.logger.info(
            f'Gene fallback organism KG query time {time.time() - gene_match_time}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )
        fallback_gene_organism_matches = fallback_graph_results.matches
        gene_data_sources = fallback_graph_results.data_sources
        gene_primary_names = fallback_graph_results.primary_names

        for entity_synonym, entity_datasource, entity_hyperlinks, token in entity_token_pairs:
            gene_id = None
            category = None
            organism_id = self.specified_organism.organism_id

            organisms_to_match: Dict[str, str] = {}
            if entity_synonym in fallback_gene_organism_matches:
                try:
                    # prioritize common name match over synonym
                    organisms_to_match = fallback_gene_organism_matches[entity_synonym][entity_synonym]  # noqa
                except KeyError:
                    # an organism can have multiple different genes w/ same synonym
                    # since we don't know which to use, doing this is fine
                    for d in list(fallback_gene_organism_matches[entity_synonym].values()):
                        organisms_to_match = {**organisms_to_match, **d}
                try:
                    gene_id = organisms_to_match[self.specified_organism.organism_id]  # noqa
                    category = self.specified_organism.category
                except KeyError:
                    continue
                else:
                    if entity_datasource != gene_data_sources[f'{entity_synonym}{organism_id}']:  # noqa
                        continue
                    entities_to_create.append(
                        CreateAnnotationObjParams(
                            token=token,
                            token_type=EntityType.GENE.value,
                            entity_synonym=entity_synonym,
                            entity_name=gene_primary_names[gene_id],
                            entity_id=gene_id,
                            entity_datasource=entity_datasource,
                            entity_hyperlinks=entity_hyperlinks,
                            entity_category=category
                        )
                    )
        return self._create_annotation_object(entities_to_create)

    def _annotate_type_protein(
        self,
        recognized_entities: RecognizedEntities
    ) -> List[Annotation]:
        matches_list: List[LMDBMatch] = recognized_entities.recognized_proteins

        entities_to_create: List[CreateAnnotationObjParams] = []

        entity_token_pairs = []
        protein_names: Set[str] = set()
        for match in matches_list:
            entities_set = set()
            for entity in match.entities:
                protein_names.add(entity['synonym'])
                entities_set.add((entity['synonym'], entity.get('category', ''), entity['id_type'], entity.get('hyperlinks', '')))  # noqa
            for synonym, datasource, category, hyperlinks in entities_set:
                if hyperlinks == '':
                    hyperlinks = []
                entity_token_pairs.append((synonym, datasource, category, hyperlinks, match.token))

        protein_names_list = list(protein_names)

        protein_match_time = time.time()
        fallback_graph_results = \
            self.graph.get_proteins_to_organisms(
                proteins=protein_names_list,
                organisms=[self.specified_organism.organism_id],
            )
        current_app.logger.info(
            f'Protein fallback organism KG query time {time.time() - protein_match_time}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )
        fallback_protein_organism_matches = fallback_graph_results.matches
        protein_primary_names = fallback_graph_results.primary_names

        for entity_synonym, category, entity_datasource, entity_hyperlinks, token in entity_token_pairs:  # noqa
            # in LMDB we use the synonym as id and name, so do the same here
            protein_id = entity_synonym
            if entity_synonym in fallback_protein_organism_matches:
                try:
                    protein_id = fallback_protein_organism_matches[entity_synonym][self.specified_organism.organism_id]  # noqa
                    category = self.specified_organism.category
                except KeyError:
                    continue

            entities_to_create.append(
                CreateAnnotationObjParams(
                    token=token,
                    token_type=EntityType.PROTEIN.value,
                    entity_id=protein_id,
                    entity_synonym=entity_synonym,
                    entity_name=protein_primary_names.get(protein_id, entity_synonym),
                    entity_datasource=entity_datasource,
                    entity_hyperlinks=entity_hyperlinks,
                    entity_category=category
                )
            )
        return self._create_annotation_object(entities_to_create)

    def create_annotations(
        self,
        custom_annotations: List[dict],
        entity_results: RecognizedEntities,
        entity_type_and_id_pairs: List[Tuple[str, str]],
        specified_organism: SpecifiedOrganismStrain,
        **kwargs
    ) -> List[Annotation]:
        self.specified_organism = specified_organism
        self.enrichment_mappings = kwargs['enrichment_mappings']

        annotations = self._create_annotations(
            types_to_annotate=entity_type_and_id_pairs,
            custom_annotations=custom_annotations,
            recognized_entities=entity_results
        )

        start = time.time()
        cleaned = self._clean_annotations(annotations=annotations)

        current_app.logger.info(
            f'Time to clean and run annotation interval tree {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )
        return cleaned

    def _clean_annotations(
        self,
        annotations: List[Annotation]
    ) -> List[Annotation]:
        fixed_unified_annotations = self._get_fixed_false_positive_unified_annotations(
            annotations_list=annotations)

        # need to split up the annotations otherwise
        # a text in a cell could be removed due to
        # overlapping with an adjacent cell
        split = defaultdict(list)
        offsets = [i for i, _ in self.enrichment_mappings]
        for anno in fixed_unified_annotations:
            # get first offset that is greater than hi_location_offset
            # this means the annotation is part of that cell/sublist
            index = bisect.bisect_left(offsets, anno.hi_location_offset)
            split[offsets[index]].append(anno)

        fixed_unified_annotations = list(itertools.chain.from_iterable(
            [self.fix_conflicting_annotations(unified_annotations=v) for _, v in split.items()]
        ))
        return fixed_unified_annotations
