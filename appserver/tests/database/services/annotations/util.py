from typing import List, Tuple

from neo4japp.services.annotations import (
    EntityRecognitionService,
    LMDBService,
    Tokenizer
)
from neo4japp.services.annotations.data_transfer_objects import (
    Annotation,
    GeneAnnotation,
    NLPResults,
    SpecifiedOrganismStrain
)
from neo4japp.services.annotations.constants import EntityType, OrganismCategory
from neo4japp.services.annotations.data_transfer_objects import GlobalExclusions, GlobalInclusions


class MockTokenizer(Tokenizer):
    def __init__(self) -> None:
        super().__init__()


class MockEntityRecognitionService(EntityRecognitionService):
    def __init__(
        self,
        exclusions: GlobalExclusions,
        inclusions: GlobalInclusions,
        lmdb: LMDBService
    ):
        super().__init__(exclusions, inclusions, lmdb)


def get_annotation_tokenizer():
    return MockTokenizer()


def get_recognition_service(get_lmdb_service, exclusions=None, inclusions=None):
    if exclusions is None:
        exclusions = GlobalExclusions()

    if inclusions is None:
        inclusions = GlobalInclusions()

    return MockEntityRecognitionService(
        exclusions=exclusions,
        inclusions=inclusions,
        lmdb=get_lmdb_service
    )


def create_mock_entity_annotations(data: Tuple[str, str, int, int, str]):
    kw, tid, lo, hi, kwtype = data
    return Annotation(
        page_number=1,
        keyword=kw,
        lo_location_offset=lo,
        hi_location_offset=hi,
        keyword_length=len(kw),
        text_in_document=tid,
        keywords=[],
        rects=[[1, 2]],
        meta=Annotation.Meta(
            type=kwtype,
            id='',
            id_type='',
            id_hyperlinks=[],
            links=Annotation.Meta.Links(),
        ),
        uuid='',
    )


def create_mock_gene_annotations(data: Tuple[str, str, int, int, str]):
    kw, tid, lo, hi, _ = data
    return GeneAnnotation(
        page_number=1,
        keyword=kw,
        lo_location_offset=lo,
        hi_location_offset=hi,
        keyword_length=len(kw),
        text_in_document=tid,
        keywords=[],
        rects=[[1, 2]],
        meta=GeneAnnotation.GeneMeta(
            type=EntityType.GENE.value,
            id='',
            id_type='',
            id_hyperlinks=[],
            links=Annotation.Meta.Links(),
            category=OrganismCategory.EUKARYOTA.value,
        ),
        uuid='',
    )


def create_mock_annotations(data):
    mocks = []
    for d in data:
        if d[4] != EntityType.GENE.value:
            mocks.append(create_mock_entity_annotations(d))
        else:
            mocks.append(create_mock_gene_annotations(d))
    return mocks


def annotate_pdf_for_testing(
    annotation_service,
    lmdb_service,
    parsed,
    custom_annotations=[],
    exclusions=None,
    inclusions=None,
    nlp_results=None,
    specified_organism=SpecifiedOrganismStrain(synonym='', organism_id='', category='')
):
    tokenizer = get_annotation_tokenizer()
    entity_recognition = get_recognition_service(lmdb_service, exclusions, inclusions)

    if nlp_results is None:
        nlp_results = NLPResults()

    entity_results = entity_recognition.identify(
        tokens=tokenizer.create(parsed),
        nlp_results=nlp_results
    )
    return annotation_service.create_annotations(
        custom_annotations=custom_annotations,
        entity_results=entity_results,
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=specified_organism
    )
