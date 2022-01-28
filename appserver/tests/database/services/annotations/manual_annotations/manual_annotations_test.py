import pytest

from os import path

from neo4japp.exceptions import AnnotationError
from neo4japp.services.annotations.constants import EntityType


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def test_add_custom_annotation_inclusion_annotate_all(
    get_manual_annotation_service,
    mock_add_custom_annotation_inclusion,
    file_in_project,
    project_owner
):
    annotation_service = get_manual_annotation_service

    custom = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.SPECIES.value,
            'allText': 'Pikachu',
            'idType': '',
            'idHyperlinks': [],
            'isCaseInsensitive': True,
            'includeGlobally': False
        }
    }

    inclusions = annotation_service.add_inclusions(
        file=file_in_project,
        user=project_owner,
        custom_annotation=custom,
        annotate_all=True
    )
    assert len(inclusions) == 2


def test_add_custom_annotation_inclusion_multi_word(
    get_manual_annotation_service,
    mock_add_custom_annotation_inclusion,
    file_in_project,
    project_owner
):
    annotation_service = get_manual_annotation_service

    custom = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.SPECIES.value,
            'allText': 'caught a Pikachu',
            'idType': '',
            'idHyperlinks': [],
            'isCaseInsensitive': True,
            'includeGlobally': False
        }
    }

    inclusions = annotation_service.add_inclusions(
        file=file_in_project,
        user=project_owner,
        custom_annotation=custom,
        annotate_all=True
    )

    assert len(inclusions) == 2


def test_add_custom_annotation_inclusion(
    get_manual_annotation_service,
    mock_add_custom_annotation_inclusion,
    file_in_project,
    project_owner
):
    annotation_service = get_manual_annotation_service

    custom = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.SPECIES.value,
            'allText': 'Pikachu',
            'idType': '',
            'idHyperlinks': [],
            'isCaseInsensitive': True,
            'includeGlobally': False
        }
    }

    inclusions = annotation_service.add_inclusions(
        file=file_in_project,
        user=project_owner,
        custom_annotation=custom,
        annotate_all=False
    )
    assert len(inclusions) == 1


def test_add_custom_annotation_inclusion_multi_word_gene_limit(
    get_manual_annotation_service,
    mock_add_custom_annotation_inclusion,
    file_in_project,
    project_owner
):
    annotation_service = get_manual_annotation_service

    custom = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.GENE.value,
            'allText': 'caught a Pikachu',  # GENE max limit is 1 word
            'idType': '',
            'idHyperlinks': [],
            'isCaseInsensitive': True,
            'includeGlobally': False
        }
    }

    with pytest.raises(AnnotationError):
        inclusions = annotation_service.add_inclusions(
            file=file_in_project,
            user=project_owner,
            custom_annotation=custom,
            annotate_all=True
        )


def test_add_custom_annotation_inclusion_multi_word_food_limit(
    get_manual_annotation_service,
    mock_add_custom_annotation_inclusion,
    file_in_project,
    project_owner
):
    annotation_service = get_manual_annotation_service

    custom = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.GENE.value,
            'allText': 'I just caught a Pikachu',  # FOOD max limit is 4 word
            'idType': '',
            'idHyperlinks': [],
            'isCaseInsensitive': True,
            'includeGlobally': False
        }
    }

    with pytest.raises(AnnotationError):
        inclusions = annotation_service.add_inclusions(
            file=file_in_project,
            user=project_owner,
            custom_annotation=custom,
            annotate_all=True
        )
