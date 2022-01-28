import time

from flask import current_app
from neo4j import Transaction as Neo4jTx
from neo4j.graph import Node as N4jDriverNode, Relationship as N4jDriverRelationship
from typing import Dict, List

from neo4japp.constants import (
    BIOCYC_ORG_ID_DICT,
)
from neo4japp.exceptions import ServerException
from neo4japp.services.common import HybridDBDao
from neo4japp.models import (
    DomainURLsMap,
    GraphNode,
    GraphRelationship
)
from neo4japp.constants import (
    ANNOTATION_STYLES_DICT,
    DISPLAY_NAME_MAP,
    LogEventType,
)
from neo4japp.util import (
    get_first_known_label_from_list,
    get_first_known_label_from_node,
    snake_to_camel_dict
)
from neo4japp.utils.logger import EventLog


class KgService(HybridDBDao):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def _neo4j_objs_to_graph_objs(
        self,
        nodes: List[N4jDriverNode],
        relationships: List[N4jDriverRelationship],
    ):
        # TODO: Can possibly use a dispatch method/injection
        # of sorts to use custom labeling methods for
        # different type of nodes/edges being converted.
        # The default does not always set an appropriate label
        # name.
        node_dict = {}
        rel_dict = {}

        for node in nodes:
            try:
                label = get_first_known_label_from_node(node)
            except ValueError:
                label = 'Unknown'
                current_app.logger.warning(
                    f"Node with ID {node.id} had an unexpected list of labels: {list(node.labels)}",
                    extra=EventLog(
                        event_type=LogEventType.KNOWLEDGE_GRAPH.value
                    ).to_dict()
                )
            graph_node = GraphNode(
                id=node.id,
                label=get_first_known_label_from_node(node),
                sub_labels=list(node.labels),
                domain_labels=[],
                display_name=node.get(DISPLAY_NAME_MAP[label], 'Unknown'),
                data=snake_to_camel_dict(dict(node), {}),
                url=None
            )
            node_dict[graph_node.id] = graph_node

        for rel in relationships:
            graph_rel = GraphRelationship(
                id=rel.id,
                label=type(rel).__name__,
                data=dict(rel),
                to=rel.end_node.id,
                _from=rel.start_node.id,
                to_label=list(rel.end_node.labels)[0],
                from_label=list(rel.start_node.labels)[0]
            )
            rel_dict[graph_rel.id] = graph_rel
        return {
            'nodes': [n.to_dict() for n in node_dict.values()],
            'edges': [r.to_dict() for r in rel_dict.values()]
        }

    def query_batch(self, data_query: str):
        """ query batch uses a custom query language (one we make up here)
        for returning a list of nodes and their relationships.
        It also works on single nodes with no relationship.

        Example:
            If we wanted all relationships between
            the node pairs (node1, node2) and
            (node3, node4), we will write the
            query as follows:

                node1,node2&node3,node4
        """

        # TODO: This no longer works as expected with the refactor of the visualizer
        # search. May need to refactor this in the future, or just get rid of it.
        split_data_query = data_query.split('&')

        if len(split_data_query) == 1 and split_data_query[0].find(',') == -1:
            result = self.graph.read_transaction(
                lambda tx: list(
                    tx.run(
                        'MATCH (n) WHERE ID(n)=$node_id RETURN n AS node',
                        node_id=int(split_data_query.pop())
                    )
                )
            )

            node = []
            if len(result) > 0:
                node = [result[0]['node']]

            return self._neo4j_objs_to_graph_objs(node, [])
        else:
            data = [x.split(',') for x in split_data_query]
            result = self.graph.read_transaction(
                lambda tx: list(
                    tx.run(
                        """
                        UNWIND $data as node_pair
                        WITH node_pair[0] as from_id, node_pair[1] as to_id
                        MATCH (a)-[relationship]->(b)
                        WHERE ID(a)=from_id AND ID(b)=to_id
                        RETURN
                            apoc.convert.toSet(collect(a) + collect(b)) as nodes,
                            apoc.convert.toSet(collect(relationship)) as relationships
                        """,
                        data=data
                    )
                )
            )

            nodes = []
            relationships = []
            if len(result) > 0:
                nodes = result[0]['nodes']
                relationships = result[0]['relationships']

            return self._neo4j_objs_to_graph_objs(nodes, relationships)

    def get_uniprot_genes(self, ncbi_gene_ids: List[int]):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_uniprot_genes_query,
            ncbi_gene_ids
        )

        current_app.logger.info(
            f'Enrichment UniProt KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        domain = self.session.query(DomainURLsMap).filter(
            DomainURLsMap.domain == 'uniprot').one_or_none()

        if domain is None:
            raise ServerException(
                title='Could not create enrichment table',
                message='There was a problem finding UniProt domain URLs.')

        return {
            result['node_id']: {
                'result': {'id': result['uniprot_id'], 'function': result['function']},
                'link': domain.base_URL.format(result['uniprot_id'])
            } for result in results}

    def get_string_genes(self, ncbi_gene_ids: List[int]):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_string_genes_query,
            ncbi_gene_ids
        )

        current_app.logger.info(
            f'Enrichment String KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        return {
            result['node_id']: {
                'result': {'id': result['string_id'], 'annotation': result['annotation']},
                'link': f"https://string-db.org/cgi/network?identifiers={result['string_id']}"
            } for result in results}

    def get_biocyc_genes(
        self,
        ncbi_gene_ids: List[int],
        tax_id: str
    ):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_biocyc_genes_query,
            ncbi_gene_ids
        )

        current_app.logger.info(
            f'Enrichment Biocyc KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        return {
            result['node_id']: {
                'result': result['pathways'],
                'link': f"https://biocyc.org/gene?orgid={BIOCYC_ORG_ID_DICT[tax_id]}&id={result['biocyc_id']}"  # noqa
                    if tax_id in BIOCYC_ORG_ID_DICT else f"https://biocyc.org/gene?id={result['biocyc_id']}"  # noqa
            } for result in results}

    def get_go_genes(self, ncbi_gene_ids: List[int]):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_go_genes_query,
            ncbi_gene_ids,
        )

        current_app.logger.info(
            f'Enrichment GO KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        return {
            result['node_id']: {
                'result': result['go_terms'],
                'link': 'https://www.ebi.ac.uk/QuickGO/annotations?geneProductId='
            } for result in results}

    def get_regulon_genes(self, ncbi_gene_ids: List[int]):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_regulon_genes_query,
            ncbi_gene_ids
        )

        current_app.logger.info(
            f'Enrichment Regulon KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        return {
            result['node_id']: {
                'result': result['node'],
                'link': f"http://regulondb.ccg.unam.mx/gene?term={result['regulondb_id']}&organism=ECK12&format=jsp&type=gene"  # noqa
            } for result in results}

    def get_kegg_genes(self, ncbi_gene_ids: List[int]):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_kegg_genes_query,
            ncbi_gene_ids
        )

        current_app.logger.info(
            f'Enrichment KEGG KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        return {
            result['node_id']: {
                'result': result['pathway'],
                'link': f"https://www.genome.jp/entry/{result['kegg_id']}"
            } for result in results}

    def get_nodes_and_edges_from_paths(self, paths):
        nodes = []
        node_ids = set()
        edges = []
        edge_ids = set()
        for path in paths:
            if path.get('nodes', None) is not None:
                for node in path['nodes']:
                    if node['id'] not in node_ids:
                        node_display_name = 'Node Display Name Unknown'
                        if node.get('display_name', None) is not None:
                            node_display_name = node['display_name']
                        elif node.get('name', None) is not None:
                            node_display_name = node['name']

                        try:
                            node_label = get_first_known_label_from_list(node['labels'])
                            node_color = ANNOTATION_STYLES_DICT[node_label.lower()]['color']
                        except ValueError:
                            # If label is unknown, then use fallbacks
                            node_label = 'Unknown'
                            node_color = '#000000'
                            current_app.logger.warning(
                                f"Node had an unexpected list of labels: {node['labels']}",
                                extra=EventLog(
                                    event_type=LogEventType.KNOWLEDGE_GRAPH.value
                                ).to_dict()
                            )
                        except KeyError:
                            # If label does not exist in styles dict, then use fallbacks
                            node_label = 'Unknown'
                            node_color = '#000000'

                        node_data = {
                            'id': node['id'],
                            'label': node_display_name,
                            'databaseLabel': node_label,
                            'font': {
                                'color': node_color,
                            },
                            'color': {
                                'background': '#FFFFFF',
                                'border': node_color,
                                'hover': {
                                    'background': '#FFFFFF',
                                    'border': node_color,
                                },
                                'highlight': {
                                    'background': '#FFFFFF',
                                    'border': node_color,
                                },
                            }
                        }

                        nodes.append(node_data)
                        node_ids.add(node['id'])

            if path.get('edges', None) is not None:
                for edge in path['edges']:
                    if edge['id'] not in edge_ids:
                        edge_data = {
                            'id': edge['id'],
                            'label': edge['type'],
                            'from': edge['start_node'],
                            'to': edge['end_node'],
                            'color': {
                                'color': '#0c8caa',
                            },
                            'arrows': 'to',
                        }

                        edges.append(edge_data)
                        edge_ids.add(edge['id'])
        return {'nodes': nodes, 'edges': edges}

    def get_uniprot_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:HAS_GENE]-(x:db_UniProt)
            WHERE id(g)=node_id
            RETURN node_id, x.function AS function, x.eid AS uniprot_id
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()

    def get_string_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:HAS_GENE]-(x:db_STRING)
            WHERE id(g)=node_id
            RETURN node_id, x.eid AS string_id, x.annotation AS annotation
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()

    def get_go_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:GO_LINK]-(x:db_GO)
            WHERE id(g)=node_id
            RETURN node_id, collect(x.name) AS go_terms
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()

    def get_biocyc_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:IS]-(x:db_BioCyc)
            WHERE id(g)=node_id
            RETURN node_id, x.pathways AS pathways, x.biocyc_id AS biocyc_id
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()

    def get_regulon_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:IS]-(x:db_RegulonDB)
            WHERE id(g)=node_id
            RETURN node_id, x AS node, x.regulondb_id AS regulondb_id
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()

    def get_kegg_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:IS]-(x:db_KEGG)
            WHERE id(g)=node_id
            WITH node_id, x
            MATCH (x)-[:HAS_KO]-()-[:IN_PATHWAY]-(p:Pathway)-[:HAS_PATHWAY]-(gen:Genome)
            WHERE gen.eid = x.genome
            RETURN node_id, x.eid AS kegg_id, collect(p.name) AS pathway
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()
