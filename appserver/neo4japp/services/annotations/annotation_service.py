import json
import time

from bisect import bisect_left
from math import inf, isinf
from typing import cast, Dict, List, Set, Tuple
from urllib.parse import quote as uri_encode
from uuid import uuid4

from flask import current_app

from .annotation_db_service import AnnotationDBService
from .annotation_graph_service import AnnotationGraphService
from .annotation_interval_tree import AnnotationInterval, AnnotationIntervalTree
from .constants import (
    DatabaseType,
    EntityIdStr,
    EntityType,
    OrganismCategory,
    ENTITY_HYPERLINKS,
    ENTITY_TYPE_PRECEDENCE,
    HOMO_SAPIENS_TAX_ID,
    ORGANISM_DISTANCE_THRESHOLD,
    SEARCH_LINKS,
)
from .data_transfer_objects import (
    Annotation,
    BestOrganismMatch,
    CreateAnnotationObjParams,
    RecognizedEntities,
    GeneAnnotation,
    LMDBMatch,
    OrganismAnnotation,
    PDFWord,
    SpecifiedOrganismStrain
)
from .utils.common import has_center_point

from neo4japp.constants import LogEventType
from neo4japp.exceptions import AnnotationError
from neo4japp.util import normalize_str
from neo4japp.utils.logger import EventLog


class AnnotationService:
    def __init__(
        self,
        db: AnnotationDBService,
        graph: AnnotationGraphService,
    ) -> None:
        self.db = db
        self.graph = graph

        self.organism_frequency: Dict[str, int] = {}
        self.organism_locations: Dict[str, List[Tuple[int, int]]] = {}
        self.organism_categories: Dict[str, str] = {}

    def get_entities_to_annotate(
        self,
        anatomy: bool = True,
        chemical: bool = True,
        compound: bool = True,
        disease: bool = True,
        food: bool = True,
        gene: bool = True,
        phenomena: bool = True,
        phenotype: bool = True,
        protein: bool = True,
        species: bool = True,
        company: bool = True,
        entity: bool = True,
        lab_sample: bool = True,
        lab_strain: bool = True
    ) -> List[Tuple[str, str]]:
        entity_type_and_id_pairs: List[Tuple[str, str]] = []

        if anatomy:
            entity_type_and_id_pairs.append(
                (EntityType.ANATOMY.value, EntityIdStr.ANATOMY.value))

        if chemical:
            entity_type_and_id_pairs.append(
                (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value))

        if compound:
            entity_type_and_id_pairs.append(
                (EntityType.COMPOUND.value, EntityIdStr.COMPOUND.value))

        if disease:
            entity_type_and_id_pairs.append(
                (EntityType.DISEASE.value, EntityIdStr.DISEASE.value))

        if food:
            entity_type_and_id_pairs.append(
                (EntityType.FOOD.value, EntityIdStr.FOOD.value))

        if phenomena:
            entity_type_and_id_pairs.append(
                (EntityType.PHENOMENA.value, EntityIdStr.PHENOMENA.value))

        if phenotype:
            entity_type_and_id_pairs.append(
                (EntityType.PHENOTYPE.value, EntityIdStr.PHENOTYPE.value))

        if species:
            # Order is IMPORTANT here
            # Species should always be annotated before Genes and Proteins
            entity_type_and_id_pairs.append(
                (EntityType.SPECIES.value, EntityIdStr.SPECIES.value))

        if protein:
            entity_type_and_id_pairs.append(
                (EntityType.PROTEIN.value, EntityIdStr.PROTEIN.value))

        if gene:
            entity_type_and_id_pairs.append(
                (EntityType.GENE.value, EntityIdStr.GENE.value))

        if company:
            entity_type_and_id_pairs.append(
                (EntityType.COMPANY.value, EntityIdStr.COMPANY.value))

        if entity:
            entity_type_and_id_pairs.append(
                (EntityType.ENTITY.value, EntityIdStr.ENTITY.value))

        if lab_sample:
            entity_type_and_id_pairs.append(
                (EntityType.LAB_SAMPLE.value, EntityIdStr.LAB_SAMPLE.value))

        if lab_strain:
            entity_type_and_id_pairs.append(
                (EntityType.LAB_STRAIN.value, EntityIdStr.LAB_STRAIN.value))

        return entity_type_and_id_pairs

    def _create_annotation_object(
        self,
        params: List[CreateAnnotationObjParams]
    ) -> List[Annotation]:
        created_annotations: List[Annotation] = []

        for param in params:
            keyword_starting_idx = param.token.lo_location_offset
            keyword_ending_idx = param.token.hi_location_offset
            link_search_term = param.token.keyword
            hyperlinks = []

            # global inclusions will have id_hyperlinks property
            if not param.entity_hyperlinks:
                if 'NULL' not in param.entity_id and param.entity_datasource:
                    try:
                        if param.entity_datasource == DatabaseType.BIOCYC.value:
                            hyperlink = cast(dict, ENTITY_HYPERLINKS[param.entity_datasource])[param.token_type]  # noqa
                        else:
                            hyperlink = cast(str, ENTITY_HYPERLINKS[param.entity_datasource])
                    except KeyError:
                        raise

                    if param.entity_datasource == DatabaseType.MESH.value and DatabaseType.MESH.value.upper() in param.entity_id:  # noqa
                        hyperlink += uri_encode(param.entity_id[5:])
                    else:
                        hyperlink += uri_encode(param.entity_id)

                    hyperlinks.append(json.dumps(
                        {'label': param.entity_datasource, 'url': hyperlink}))
            else:
                hyperlinks = param.entity_hyperlinks

            id_type = param.entity_datasource or ''
            synonym = param.entity_synonym
            primary_name = param.entity_name
            keyword_length = keyword_ending_idx - keyword_starting_idx + 1

            if param.token_type == EntityType.SPECIES.value:
                organism_meta = OrganismAnnotation.OrganismMeta(
                    category=param.entity_category,
                    type=param.token_type,
                    id=param.entity_id,
                    id_type=id_type,
                    id_hyperlinks=hyperlinks,
                    links=OrganismAnnotation.OrganismMeta.Links(
                        **{domain: url + link_search_term for domain, url in SEARCH_LINKS.items()}
                    ),
                    all_text=synonym,
                )
                # the `keywords` property here is to allow us to know
                # what coordinates map to what text in the PDF
                # we want to actually use the real name inside LMDB
                # for the `keyword` property
                created_annotations.append(
                    OrganismAnnotation(
                        page_number=param.token.page_number,
                        rects=param.token.coordinates,
                        keywords=[param.token.keyword],
                        keyword=synonym,
                        primary_name=primary_name,
                        text_in_document=param.token.keyword,
                        keyword_length=keyword_length,
                        lo_location_offset=keyword_starting_idx,
                        hi_location_offset=keyword_ending_idx,
                        meta=organism_meta,
                        uuid=str(uuid4())
                    )
                )
            elif param.token_type == EntityType.GENE.value:
                gene_meta = GeneAnnotation.GeneMeta(
                    category=param.entity_category,
                    type=param.token_type,
                    id=param.entity_id,
                    id_type=id_type,
                    id_hyperlinks=hyperlinks,
                    links=GeneAnnotation.GeneMeta.Links(
                        **{domain: url + link_search_term for domain, url in SEARCH_LINKS.items()}
                    ),
                    all_text=synonym,
                )
                created_annotations.append(
                    GeneAnnotation(
                        page_number=param.token.page_number,
                        rects=param.token.coordinates,
                        keywords=[param.token.keyword],
                        keyword=synonym,
                        primary_name=primary_name,
                        text_in_document=param.token.keyword,
                        keyword_length=keyword_length,
                        lo_location_offset=keyword_starting_idx,
                        hi_location_offset=keyword_ending_idx,
                        meta=gene_meta,
                        uuid=str(uuid4())
                    )
                )
            else:
                meta = Annotation.Meta(
                    type=param.token_type,
                    id=param.entity_id,
                    id_type=id_type,
                    id_hyperlinks=hyperlinks,
                    links=Annotation.Meta.Links(
                        **{domain: url + link_search_term for domain, url in SEARCH_LINKS.items()}
                    ),
                    all_text=synonym,
                )
                created_annotations.append(
                    Annotation(
                        page_number=param.token.page_number,
                        rects=param.token.coordinates,
                        keywords=[param.token.keyword],
                        keyword=synonym,
                        primary_name=primary_name,
                        text_in_document=param.token.keyword,
                        keyword_length=keyword_length,
                        lo_location_offset=keyword_starting_idx,
                        hi_location_offset=keyword_ending_idx,
                        meta=meta,
                        uuid=str(uuid4())
                    )
                )
        return created_annotations

    def _get_annotation(
        self,
        matches_list: List[LMDBMatch],
        token_type: str,
        id_str: str,
    ) -> List[Annotation]:
        tokens_lowercased = set(match.token.normalized_keyword for match in matches_list)  # noqa
        synonym_common_names_dict: Dict[str, Set[str]] = {}

        entities_to_create: List[CreateAnnotationObjParams] = []

        for match in matches_list:
            for entity in match.entities:
                entity_synonym = entity['synonym']
                entity_common_name = entity['name']
                if entity_synonym in synonym_common_names_dict:
                    synonym_common_names_dict[entity_synonym].add(normalize_str(entity_common_name))  # noqa
                else:
                    synonym_common_names_dict[entity_synonym] = {normalize_str(entity_common_name)}  # noqa

            for entity in match.entities:
                entity_synonym = entity['synonym']
                common_names_referenced_by_synonym = synonym_common_names_dict[entity_synonym]
                if len(common_names_referenced_by_synonym) > 1:
                    # synonym used by multiple different common names
                    #
                    # for synonyms that are used by more than one common names
                    # if none of those common names appear in the document
                    # or if more than one of those common names appear in the document
                    # do not annotate because cannot infer
                    common_names_in_document = [n for n in common_names_referenced_by_synonym if n in tokens_lowercased]  # noqa

                    if len(common_names_in_document) != 1:
                        continue

                try:
                    entities_to_create.append(
                        CreateAnnotationObjParams(
                            token=match.token,
                            token_type=token_type,
                            entity_synonym=entity['synonym'],
                            entity_name=entity['name'],
                            entity_id=entity[id_str],
                            entity_datasource=entity['id_type'],
                            entity_hyperlinks=entity.get('id_hyperlinks', []),
                            entity_category=entity.get('category', '')
                        )
                    )
                except KeyError:
                    continue
        return self._create_annotation_object(entities_to_create)

    def _get_closest_entity_organism_pair(
        self,
        entity: PDFWord,
        organism_matches: Dict[str, str],
        above_only: bool = False
    ) -> Tuple[str, str, float]:
        """An entity name may match multiple organisms. To choose which organism to use,
        we first check for the closest one in the document. If two organisms are
        equal in distance, we choose the one that appears more frequently in the document.

        If the two organisms are both equidistant and equally frequent,
        we always prefer homo sapiens if it is either of the two entity.
        Otherwise, we choose the one we matched first.
        """
        entity_location_lo = entity.lo_location_offset
        entity_location_hi = entity.hi_location_offset

        closest_dist = inf
        curr_closest_organism = None

        for organism in organism_matches:
            if curr_closest_organism is None:
                curr_closest_organism = organism

            min_organism_dist = inf
            new_organism_dist = inf

            if organism not in self.organism_locations:
                current_app.logger.error(
                    f'Organism ID {organism} does not exist in {self.organism_locations}.',
                    extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
                )
                continue

            positions_to_check = self.organism_locations[organism]
            if above_only:
                cut_idx = bisect_left(positions_to_check, (entity_location_lo, entity_location_hi))
                positions_to_check = positions_to_check[:cut_idx]

            # Get the closest instance of this organism
            for organism_pos in positions_to_check:
                organism_location_lo = organism_pos[0]
                organism_location_hi = organism_pos[1]

                if entity_location_lo > organism_location_hi:
                    # organism is before entity
                    new_organism_dist = entity_location_lo - organism_location_hi
                else:
                    new_organism_dist = organism_location_lo - entity_location_hi

                if new_organism_dist < min_organism_dist:
                    min_organism_dist = new_organism_dist

            # If this organism is closer than the current closest, update
            if min_organism_dist < closest_dist:
                curr_closest_organism = organism
                closest_dist = min_organism_dist
            # If this organism is equidistant to the current closest, check frequency instead
            elif min_organism_dist == closest_dist:
                try:
                    # If the frequency of this organism is greater, update
                    if self.organism_frequency[organism] > self.organism_frequency[curr_closest_organism]:  # noqa
                        curr_closest_organism = organism
                    elif self.organism_frequency[organism] == self.organism_frequency[curr_closest_organism]:  # noqa
                        # If the organisms are equidistant and equal frequency,
                        # check if the new organism is human, and if so update
                        if organism == HOMO_SAPIENS_TAX_ID:
                            curr_closest_organism = organism
                except KeyError:
                    curr_closest_organism = organism

        if curr_closest_organism is None:
            raise AnnotationError(
                title='Unable to Annotate',
                message='Cannot get gene ID with no organisms.')

        # Return the gene id of the organism with the highest priority
        return organism_matches[curr_closest_organism], curr_closest_organism, closest_dist

    def _find_best_organism_match(
        self,
        token,
        entity_synonym,
        organisms_to_match,
        fallback_organism_matches,
        entity_type
    ) -> BestOrganismMatch:
        """Finds the best entity/organism pair.

        First we start out by trying to find the closest organism (before/after)
        to pair with entity. If that organism distance is greater than threshold,
        try to use the fallback organism if given.

        If no fallback organism was given (or one didn't match), and distance is
        greater than threshold, try to find the closest organism before entity.
        If none found, then use the most frequent organism in document if it is in the
        matched dict, otherwise do not annotate.
        """
        entity_id, organism_id, closest_distance = self._get_closest_entity_organism_pair(
            entity=token,
            organism_matches=organisms_to_match
        )

        specified_organism_id = None
        if closest_distance > ORGANISM_DISTANCE_THRESHOLD:
            has_fallback_match = fallback_organism_matches.get(entity_synonym, False)  # noqa
            find_organism_above = True

            if self.specified_organism.synonym and has_fallback_match:
                fallback_organisms_to_match: Dict[str, str] = {}

                if entity_type == EntityType.PROTEIN.value:
                    try:
                        fallback_organisms_to_match = fallback_organism_matches[entity_synonym]
                    except KeyError:
                        # pass here to let it be handled below
                        pass
                else:
                    # for genes
                    try:
                        # prioritize common name that is same as synonym
                        fallback_organisms_to_match = fallback_organism_matches[entity_synonym][entity_synonym]  # noqa
                    except KeyError:
                        # an organism can have multiple different genes w/ same synonym
                        # since we don't know which to use, doing this is fine
                        for d in list(fallback_organism_matches[entity_synonym].values()):
                            fallback_organisms_to_match = {**fallback_organisms_to_match, **d}

                # if matched in KG then set to fallback strain
                if fallback_organisms_to_match.get(self.specified_organism.organism_id, None):  # noqa
                    entity_id = fallback_organisms_to_match[self.specified_organism.organism_id]  # noqa
                    specified_organism_id = self.specified_organism.organism_id
                    find_organism_above = False

            if find_organism_above:
                # try to get organism above
                entity_id, organism_id, closest_distance = self._get_closest_entity_organism_pair(  # noqa
                    entity=token,
                    organism_matches=organisms_to_match,
                    above_only=True
                )
                # if distance is inf, then it means we didn't find an organism above
                if isinf(closest_distance):
                    # try to use the most frequent organism
                    most_frequent = max(self.organism_frequency.keys(), key=(lambda k: self.organism_frequency[k]))  # noqa
                    if most_frequent in organisms_to_match:
                        entity_id, organism_id, closest_distance = self._get_closest_entity_organism_pair(  # noqa
                            entity=token,
                            organism_matches={most_frequent: organisms_to_match[most_frequent]}
                        )
        return BestOrganismMatch(
            entity_id=entity_id,
            organism_id=organism_id,
            closest_distance=closest_distance,
            specified_organism_id=specified_organism_id)

    def _annotate_type_gene(
        self,
        recognized_entities: RecognizedEntities
    ) -> List[Annotation]:
        """Gene specific annotation. Nearly identical to `_get_annotation`,
        except that we check genes against the matched organisms found in the
        document.

        It is likely that the annotator will detect keywords that resemble gene
        names, but are not genes in the context of the document.

        It is also possible that two organisms discussed in the document each have a
        gene with the same name. In this case we need a way to distinguish between the
        two.

        To resolve both of the above issues we check the graph database for
        relationships between genes/organisms, and handle each of the following cases:
            1. Exactly one organism match for a given gene
            2. More than one organism match for a given gene
            3. No organism matches for a given gene

        Returns list of matched annotations
        """
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
        organism_ids = list(self.organism_frequency)

        gene_match_time = time.time()
        graph_results = self.graph.get_genes_to_organisms(
            genes=gene_names_list,
            organisms=organism_ids,
        )
        current_app.logger.info(
            f'Gene organism KG query time {time.time() - gene_match_time}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )

        gene_organism_matches = graph_results.matches
        gene_data_sources = graph_results.data_sources
        gene_primary_names = graph_results.primary_names

        # any genes not matched in KG fall back to specified organism
        fallback_gene_organism_matches = {}

        if self.specified_organism.synonym:
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
            gene_data_sources.update(fallback_graph_results.data_sources)
            gene_primary_names.update(fallback_graph_results.primary_names)

        for entity_synonym, entity_datasource, entity_hyperlinks, token in entity_token_pairs:
            gene_id = None
            category = None

            organisms_to_match: Dict[str, str] = {}
            if entity_synonym in gene_organism_matches:
                try:
                    # prioritize common name that is same as synonym
                    organisms_to_match = gene_organism_matches[entity_synonym][entity_synonym]
                except KeyError:
                    # an organism can have multiple different genes w/ same synonym
                    # since we don't know which to use, doing this is fine
                    for d in list(gene_organism_matches[entity_synonym].values()):
                        organisms_to_match = {**organisms_to_match, **d}

                best_match = self._find_best_organism_match(
                    token=token,
                    entity_synonym=entity_synonym,
                    organisms_to_match=organisms_to_match,
                    fallback_organism_matches=fallback_gene_organism_matches,
                    entity_type=EntityType.GENE.value)

                if isinf(best_match.closest_distance):
                    # didn't find a suitable organism in organisms_to_match
                    continue

                gene_id = best_match.entity_id
                organism_id = best_match.organism_id
                specified_organism_id = best_match.specified_organism_id
                category = self.specified_organism.category if specified_organism_id else self.organism_categories[organism_id]  # noqa
            elif entity_synonym in fallback_gene_organism_matches:
                organism_id = self.specified_organism.organism_id
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

            if gene_id and category:
                if entity_datasource != gene_data_sources[f'{entity_synonym}{organism_id}']:
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
        """Nearly identical to `self._annotate_type_gene`. Return a list of
        protein annotations with the correct protein_id. If the protein
        was not matched in the knowledge graph, then keep the original
        protein_id.
        """
        matches_list: List[LMDBMatch] = recognized_entities.recognized_proteins

        entities_to_create: List[CreateAnnotationObjParams] = []

        entity_token_pairs = []
        protein_names: Set[str] = set()
        for match in matches_list:
            entities_set = set()
            for entity in match.entities:
                protein_names.add(entity['synonym'])
                entities_set.add((entity['synonym'], entity.get('category', ''), entity['id_type'], entity.get('hyperlinks', '')))  # noqa
            for synonym, category, datasource, hyperlinks in entities_set:
                if hyperlinks == '':
                    hyperlinks = []
                entity_token_pairs.append((synonym, category, datasource, hyperlinks, match.token))

        protein_names_list = list(protein_names)

        protein_match_time = time.time()
        graph_results = self.graph.get_proteins_to_organisms(
            proteins=protein_names_list,
            organisms=list(self.organism_frequency),
        )
        current_app.logger.info(
            f'Protein organism KG query time {time.time() - protein_match_time}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )

        protein_organism_matches = graph_results.matches
        protein_primary_names = graph_results.primary_names
        # any proteins not matched in KG fall back to specified organism
        fallback_protein_organism_matches = {}

        if self.specified_organism.synonym:
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
            protein_primary_names.update(fallback_graph_results.primary_names)

        for entity_synonym, category, entity_datasource, entity_hyperlinks, token in entity_token_pairs:  # noqa
            # in LMDB we use the synonym as id and name, so do the same here
            protein_id = entity_synonym

            if entity_synonym in protein_organism_matches:
                best_match = self._find_best_organism_match(
                    token=token,
                    entity_synonym=entity_synonym,
                    organisms_to_match=protein_organism_matches[entity_synonym],
                    fallback_organism_matches=fallback_protein_organism_matches,
                    entity_type=EntityType.PROTEIN.value)

                if isinf(best_match.closest_distance):
                    # didn't find a suitable organism in organisms_to_match
                    continue

                protein_id = best_match.entity_id
                organism_id = best_match.organism_id
                specified_organism_id = best_match.specified_organism_id
                category = self.specified_organism.category if specified_organism_id else self.organism_categories[organism_id]  # noqa
            elif entity_synonym in fallback_protein_organism_matches:
                try:
                    protein_id = fallback_protein_organism_matches[entity_synonym][self.specified_organism.organism_id]  # noqa
                    category = self.specified_organism.category
                except KeyError:
                    continue

            entities_to_create.append(
                CreateAnnotationObjParams(
                    token=token,
                    token_type=EntityType.PROTEIN.value,
                    entity_synonym=entity_synonym,
                    entity_name=protein_primary_names.get(protein_id, entity_synonym),
                    entity_id=protein_id,
                    entity_datasource=entity_datasource,
                    entity_hyperlinks=entity_hyperlinks,
                    entity_category=category
                )
            )
        return self._create_annotation_object(entities_to_create)

    def _annotate_local_species(
        self,
        recognized_entities: RecognizedEntities
    ) -> List[Annotation]:
        """Similar to self._get_annotation() but for creating
        annotations of custom species.
        However, does not check if a synonym is used by multiple
        common names that all appear in the document, as assume
        user wants these custom species annotations to be
        annotated.
        """
        matches = recognized_entities.recognized_local_species

        entities_to_create: List[CreateAnnotationObjParams] = []

        for match in matches:
            for entity in match.entities:
                try:
                    entities_to_create.append(
                        CreateAnnotationObjParams(
                            token=match.token,
                            token_type=EntityType.SPECIES.value,
                            entity_name=entity['name'],
                            entity_synonym=entity['synonym'],
                            entity_id=entity[EntityIdStr.SPECIES.value],
                            entity_datasource=entity['id_type'],
                            entity_hyperlinks=entity.get('id_hyperlinks', []),
                            entity_category=entity.get('category', '')
                        )
                    )
                except KeyError:
                    continue
        return self._create_annotation_object(entities_to_create)

    def _annotate_type_species(
        self,
        entity_id_str: str,
        custom_annotations: List[dict],
        recognized_entities: RecognizedEntities
    ) -> List[Annotation]:
        species_annotations = self._get_annotation(
            matches_list=recognized_entities.recognized_species,
            token_type=EntityType.SPECIES.value,
            id_str=entity_id_str
        )

        local_species_annotations = self._annotate_local_species(recognized_entities)

        # TODO: think about this
        # if a user creates a local inclusion for a species,
        # even if they chose to only annotate one occurrence of that word,
        # should all other occurrences be considered when annotating?
        # or could the same situation with gene/protein occur?
        # e.g case sensitive mean different things
        local_inclusions = [
            custom for custom in custom_annotations if custom.get(
                'meta', {}).get('type') == EntityType.SPECIES.value and not custom.get(
                    'meta', {}).get('includeGlobally')]

        # we only want the annotations with correct coordinates
        # because it is possible for a word to only have one
        # of its occurrences included as a custom annotation
        filtered_local_species_annotations: List[Annotation] = []

        for custom in local_inclusions:
            for custom_anno in local_species_annotations:
                if custom.get('rects') and len(custom['rects']) == len(custom_anno.rects):
                    # check if center point for each rect in custom_anno.rects
                    # is in the corresponding rectangle from custom annotations
                    valid = all(list(map(has_center_point, custom['rects'], custom_anno.rects)))

                    # if center point is in custom annotation rectangle
                    # then add it to list
                    if valid:
                        filtered_local_species_annotations.append(custom_anno)

        # clean species annotations first
        # because genes depend on them
        species_annotations = self._clean_annotations(annotations=species_annotations)

        species_annotations_with_local = [anno for anno in species_annotations]

        if local_inclusions:
            species_annotations_with_local += filtered_local_species_annotations

        self.organism_frequency, self.organism_locations, self.organism_categories = \
            self._get_entity_frequency_location_and_category(species_annotations_with_local)

        return species_annotations

    def _get_entity_frequency_location_and_category(
        self,
        annotations
    ) -> Tuple[
            Dict[str, int],
            Dict[str, List[Tuple[int, int]]],
            Dict[str, str]]:
        """Takes as input a list of annotation objects (intended to be of a single entity type).

        Returns the frequency of the annotation entities, and their locations within the document.
        """
        matched_entity_locations: Dict[str, List[Tuple[int, int]]] = {}
        entity_frequency: Dict[str, int] = {}
        entity_categories: Dict[str, str] = {}

        locations: Dict[str, Set[Tuple[int, int]]] = {}
        for annotation in annotations:
            entity_id = annotation.meta.id
            offset_pairs = (annotation.lo_location_offset, annotation.hi_location_offset)

            if entity_frequency.get(entity_id, None):
                entity_frequency[entity_id] += 1
            else:
                entity_frequency[entity_id] = 1

            if locations.get(entity_id, None):
                locations[entity_id].add(offset_pairs)
            else:
                locations[entity_id] = {offset_pairs}

            # Need to add an entry for humans if we annotated a virus
            if annotation.meta.category == OrganismCategory.VIRUSES.value:
                if locations.get(HOMO_SAPIENS_TAX_ID, None):
                    locations[HOMO_SAPIENS_TAX_ID].add(offset_pairs)
                else:
                    locations[HOMO_SAPIENS_TAX_ID] = {offset_pairs}

                if entity_frequency.get(HOMO_SAPIENS_TAX_ID, None):
                    entity_frequency[HOMO_SAPIENS_TAX_ID] += 1
                else:
                    entity_frequency[HOMO_SAPIENS_TAX_ID] = 1

                entity_categories[HOMO_SAPIENS_TAX_ID] = OrganismCategory.EUKARYOTA.value

            entity_categories[entity_id] = annotation.meta.category or ''

        for k, v in locations.items():
            matched_entity_locations[k] = sorted(v)

        return entity_frequency, matched_entity_locations, entity_categories

    def _get_fixed_false_positive_unified_annotations(
        self,
        annotations_list: List[Annotation]
    ) -> List[Annotation]:
        """Removes any false positive annotations.

        False positives occurred during our matching
        because we normalize the text from the pdf and
        the keys in lmdb.

        False positives are multi length word that
        got matched to a shorter length word due to
        normalizing in lmdb. Or words that get matched
        but the casing were not taken into account, e.g
        gene 'marA' is correct, but 'mara' is not.
        """
        fixed_annotations: List[Annotation] = []

        for annotation in annotations_list:
            text_in_document = annotation.text_in_document.split(' ')

            # TODO: Does the order of these checks matter?

            if isinstance(annotation, GeneAnnotation) or \
            (annotation.meta.type == EntityType.PROTEIN.value and len(text_in_document) == 1):  # noqa
                text_in_document = text_in_document[0]  # type: ignore
                if text_in_document == annotation.keyword:
                    fixed_annotations.append(annotation)
            elif len(text_in_document) > 1:
                keyword_from_annotation = annotation.keyword.split(' ')
                if len(keyword_from_annotation) >= len(text_in_document):
                    fixed_annotations.append(annotation)
                else:
                    # consider case such as `ferredoxin 2` vs `ferredoxin-2` in lmdb
                    keyword_from_annotation = annotation.keyword.split('-')
                    if len(keyword_from_annotation) >= len(text_in_document):
                        fixed_annotations.append(annotation)
            else:
                text_in_document = text_in_document[0]  # type: ignore
                fixed_annotations.append(annotation)

        return fixed_annotations

    def _create_annotations(
        self,
        types_to_annotate: List[Tuple[str, str]],
        custom_annotations: List[dict],
        recognized_entities: RecognizedEntities
    ) -> List[Annotation]:
        """Create annotations.

        Args:
            types_to_annotate: list of entity types to create annotations of
                - NOTE: IMPORTANT: should always match with `EntityRecognition.identify_entities()`
                - NOTE: IMPORTANT: Species should always be before Genes
                    - because species is used to do gene organism matching
                - e.g [
                    (EntityType.SPECIES.value, EntityIdStr.SPECIES.value),
                    (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value),
                    ...
                ]
        """
        unified_annotations: List[Annotation] = []

        matched_data = {
            EntityType.ANATOMY.value: recognized_entities.recognized_anatomy,
            EntityType.CHEMICAL.value: recognized_entities.recognized_chemicals,
            EntityType.COMPOUND.value: recognized_entities.recognized_compounds,
            EntityType.DISEASE.value: recognized_entities.recognized_diseases,
            EntityType.FOOD.value: recognized_entities.recognized_foods,
            EntityType.PHENOMENA.value: recognized_entities.recognized_phenomenas,
            EntityType.PHENOTYPE.value: recognized_entities.recognized_phenotypes,
            EntityType.COMPANY.value: recognized_entities.recognized_companies,
            EntityType.ENTITY.value: recognized_entities.recognized_entities,
            EntityType.LAB_SAMPLE.value: recognized_entities.recognized_lab_samples,
            EntityType.LAB_STRAIN.value: recognized_entities.recognized_lab_strains
        }

        for entity_type, entity_id_str in types_to_annotate:
            if entity_type == EntityType.SPECIES.value:
                unified_annotations += self._annotate_type_species(
                    entity_id_str=entity_id_str,
                    custom_annotations=custom_annotations,
                    recognized_entities=recognized_entities
                )
            elif entity_type == EntityType.GENE.value:
                unified_annotations += self._annotate_type_gene(recognized_entities)
            elif entity_type == EntityType.PROTEIN.value:
                unified_annotations += self._annotate_type_protein(recognized_entities)
            else:
                unified_annotations += self._get_annotation(
                    matches_list=matched_data[entity_type],
                    token_type=entity_type,
                    id_str=entity_id_str
                )

        return unified_annotations

    def create_annotations(
        self,
        custom_annotations: List[dict],
        entity_results: RecognizedEntities,
        entity_type_and_id_pairs: List[Tuple[str, str]],
        specified_organism: SpecifiedOrganismStrain,
        **kwargs
    ) -> List[Annotation]:
        self.specified_organism = specified_organism

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

        fixed_unified_annotations = self.fix_conflicting_annotations(
            unified_annotations=fixed_unified_annotations)
        return fixed_unified_annotations

    def fix_conflicting_annotations(
        self,
        unified_annotations: List[Annotation],
    ) -> List[Annotation]:
        """Annotations and keywords may span multiple entity types
        (e.g. compounds, chemicals, organisms, etc.), resulting in conflicting
        annotations.

        An annotation is a conflict if:
        - it has overlapping `lo_location_offset` and `hi_location_offset` with
            another annotation.
        - it has same intervals.
        """
        updated_unified_annotations: List[Annotation] = []
        annotation_interval_dict: Dict[Tuple[int, int], List[Annotation]] = {}

        for unified in unified_annotations:
            interval_pair = (unified.lo_location_offset, unified.hi_location_offset)
            if interval_pair in annotation_interval_dict:
                annotation_interval_dict[interval_pair].append(unified)
            else:
                annotation_interval_dict[interval_pair] = [unified]

        # it's faster to create an interval tree with just
        # intervals, rather than a tree with intervals and data
        # because the data are viewed as unique, so the tree is bigger
        tree = AnnotationIntervalTree(
            AnnotationInterval(
                begin=lo,
                end=hi
            ) for (lo, hi) in annotation_interval_dict)

        overlap_ranges = tree.merge_overlaps()

        for lo, hi in overlap_ranges:
            overlaps = tree.overlap(lo, hi)

            annotations_to_fix: List[Annotation] = []

            for overlap in overlaps:
                annotations_to_fix += [anno for anno in annotation_interval_dict[(overlap.begin, overlap.end)]]  # noqa

            chosen_annotation = None

            for annotation in annotations_to_fix:
                if chosen_annotation:
                    chosen_annotation = self.determine_entity_precedence(
                        anno1=chosen_annotation, anno2=annotation)
                else:
                    chosen_annotation = annotation
            updated_unified_annotations.append(chosen_annotation)  # type: ignore

        return updated_unified_annotations

    def determine_entity_precedence(
        self,
        anno1: Annotation,
        anno2: Annotation
    ) -> Annotation:
        key1 = ENTITY_TYPE_PRECEDENCE[anno1.meta.type]
        key2 = ENTITY_TYPE_PRECEDENCE[anno2.meta.type]

        # only do special gene vs protein comparison if they have
        # exact intervals
        # because that means the same normalized text was matched
        # to both
        if ((anno1.meta.type == EntityType.PROTEIN.value or
                anno1.meta.type == EntityType.GENE.value) and
            (anno2.meta.type == EntityType.PROTEIN.value or
                anno2.meta.type == EntityType.GENE.value) and
            (anno1.lo_location_offset == anno2.lo_location_offset and
                anno1.hi_location_offset == anno2.hi_location_offset)):  # noqa
            if anno1.meta.type != anno2.meta.type:
                # protein vs gene
                # protein has capital first letter: CysB
                # gene has lowercase: cysB
                # also cases like gene SerpinA1 vs protein Serpin A1

                """First check for exact match
                if no exact match then check substrings
                e.g `Serpin A1` matched to `serpin A1`
                e.g `SerpinA1` matched to `serpin A1`
                We take the first case will not count hyphens separated
                because hard to infer if it was used as a space
                need to consider precedence in case gene and protein
                have the exact spelling correct annotated word
                """
                gene_protein_precedence_result = None
                if key1 > key2:
                    if anno1.text_in_document == anno1.keyword:
                        gene_protein_precedence_result = anno1
                    elif anno2.text_in_document == anno2.keyword:
                        gene_protein_precedence_result = anno2

                    # no match so far
                    if gene_protein_precedence_result is None:
                        if len(anno1.text_in_document.split(' ')) == len(anno1.keyword.split(' ')):
                            gene_protein_precedence_result = anno1
                        elif len(anno2.text_in_document.split(' ')) == len(anno2.keyword.split(' ')):  # noqa
                            gene_protein_precedence_result = anno2
                else:
                    if anno2.text_in_document == anno2.keyword:
                        gene_protein_precedence_result = anno2
                    elif anno1.text_in_document == anno1.keyword:
                        gene_protein_precedence_result = anno1

                    # no match so far
                    if gene_protein_precedence_result is None:
                        if len(anno2.text_in_document.split(' ')) == len(anno2.keyword.split(' ')):
                            gene_protein_precedence_result = anno2
                        elif len(anno1.text_in_document.split(' ')) == len(anno1.keyword.split(' ')):  # noqa
                            gene_protein_precedence_result = anno1

                if gene_protein_precedence_result is not None:
                    return gene_protein_precedence_result

        if key1 > key2:
            return anno1
        elif key2 > key1:
            return anno2
        else:
            if anno1.keyword_length > anno2.keyword_length:
                return anno1
            else:
                return anno2
