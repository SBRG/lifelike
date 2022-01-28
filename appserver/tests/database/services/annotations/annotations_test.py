import json
import pytest

from os import path

from neo4japp.services.annotations.data_transfer_objects import (
    SpecifiedOrganismStrain,
    GlobalInclusions
)
from neo4japp.services.annotations.utils.parsing import process_parsed_content

from .util import *


# reference to this directory
directory = path.realpath(path.dirname(__file__))


"""NOTE: IMPORTANT: Integrated pdfbox2

When testing annotations, the pdfparser container does not have a shared volume
with the appserver container - we could mount a shared volume, but this doesn't make
sense because it will only be used during test.

Let's avoid unexpected volume access.

So, instead of loading the PDFs, we need to first get the JSON (meaning calling the
pdfparser separately and saving that JSON file to the pdf_samples folder from now on.).

This also makes sense because appserver would only get back the JSON.

Doing it this way is a hassle, but it also decouples the annotation tests from the
file system schema, as that gets changed.
"""


@pytest.mark.parametrize(
    'index, annotations',
    [
        (1, [
            ('Test', 'Test', 5, 8, EntityType.GENE.value),
            ('Test a long word', 'Test a long word', 5, 20, EntityType.GENE.value)
        ]),
        (2, [
            ('word', 'word', 17, 20, EntityType.GENE.value)
        ]),
        # adjacent intervals
        (3, [
            ('word a', 'word', 17, 22, EntityType.CHEMICAL.value),
            ('a long word', 'a long word', 22, 32, EntityType.CHEMICAL.value)
        ])
    ],
)
def test_fix_conflicting_annotations_same_types(
    get_annotation_service,
    index,
    annotations
):
    annotation_service = get_annotation_service
    fixed = annotation_service.fix_conflicting_annotations(
        unified_annotations=create_mock_annotations(annotations),
    )

    if index == 1:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'Test a long word'
        assert fixed[0].lo_location_offset == 5
        assert fixed[0].hi_location_offset == 20
        assert fixed[0].meta.type == EntityType.GENE.value
    elif index == 2:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'word'
        assert fixed[0].lo_location_offset == 17
        assert fixed[0].hi_location_offset == 20
        assert fixed[0].meta.type == EntityType.GENE.value
    elif index == 3:
        # test adjacent intervals
        assert len(fixed) == 1
        assert fixed[0].keyword == 'a long word'
        assert fixed[0].lo_location_offset == 22
        assert fixed[0].hi_location_offset == 32
        assert fixed[0].meta.type == EntityType.CHEMICAL.value


@pytest.mark.parametrize(
    'index, annotations',
    [
        (1, [
            ('Test', 'test', 5, 8, EntityType.GENE.value),
            ('Test', 'test', 5, 8, EntityType.CHEMICAL.value)
        ]),
        (2, [
            ('Test', 'test', 35, 38, EntityType.GENE.value),
            ('Test a long word', 'word', 5, 20, EntityType.CHEMICAL.value),
        ]),
        (3, [
            ('word', 'word', 17, 20, EntityType.GENE.value),
            ('Test a long word', 'test a long word', 5, 20, EntityType.CHEMICAL.value)
        ]),
        (4, [
            ('word', 'word', 17, 20, EntityType.GENE.value),
            ('Test a long word', 'test a long word', 5, 20, EntityType.CHEMICAL.value),
            ('long word', 'long word', 55, 63, EntityType.CHEMICAL.value)
        ]),
        # adjacent intervals
        (5, [
            ('word a', 'word a', 17, 22, EntityType.GENE.value),
            ('a long word', 'a long word', 22, 32, EntityType.CHEMICAL.value)
        ]),
        (6, [
            ('IL7', 'IL-7', 5, 8, EntityType.GENE.value),
            ('IL-7', 'IL-7', 5, 8, EntityType.PROTEIN.value)
        ]),
        (7, [
            ('IL7', 'il-7', 5, 8, EntityType.GENE.value),
            ('IL-7', 'il-7', 5, 8, EntityType.PROTEIN.value)
        ]),
    ],
)
def test_fix_conflicting_annotations_different_types(
    get_annotation_service,
    index,
    annotations
):
    annotation_service = get_annotation_service
    fixed = annotation_service.fix_conflicting_annotations(
        unified_annotations=create_mock_annotations(annotations),
    )

    if index == 1:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'Test'
        assert fixed[0].lo_location_offset == 5
        assert fixed[0].hi_location_offset == 8
        assert fixed[0].meta.type == EntityType.GENE.value
    elif index == 2:
        assert len(fixed) == 2
    elif index == 3:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'word'
        assert fixed[0].lo_location_offset == 17
        assert fixed[0].hi_location_offset == 20
        assert fixed[0].meta.type == EntityType.GENE.value
    elif index == 4:
        assert len(fixed) == 2
        assert fixed[0].keyword == 'word'
        assert fixed[0].lo_location_offset == 17
        assert fixed[0].hi_location_offset == 20
        assert fixed[0].meta.type == EntityType.GENE.value
        assert fixed[1].keyword == 'long word'
        assert fixed[1].lo_location_offset == 55
        assert fixed[1].hi_location_offset == 63
        assert fixed[1].meta.type == EntityType.CHEMICAL.value
    elif index == 5:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'word a'
        assert fixed[0].lo_location_offset == 17
        assert fixed[0].hi_location_offset == 22
        assert fixed[0].meta.type == EntityType.GENE.value
    elif index == 6:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'IL-7'
        assert fixed[0].lo_location_offset == 5
        assert fixed[0].hi_location_offset == 8
        # because keyword == text_in_document
        assert fixed[0].meta.type == EntityType.PROTEIN.value
    elif index == 7:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'IL7'
        assert fixed[0].lo_location_offset == 5
        assert fixed[0].hi_location_offset == 8
        assert fixed[0].meta.type == EntityType.GENE.value


def test_gene_organism_escherichia_coli_pdf(
    lmdb_setup_test_gene_organism_escherichia_coli_pdf,
    mock_graph_test_gene_organism_escherichia_coli_pdf,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(directory, 'pdf_samples/annotations_test/ecoli_gene_test.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed
    )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert 'Escherichia coli' in keywords
    assert keywords['Escherichia coli'] == EntityType.SPECIES.value

    assert 'purA' in keywords
    assert keywords['purA'] == EntityType.GENE.value

    assert 'purB' in keywords
    assert keywords['purB'] == EntityType.GENE.value

    assert 'purC' in keywords
    assert keywords['purC'] == EntityType.GENE.value

    assert 'purD' in keywords
    assert keywords['purD'] == EntityType.GENE.value

    assert 'purF' in keywords
    assert keywords['purF'] == EntityType.GENE.value


def test_protein_organism_escherichia_coli_pdf(
    lmdb_setup_test_protein_organism_escherichia_coli_pdf,
    mock_graph_test_protein_organism_escherichia_coli_pdf,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(directory, 'pdf_samples/annotations_test/ecoli_protein_test.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed
    )

    keywords = {o.keyword: o.meta.id for o in annotations}

    assert 'YdhC' in keywords
    assert keywords['YdhC'] == 'P37597'


def test_local_inclusion_affect_gene_organism_matching(
    lmdb_setup_test_local_inclusion_affect_gene_organism_matching,
    mock_graph_test_local_inclusion_affect_gene_organism_matching,
    get_lmdb_service,
    get_annotation_service,
    get_graph_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_local_inclusion_affect_gene_organism_matching.json')

    custom_annotation = {
        'meta': {
            'id': '9606',
            'type': 'Species',
            'links': {
                'ncbi': 'https://www.ncbi.nlm.nih.gov/gene/?query=hooman',
                'mesh': 'https://www.ncbi.nlm.nih.gov/mesh/?term=hooman',
                'chebi': 'https://www.ebi.ac.uk/chebi/advancedSearchFT.do?searchString=hooman',
                'pubchem': 'https://pubchem.ncbi.nlm.nih.gov/#query=hooman',
                'google': 'https://www.google.com/search?q=hooman',
                'uniprot': 'https://www.uniprot.org/uniprot/?sort=score&query=hooman',
                'wikipedia': 'https://www.google.com/search?q=site:+wikipedia.org+hooman',
            },
            'idType': '',
            'allText': 'hooman',
            'isCustom': True,
            'idHyperlinks': [],
            'includeGlobally': False,
        },
        'uuid': 'a66ec5d5-f65b-467d-b16e-b833161e07d1',
        'rects': [[76.8953975, 706.52786608, 119.3537674652, 718.27682008]],
        'user_id': 2,
        'keywords': ['hooman'],
        'pageNumber': 1,
        'inclusion_date': '2020-08-03 23:00:09.728591+00:00',
    }

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    inclusions = [custom_annotation]
    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        inclusions=get_graph_service.get_entity_inclusions(inclusions),
        custom_annotations=inclusions)

    assert len(annotations) == 1
    assert annotations[0].meta.id == '388962'


def test_local_exclusion_affect_gene_organism_matching(
    lmdb_setup_test_local_inclusion_affect_gene_organism_matching,
    get_lmdb_service,
    get_annotation_service,
    get_db_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_local_exclusion_affect_gene_organism_matching.json')

    excluded_annotation = {
        'id': '37293',
        'text': 'aotus nancymaae',
        'type': 'Species',
        'rects': [
            [
                381.21680400799994,
                706.52786608,
                473.9653966747998,
                718.27682008
            ]
        ],
        'reason': 'Other',
        'comment': '',
        'user_id': 1,
        'pageNumber': 1,
        'idHyperlinks': ['https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=37293'],
        'exclusion_date': '2020-11-10 17:39:27.050845+00:00',
        'excludeGlobally': False,
        'isCaseInsensitive': True
    }

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        exclusions=get_db_service.get_entity_exclusions([excluded_annotation]))

    assert len(annotations) == 0


def test_assume_human_gene_after_finding_virus(
    lmdb_setup_test_assume_human_gene_after_finding_virus,
    mock_graph_test_assume_human_gene_after_finding_virus,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_assume_human_gene_after_finding_virus.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed
    )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert 'COVID-19' in keywords
    assert keywords['COVID-19'] == EntityType.DISEASE.value

    assert 'MERS-CoV' in keywords
    assert keywords['MERS-CoV'] == EntityType.SPECIES.value

    assert 'ACE2' in keywords
    assert keywords['ACE2'] == EntityType.GENE.value


def test_can_find_food_entities(
    lmdb_setup_test_can_find_food_entities,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_can_find_food_entities.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed
    )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert 'Artificial Sweeteners' in keywords
    assert keywords['Artificial Sweeteners'] == EntityType.FOOD.value

    assert 'Bacon' in keywords
    assert keywords['Bacon'] == EntityType.FOOD.value


def test_can_find_anatomy_entities(
    lmdb_setup_test_can_find_anatomy_entities,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_can_find_anatomy_entities.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed
    )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert '280 kDa Actin Binding Protein' in keywords
    assert keywords['280 kDa Actin Binding Protein'] == EntityType.ANATOMY.value

    assert 'Claws' in keywords
    assert keywords['Claws'] == EntityType.ANATOMY.value


@pytest.mark.parametrize(
    'index, fpath',
    [
        (1, 'pdf_samples/annotations_test/test_genes_vs_proteins/test_1.json'),
        (2, 'pdf_samples/annotations_test/test_genes_vs_proteins/test_2.json')
    ],
)
def test_genes_vs_proteins(
    lmdb_setup_test_gene_vs_protein,
    mock_graph_test_genes_vs_proteins,
    get_lmdb_service,
    get_annotation_service,
    index,
    fpath
):
    pdf = path.join(directory, fpath)

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed
    )

    if index == 1:
        assert len(annotations) == 4
        assert annotations[0].keyword == 'hyp27'
        assert annotations[0].meta.type == EntityType.GENE.value

        assert annotations[1].keyword == 'Moniliophthora roreri'
        assert annotations[1].meta.type == EntityType.SPECIES.value

        assert annotations[2].keyword == 'Hyp27'
        assert annotations[2].meta.type == EntityType.PROTEIN.value

        assert annotations[3].keyword == 'human'
        assert annotations[3].meta.type == EntityType.SPECIES.value
    elif index == 2:
        assert len(annotations) == 4
        assert annotations[0].keyword == 'Serpin A1'
        assert annotations[0].meta.type == EntityType.PROTEIN.value
        assert annotations[1].keyword == 'human'
        assert annotations[1].meta.type == EntityType.SPECIES.value
        assert annotations[2].keyword == 'SERPINA1'
        assert annotations[2].meta.type == EntityType.GENE.value
        assert annotations[3].keyword == 'human'
        assert annotations[3].meta.type == EntityType.SPECIES.value


@pytest.mark.parametrize(
    'index, annotations',
    [
        (1, [
            ('casE', 'case', 5, 8, EntityType.GENE.value),
        ]),
        (2, [
            ('ADD', 'add', 5, 7, EntityType.GENE.value),
        ]),
        (3, [
            ('CpxR', 'CpxR', 5, 7, EntityType.GENE.value),
        ])
    ],
)
def test_fix_false_positive_gene_annotations(
    get_annotation_service,
    index,
    annotations
):
    annotation_service = get_annotation_service
    fixed = annotation_service._get_fixed_false_positive_unified_annotations(
        annotations_list=create_mock_annotations(annotations),
    )

    if index == 1:
        assert len(fixed) == 0
    elif index == 2:
        assert len(fixed) == 0
    elif index == 3:
        assert len(fixed) == 1


@pytest.mark.parametrize(
    'index, annotations',
    [
        (1, [
            ('SidE', 'side', 5, 8, EntityType.PROTEIN.value),
        ]),
        (2, [
            ('Tir', 'TIR', 5, 7, EntityType.PROTEIN.value),
        ]),
        (3, [
            ('TraF', 'TraF', 5, 7, EntityType.PROTEIN.value),
        ]),
        (4, [
            ('NS2A', 'NS2A', 5, 8, EntityType.PROTEIN.value),
        ])
    ],
)
def test_fix_false_positive_protein_annotations(
    get_annotation_service,
    index,
    annotations
):
    annotation_service = get_annotation_service
    fixed = annotation_service._get_fixed_false_positive_unified_annotations(
        annotations_list=create_mock_annotations(annotations)
    )

    # do exact case matching for genes
    if index == 1:
        assert len(fixed) == 0
    elif index == 2:
        assert len(fixed) == 0
    elif index == 3:
        assert len(fixed) == 1
    elif index == 4:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'NS2A'


def test_gene_id_changes_to_result_from_kg_if_matched_with_organism(
    lmdb_setup_test_gene_id_changes_to_result_from_kg_if_matched_with_organism,
    mock_graph_test_gene_id_changes_to_result_from_kg_if_matched_with_organism,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_gene_id_changes_to_result_from_kg_if_matched_with_organism.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed
    )

    assert annotations[0].keyword == 'il-7'
    assert annotations[0].meta.id == '99999'


def test_human_is_prioritized_if_equal_distance_in_gene_organism_matching(
    lmdb_setup_test_human_is_prioritized_if_equal_distance_in_gene_organism_matching,
    mock_graph_test_human_is_prioritized_if_equal_distance_in_gene_organism_matching,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_human_is_prioritized_if_equal_distance_in_gene_organism_matching.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed
    )

    assert annotations[1].keyword == 'EDEM3'
    assert annotations[1].meta.id == '80267'


def test_global_excluded_chemical_annotations(
    lmdb_setup_test_global_excluded_chemical_annotations,
    get_db_service,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_chemical_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    excluded = {
        'text': 'hypofluorite',
        'type': EntityType.CHEMICAL.value,
        'excludeGlobally': False,
        'isCaseInsensitive': True
    }

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        exclusions=get_db_service.get_entity_exclusions([excluded]))

    assert len(annotations) == 1
    assert 'hypofluorite' not in set([anno.keyword for anno in annotations])


def test_global_excluded_compound_annotations(
    lmdb_setup_test_global_excluded_compound_annotations,
    get_db_service,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_compound_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    excluded = {
        'text': 'guanosine',
        'type': EntityType.COMPOUND.value,
        'excludeGlobally': False,
        'isCaseInsensitive': True
    }

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        exclusions=get_db_service.get_entity_exclusions([excluded]))

    assert len(annotations) == 1
    assert 'guanosine' not in set([anno.keyword for anno in annotations])


def test_global_excluded_disease_annotations(
    lmdb_setup_test_global_excluded_disease_annotations,
    get_db_service,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_disease_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    excluded = {
        'text': 'cold sore',
        'type': EntityType.DISEASE.value,
        'excludeGlobally': False,
        'isCaseInsensitive': True
    }

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        exclusions=get_db_service.get_entity_exclusions([excluded]))

    assert len(annotations) == 1
    assert 'cold sore' not in set([anno.keyword for anno in annotations])
    assert 'Cold Sore' not in set([anno.keyword for anno in annotations])


def test_global_excluded_gene_annotations(
    lmdb_setup_test_global_excluded_gene_annotations,
    get_db_service,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_gene_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    excluded = {
        'text': 'BOLA3',
        'type': EntityType.GENE.value,
        'excludeGlobally': False,
        'isCaseInsensitive': True
    }

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        exclusions=get_db_service.get_entity_exclusions([excluded]))

    assert len(annotations) == 1
    assert 'BOLA3' not in set([anno.keyword for anno in annotations])


def test_global_excluded_phenotype_annotations(
    lmdb_setup_test_global_excluded_phenotype_annotations,
    get_db_service,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_phenotype_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    excluded = {
        'text': 'whey proteins',
        'type': EntityType.PHENOTYPE.value,
        'excludeGlobally': False,
        'isCaseInsensitive': True
    }

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        exclusions=get_db_service.get_entity_exclusions([excluded]))

    assert len(annotations) == 1
    assert 'whey proteins' not in set([anno.keyword for anno in annotations])


def test_global_excluded_protein_annotations(
    lmdb_setup_test_global_excluded_protein_annotations,
    get_db_service,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_protein_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    excluded = {
        'text': 'Wasabi receptor toxin',
        'type': EntityType.PROTEIN.value,
        'excludeGlobally': False,
        'isCaseInsensitive': True
    }

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        exclusions=get_db_service.get_entity_exclusions([excluded]))

    assert len(annotations) == 1
    assert 'Wasabi receptor toxin' not in set([anno.keyword for anno in annotations])


def test_global_excluded_species_annotations(
    lmdb_setup_test_global_excluded_species_annotations,
    get_db_service,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_species_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    excluded = {
        'text': 'human',
        'type': EntityType.SPECIES.value,
        'excludeGlobally': False,
        'isCaseInsensitive': True
    }

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        exclusions=get_db_service.get_entity_exclusions([excluded]))

    assert len(annotations) == 1
    assert 'human' not in set([anno.keyword for anno in annotations])


def test_global_exclusions_does_not_interfere_with_other_entities(
    lmdb_setup_test_global_exclusions_does_not_interfere_with_other_entities,
    get_db_service,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_exclusions_does_not_interfere_with_other_entities.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    excluded = {
        'text': 'adenosine',
        'type': EntityType.CHEMICAL.value,
        'excludeGlobally': False,
        'isCaseInsensitive': True
    }

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        exclusions=get_db_service.get_entity_exclusions([excluded]))

    assert len(annotations) == 2
    assert annotations[0].keyword == 'adenosine'
    assert annotations[0].meta.type == EntityType.COMPOUND.value


def test_global_chemical_inclusion_annotation(
    mock_global_chemical_inclusion_annotation,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_chemical_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        inclusions=GlobalInclusions(
            included_chemicals=mock_global_chemical_inclusion_annotation))

    assert len(annotations) == 1
    assert annotations[0].keyword == 'fake-chemical-(12345)'
    assert annotations[0].meta.id == 'CHEBI:789456'


def test_global_compound_inclusion_annotation(
    mock_global_compound_inclusion_annotation,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_compound_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        inclusions=GlobalInclusions(
            included_compounds=mock_global_compound_inclusion_annotation))

    assert len(annotations) == 1
    assert annotations[0].keyword == 'compound-(12345)'
    assert annotations[0].meta.id == 'BIOCYC:321357'


def test_global_gene_inclusion_annotation(
    lmdb_setup_test_global_gene_inclusion_annotation,
    mock_graph_test_global_gene_inclusion_annotation,
    mock_global_gene_inclusion_annotation,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_gene_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        inclusions=GlobalInclusions(
            included_genes=mock_global_gene_inclusion_annotation))

    assert len(annotations) == 2
    assert annotations[0].keyword == 'gene-(12345)'
    assert annotations[0].meta.id == '59272'


def test_global_disease_inclusion_annotation(
    mock_global_disease_inclusion_annotation,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_disease_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        inclusions=GlobalInclusions(
            included_diseases=mock_global_disease_inclusion_annotation))

    assert len(annotations) == 1
    assert annotations[0].keyword == 'disease-(12345)'
    assert annotations[0].meta.id == 'MESH:852753'


def test_global_phenomena_inclusion_annotation(
    mock_global_phenomena_inclusion_annotation,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_phenomena_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        inclusions=GlobalInclusions(
            included_phenomenas=mock_global_phenomena_inclusion_annotation))

    assert len(annotations) == 1
    assert annotations[0].keyword == 'fake-phenomena'
    assert annotations[0].meta.id == 'MESH:842605'


def test_global_phenotype_inclusion_annotation(
    mock_global_phenotype_inclusion_annotation,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_phenotype_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        inclusions=GlobalInclusions(
            included_phenotypes=mock_global_phenotype_inclusion_annotation))

    assert len(annotations) == 1
    assert annotations[0].keyword == 'phenotype-(12345)'
    assert annotations[0].meta.id == 'FakePheno'


def test_global_protein_inclusion_annotation(
    mock_global_protein_inclusion_annotation,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_protein_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        inclusions=GlobalInclusions(
            included_proteins=mock_global_protein_inclusion_annotation))

    assert len(annotations) == 1
    assert annotations[0].keyword == 'protein-(12345)'
    assert annotations[0].meta.id == 'protein-(12345)'


def test_global_species_inclusion_annotation(
    mock_global_species_inclusion_annotation,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_species_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        inclusions=GlobalInclusions(
            included_species=mock_global_species_inclusion_annotation))

    assert len(annotations) == 1
    assert annotations[0].keyword == 'species-(12345)'
    assert annotations[0].meta.id == '0088'


def test_no_annotation_for_abbreviation(
    lmdb_setup_test_no_annotation_for_abbreviation,
    mock_graph_test_no_annotation_for_abbreviation,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_no_annotation_for_abbreviation.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        specified_organism=SpecifiedOrganismStrain(
            synonym='Homo sapiens',
            organism_id='9606',
            category='EUKARYOTA')
    )

    assert len(annotations) == 3
    keywords = {o.keyword: o.meta.type for o in annotations}
    assert 'PAH' not in keywords
    assert 'PPP' not in keywords
    assert 'Pentose Phosphate Pathway' in keywords
    assert 'Pulmonary Arterial Hypertension' in keywords


def test_delta_gene_deletion_detected(
    lmdb_setup_test_gene_organism_escherichia_coli_pdf,
    mock_graph_test_gene_organism_escherichia_coli_pdf,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_delta_gene_deletion_detected.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed
    )

    assert len(annotations) == 4
    assert annotations[0].keyword == 'purB'
    assert annotations[1].keyword == 'purC'
    assert annotations[2].keyword == 'purF'


# @pytest.mark.skip('No longer applicable with LL-3144 and LL-3145?')
# def test_user_source_database_input_priority(
#     mock_global_chemical_inclusion,
#     get_tokenizer,
#     get_annotation_service,
#     get_recognition_service
# ):
#     custom = {
#         'meta': {
#             'idType': 'MESH',
#             'allText': 'Carbon',
#             'idHyperlinks': 'http://fake',
#             'isCaseInsensitive': True,
#             'id': 'CHEBI:27594',
#             'type': EntityType.CHEMICAL.value
#         },
#     }

#     annotation_service = get_annotation_service
#     entity_service = get_recognition_service
#     tokenizer = get_tokenizer
#     entity_service.included_chemicals = mock_global_chemical_inclusion

#     pdf = path.join(
#         directory,
#         'pdf_samples/annotations_test/test_user_source_database_input_priority.json')

#     with open(pdf, 'rb') as f:
#         parsed = json.load(f)

#     _, parsed = process_parsed_content(parsed)
#     annotations = annotate_pdf(
#         tokenizer=tokenizer,
#         annotation_service=annotation_service,
#         entity_service=entity_service,
#         parsed=parsed
#     )

#     # if idHyperlinks in `mock_global_chemical_inclusion` was empty
#     # then it would've defaulted to
#     # https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:27594
#     assert annotations[0].meta.id_hyperlinks == custom['meta']['idHyperlinks']
#     assert annotations[0].meta.id_type == custom['meta']['idType']


def test_global_inclusion_normalized_already_in_lmdb(
    lmdb_setup_test_global_inclusion_normalized_already_in_lmdb,
    mock_graph_global_inclusion_normalized_already_in_lmdb,
    mock_global_inclusion_normalized_already_in_lmdb,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_inclusion_normalized_already_in_lmdb.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed,
        inclusions=GlobalInclusions(
            included_genes=mock_global_inclusion_normalized_already_in_lmdb))

    assert annotations[1].primary_name == 'CXCL8'


def test_gene_matched_to_organism_before_if_closest_is_too_far(
    lmdb_setup_test_new_gene_organism_matching_algorithm,
    mock_graph_test_new_gene_organism_matching_algorithm,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_gene_matched_to_organism_before_if_closest_is_too_far.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed)

    assert len(annotations) == 5

    matches = {a.keyword: a.meta.id for a in annotations}
    assert '5743' in matches['PTGS2']
    assert '627' in matches['BDNF']
    assert '684' in matches['BST2']


def test_gene_matched_to_most_freq_organism_if_closest_is_too_far_and_no_before_organism(
    lmdb_setup_test_new_gene_organism_matching_algorithm,
    mock_graph_test_new_gene_organism_matching_algorithm,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_gene_matched_to_most_freq_organism_if_closest_is_too_far_and_no_before_organism.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed)

    assert len(annotations) == 8

    matches = {a.keyword: a.meta.id for a in annotations}
    assert '5743' in matches['PTGS2']
    assert '627' in matches['BDNF']
    assert '684' in matches['BST2']


def test_prioritize_primary_name_that_equals_synonym(
    lmdb_setup_test_prioritize_primary_name_that_equals_synonym,
    get_lmdb_service,
    get_annotation_service
):
    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_prioritize_primary_name_that_equals_synonym.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = process_parsed_content(parsed)
    annotations = annotate_pdf_for_testing(
        annotation_service=get_annotation_service,
        lmdb_service=get_lmdb_service,
        parsed=parsed)

    assert len(annotations) == 2

    matches = {a.keyword: a.meta.id for a in annotations}
    assert 'CHEBI:46715' in matches['halite']
    assert 'CHEBI:127342' in matches['atomoxetine']
