import json
import time

from flask import current_app
from typing import List, Tuple

from .constants import SPECIES_LMDB
from .data_transfer_objects import PDFWord, SpecifiedOrganismStrain
from .utils.nlp import predict
from .utils.parsing import parse_content

from neo4japp.constants import LogEventType, FILE_MIME_TYPE_PDF
from neo4japp.exceptions import AnnotationError
from neo4japp.util import normalize_str
from neo4japp.utils.logger import EventLog


class Pipeline:
    """Pipeline of steps involved in annotation of PDFs, enrichment tables, etc.

    The purpose of the pipeline is to assemble several steps involved in the
    annotation process, and allow a single interface to interact through.

    :param steps : dict
        Dict of {name: step} that are required for processing annotations.
        Step here is the service init function.
    :param kwargs : dict
        Currently accept two keyword args:
            (1) text : str
            (2) parsed : list
                List of PDFWord objects representing words in text.
    """
    def __init__(self, steps: dict, **kwargs):
        if not all(k in ['adbs', 'ags', 'aers', 'tkner', 'as', 'bs'] for k in steps):
            raise AnnotationError(
                'Unable to Annotate',
                'Configurations for the annotation pipeline is incorrect, please try again later.')
        self.steps = steps
        self.text = kwargs.get('text', '')
        self.parsed = kwargs.get('parsed', [])
        self.entities = None
        self.global_exclusions = None
        self.global_inclusions = None

    @classmethod
    def parse(self, content_type: str, **kwargs) -> Tuple[str, List[PDFWord]]:
        """
        :param content_type : str
            Of the file mime type (found in neo4japp.constants), only
            two matters at the moment:
                (1) FILE_MIME_TYPE_PDF
                (2) FILE_MIME_TYPE_ENRICHMENT_TABLE
        :param kwargs : dict
            Currently accept three keyword args:
                (1) file_id : int
                (2) exclude_references : bool
                (3) text : str
        """
        params = {}
        if 'text' not in kwargs:
            params['file_id'] = kwargs.get('file_id', None)
            params['exclude_references'] = kwargs.get('exclude_references', True)
        else:
            params['text'] = kwargs.get('text', '')

        if content_type == FILE_MIME_TYPE_PDF and not params['file_id']:
            raise AnnotationError(
                'Unable to Annotate',
                'Cannot annotate the PDF file, the file id is missing or data is corrupted.')

        return parse_content(content_type, **params)

    def get_globals(
        self,
        excluded_annotations: List[dict],
        custom_annotations: List[dict]
    ):
        db_service = self.steps['adbs']()
        graph_service = self.steps['ags']()

        start = time.time()
        self.global_exclusions = db_service.get_entity_exclusions(excluded_annotations)
        self.global_inclusions = graph_service.get_entity_inclusions(custom_annotations)
        current_app.logger.info(
            f'Time to process entity exclusions/inclusions {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )
        return self

    def identify(self, annotation_methods: dict):
        self.er_service = self.steps['aers'](
            exclusions=self.global_exclusions, inclusions=self.global_inclusions)
        tokenizer = self.steps['tkner']()

        # identify entities w/ NLP first
        entities_to_run_nlp = set(k for k, v in annotation_methods.items() if v['nlp'])
        start = time.time()
        nlp_results = predict(text=self.text, entities=entities_to_run_nlp)
        current_app.logger.info(
            f'Total NLP processing time for entities {entities_to_run_nlp} {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )

        start = time.time()
        tokens = tokenizer.create(self.parsed)
        current_app.logger.info(
            f'Time to tokenize PDF words {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )

        start = time.time()
        self.entities = self.er_service.identify(tokens=tokens, nlp_results=nlp_results)
        current_app.logger.info(
            f'Total LMDB lookup time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )
        return self

    def annotate(
        self,
        specified_organism_synonym: str,
        specified_organism_tax_id: str,
        custom_annotations: dict,
        filename: str,
        enrichment_mappings: dict = {}
    ):
        annotator = self.steps['as']()
        bioc_service = self.steps['bs']()

        self.create_fallback_organism(
            specified_organism_synonym,
            specified_organism_tax_id
        )

        start = time.time()
        annotations = annotator.create_annotations(
            custom_annotations=custom_annotations,
            entity_results=self.entities,
            entity_type_and_id_pairs=annotator.get_entities_to_annotate(),
            specified_organism=self.fallback_organism,
            enrichment_mappings=enrichment_mappings
        )

        current_app.logger.info(
            f'Time to create annotations {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )

        bioc = bioc_service.read(text=self.text, file_uri=filename)
        return bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)

    def create_fallback_organism(
        self,
        specified_organism_synonym: str,
        specified_organism_tax_id: str
    ):
        entity_synonym = ''
        entity_id = ''
        entity_category = ''

        if specified_organism_synonym and specified_organism_tax_id:
            entity_synonym = normalize_str(specified_organism_synonym)
            entity_id = specified_organism_tax_id
            try:
                with self.er_service.lmdb.begin(SPECIES_LMDB) as txn:
                    entity_category = json.loads(
                        txn.get(entity_synonym.encode('utf-8')))['category']
            except (KeyError, TypeError, Exception):
                # could not get data from lmdb
                current_app.logger.info(
                    f'Failed to get category for fallback organism "{specified_organism_synonym}".',  # noqa
                    extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
                )
                entity_category = 'Uncategorized'
        self.fallback_organism = SpecifiedOrganismStrain(
            synonym=entity_synonym, organism_id=entity_id, category=entity_category)
        return self
