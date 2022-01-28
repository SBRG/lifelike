from neo4japp.database import ma


class AssociatedTypeSnippetCountRequest(ma.Schema):
    source_node = ma.Integer(required=True)
    associated_nodes = ma.List(ma.Integer(required=True))


class GetSnippetsForNodePairRequest(ma.Schema):
    # Note that we avoid using "from" and "to" terminology here since we can't be sure there aren't
    # bidirectional relationships between these two nodes
    node_1_id = ma.Integer(required=True)
    node_2_id = ma.Integer(required=True)
    page = ma.Integer(required=True)
    limit = ma.Integer(required=True)
