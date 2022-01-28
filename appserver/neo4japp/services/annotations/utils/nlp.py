import json
import multiprocessing as mp
import os
import requests

from typing import Dict, Set

from ..constants import NLP_URL, REQUEST_TIMEOUT, EntityType
from ..data_transfer_objects import NLPResults

from neo4japp.exceptions import ServerException


def call_nlp_service(model: str, text: str) -> dict:
    try:
        req = requests.post(
            NLP_URL,
            data=json.dumps({'model': model, 'sentence': text}),
            headers={
                'Content-type': 'application/json',
                'secret': os.environ.get('NLP_SECRET')},
            timeout=REQUEST_TIMEOUT)

        resp = req.json()
        req.close()
    except requests.exceptions.ConnectTimeout:
        raise ServerException(
            'Service Error',
            'The request timed out while trying to connect to the NLP service.')
    except requests.exceptions.Timeout:
        raise ServerException(
            'Service Error',
            'The request to the NLP service timed out.')
    except (requests.exceptions.RequestException, Exception):
        raise ServerException(
            'Service Error',
            'An unexpected error occurred with the NLP service.')
    return resp


def predict(text: str, entities: Set[str]):
    """Makes a call to the NLP service.
    Returns the set of entity types in which the token was found.
    """
    if not entities:
        return NLPResults()

    nlp_models = {
        EntityType.CHEMICAL.value: 'bc2gm_v1_chem',
        EntityType.GENE.value: 'bc2gm_v1_gene',
        # TODO: disease has two models
        # for now use ncbi because it has better results
        EntityType.DISEASE.value: 'bc2gm_v1_ncbi_disease'
    }

    nlp_model_types = {
        'bc2gm_v1_chem': EntityType.CHEMICAL.value,
        'bc2gm_v1_gene': EntityType.GENE.value,
        'bc2gm_v1_ncbi_disease': EntityType.DISEASE.value,
        'bc2gm_v1_bc5cdr_disease': EntityType.DISEASE.value
    }

    entity_results: Dict[str, set] = {
        EntityType.ANATOMY.value: set(),
        EntityType.CHEMICAL.value: set(),
        EntityType.COMPOUND.value: set(),
        EntityType.DISEASE.value: set(),
        EntityType.FOOD.value: set(),
        EntityType.GENE.value: set(),
        EntityType.PHENOMENA.value: set(),
        EntityType.PHENOTYPE.value: set(),
        EntityType.PROTEIN.value: set(),
        EntityType.SPECIES.value: set()
    }

    models = []
    # start = time.time()
    if all([model in entities for model in nlp_models]):
        req = call_nlp_service(model='all', text=text)
        models = [req]
    else:
        with mp.Pool(processes=4) as pool:
            models = pool.starmap(
                call_nlp_service, [(
                    nlp_models[model],
                    text
                ) for model in entities if nlp_models.get(model, None)])

    # current_app.logger.info(
    #     f'Total NLP time {time.time() - start}',
    #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
    # )

    for model in models:
        for results in model['results']:
            for token in results['annotations']:
                token_offset = (token['start_pos'], token['end_pos']-1)
                entity_results[nlp_model_types[results['model']]].add(token_offset)

    return NLPResults(
        anatomy=entity_results[EntityType.ANATOMY.value],
        chemicals=entity_results[EntityType.CHEMICAL.value],
        # compound will use chemical
        compounds=entity_results[EntityType.CHEMICAL.value],
        diseases=entity_results[EntityType.DISEASE.value],
        foods=entity_results[EntityType.FOOD.value],
        genes=entity_results[EntityType.GENE.value],
        phenomenas=entity_results[EntityType.PHENOMENA.value],
        phenotypes=entity_results[EntityType.PHENOTYPE.value],
        proteins=entity_results[EntityType.PROTEIN.value],
        species=entity_results[EntityType.SPECIES.value],
    )
