from flask import Blueprint, request, jsonify
from flask_apispec import use_kwargs

from neo4japp.blueprints.auth import auth
from neo4japp.constants import ANNOTATION_STYLES_DICT
from neo4japp.database import get_visualizer_service

from neo4japp.data_transfer_objects.visualization import (
    ExpandNodeRequest,
    GetSnippetsForEdgeRequest,
    GetSnippetsForClusterRequest,
    ReferenceTableDataRequest,
)
from neo4japp.request_schemas.visualizer import (
    GetSnippetsForNodePairRequest,
    AssociatedTypeSnippetCountRequest,
)
from neo4japp.exceptions import (
    InvalidArgument,
)
from neo4japp.util import SuccessResponse, jsonify_with_class

bp = Blueprint('visualizer-api', __name__, url_prefix='/visualizer')


@bp.route('/batch', methods=['GET'])
@auth.login_required
@jsonify_with_class()
def get_batch():
    """ Uses a home-brew query language
    to get a batch of nodes and their
    relationship
    TODO: Document query language
    """
    visualizer_service = get_visualizer_service()
    data_query = request.args.get('data', '')
    try:
        decoded_query = bytearray.fromhex(data_query).decode()
    except ValueError:
        return SuccessResponse(result='No results found', status_code=200)
    result = visualizer_service.query_batch(decoded_query)
    return SuccessResponse(result=result, status_code=200)


@bp.route('/expand', methods=['POST'])
@auth.login_required
@jsonify_with_class(ExpandNodeRequest)
def expand_graph_node(req: ExpandNodeRequest):
    visualizer = get_visualizer_service()
    node = visualizer.expand_graph(req.node_id, req.filter_labels)
    return SuccessResponse(result=node, status_code=200)


@bp.route('/get-reference-table-data', methods=['POST'])
@auth.login_required
@jsonify_with_class(ReferenceTableDataRequest)
def get_reference_table_data(req: ReferenceTableDataRequest):
    visualizer = get_visualizer_service()
    reference_table_data = visualizer.get_reference_table_data(
        req.node_edge_pairs,
    )
    return SuccessResponse(reference_table_data, status_code=200)


@bp.route('/get-snippets-for-edge', methods=['POST'])
@auth.login_required
@jsonify_with_class(GetSnippetsForEdgeRequest)
def get_edge_snippet_data(req: GetSnippetsForEdgeRequest):
    visualizer = get_visualizer_service()

    # TODO: In the future would be better to refactor this request to use Marshmallow and handle
    # the validation in the schema, but in the interest of time favoring this approach for now.
    if not (0 <= req.limit and req.limit <= 1000):
        raise InvalidArgument(
            title='Failed to Get Edge Snippets',
            message='Query limit is out of bounds, the limit is 0 <= limit <= 1000.',
            code=400
        )

    edge_snippets_result = visualizer.get_snippets_for_edge(
        page=req.page,
        limit=req.limit,
        edge=req.edge,
    )
    return SuccessResponse(edge_snippets_result, status_code=200)


@bp.route('/get-snippets-for-cluster', methods=['POST'])
@auth.login_required
@jsonify_with_class(GetSnippetsForClusterRequest)
def get_cluster_snippet_data(req: GetSnippetsForClusterRequest):
    visualizer = get_visualizer_service()

    # TODO: In the future would be better to refactor this request to use Marshmallow and handle
    # the validation in the schema, but in the interest of time favoring this approach for now.
    if not (0 <= req.limit and req.limit <= 1000):
        raise InvalidArgument(
            title='Failed to Get Cluster Snippets',
            message='Query limit is out of bounds, the limit is 0 <= limit <= 1000.',
            code=400
        )

    cluster_snippets_result = visualizer.get_snippets_for_cluster(
        page=req.page,
        limit=req.limit,
        edges=req.edges,
    )
    return SuccessResponse(cluster_snippets_result, status_code=200)


@bp.route('/get-annotation-legend', methods=['GET'])
@auth.login_required
@jsonify_with_class()
def get_annotation_legend():
    return SuccessResponse(result=ANNOTATION_STYLES_DICT, status_code=200)


@bp.route('/get-associated-type-snippet-count', methods=['POST'])
@auth.login_required
@use_kwargs(AssociatedTypeSnippetCountRequest)
def get_associated_type_snippet_count(source_node, associated_nodes):
    visualizer = get_visualizer_service()

    associated_types_result = visualizer.get_associated_type_snippet_count(
        source_node,
        associated_nodes,
    )
    return jsonify({
        'result': associated_types_result.to_dict(),
    })


@bp.route('/get-snippets-for-node-pair', methods=['POST'])
@auth.login_required
@use_kwargs(GetSnippetsForNodePairRequest)
def get_snippets_for_node_pair(node_1_id, node_2_id, page, limit):
    visualizer = get_visualizer_service()

    node_pair_snippet_result = visualizer.get_snippets_for_node_pair(
        node_1_id,
        node_2_id,
        page,
        limit
    )

    return jsonify({
        'result': node_pair_snippet_result.to_dict()
    })
