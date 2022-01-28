from flask import Blueprint, request, jsonify

from neo4japp.blueprints.auth import auth
from neo4japp.database import get_enrichment_table_service


bp = Blueprint('enrichment-table-api', __name__, url_prefix='/enrichment-table')


@bp.route('/match-ncbi-nodes', methods=['POST'])
@auth.login_required
def match_ncbi_nodes():
    # TODO: Validate incoming data using webargs + Marshmallow and move to class-based view
    data = request.get_json()
    gene_names = data.get('geneNames')
    organism = data.get('organism')
    nodes = []

    if organism is not None and gene_names is not None:
        enrichment_table = get_enrichment_table_service()
        # list(dict...) is to drop duplicates, but want to keep order
        nodes = enrichment_table.match_ncbi_genes(list(dict.fromkeys(gene_names)), organism)

    return jsonify({'result': nodes}), 200
