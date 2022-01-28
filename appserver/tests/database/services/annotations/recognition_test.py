import json

from os import path

from neo4japp.services.annotations.data_transfer_objects import NLPResults
from neo4japp.services.annotations.utils.parsing import process_parsed_content

from .util import *


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def test_lmdb_protein_max_number_of_words(
    vascular_cell_adhesion_lmdb_setup,
    get_lmdb_service,
):
    entity_service = get_recognition_service(get_lmdb_service)
    tokenizer = get_annotation_tokenizer()

    pdf = path.join(
        directory,
        'pdf_samples/recognition_test/test_lmdb_protein_max_number_of_words.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    results = entity_service.identify(
        tokens=tokenizer.create(process_parsed_content(parsed)[1]),
        nlp_results=NLPResults()
    )

    assert len(results.recognized_proteins) == 2
