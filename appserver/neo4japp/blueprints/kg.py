from enum import Enum

from flask import Blueprint, request, jsonify

from neo4japp.blueprints.auth import auth
from neo4japp.database import get_kg_service

bp = Blueprint('kg-api', __name__, url_prefix='/knowledge-graph')


# TODO: move this to a constant.py (not the neo4japp/constants.py)
class Domain(Enum):
    REGULON = 'Regulon'
    UNIPROT = 'UniProt'
    STRING = 'String'
    GO = 'GO'
    BIOCYC = 'BioCyc'
    KEGG = 'KEGG'


@bp.route('/get-ncbi-nodes/enrichment-domains', methods=['POST'])
@auth.login_required
def get_ncbi_enrichment_domains():
    """ Find all domains matched to given node id, then return dictionary with all domains as
        result. All domains should have matching indices e.g. regulon[1] should be data from
        matching same node as uniprot[1].
    """
    # TODO: Validate incoming data using webargs + Marshmallow
    data = request.get_json()
    node_ids = data.get('nodeIds')
    tax_id = data.get('taxID')
    domains = data.get('domains')

    nodes = {}

    if node_ids is not None and tax_id is not None:
        kg = get_kg_service()

        regulon = kg.get_regulon_genes(node_ids) if Domain.REGULON.value in domains else {}
        biocyc = kg.get_biocyc_genes(node_ids, tax_id) if Domain.BIOCYC.value in domains else {}
        go = kg.get_go_genes(node_ids) if Domain.GO.value in domains else {}
        string = kg.get_string_genes(node_ids) if Domain.STRING.value in domains else {}
        uniprot = kg.get_uniprot_genes(node_ids) if Domain.UNIPROT.value in domains else {}
        kegg = kg.get_kegg_genes(node_ids) if Domain.KEGG.value in domains else {}

        nodes = {
            node_id: {
                'regulon': regulon.get(node_id, None),
                'uniprot': uniprot.get(node_id, None),
                'string': string.get(node_id, None),
                'go': go.get(node_id, None),
                'biocyc': biocyc.get(node_id, None),
                'kegg': kegg.get(node_id, None),
                'node_id': node_id
            } for node_id in node_ids}

    return jsonify({'result': nodes}), 200
