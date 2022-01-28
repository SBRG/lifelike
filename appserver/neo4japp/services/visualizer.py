from flask.globals import current_app
from neo4j import Record as Neo4jRecord, Transaction as Neo4jTx
from typing import List

from neo4japp.constants import (
    LogEventType,
    TYPE_CHEMICAL,
    TYPE_DISEASE,
    TYPE_GENE,
    TYPE_LITERATURE_CHEMICAL,
    TYPE_LITERATURE_DISEASE,
    TYPE_LITERATURE_GENE
)
from neo4japp.data_transfer_objects.visualization import (
    Direction,
    DuplicateEdgeConnectionData,
    EdgeConnectionData,
    GetClusterSnippetsResult,
    GetEdgeSnippetsResult,
    GetNodePairSnippetsResult,
    GetReferenceTableDataResult,
    GetSnippetsFromEdgeResult,
    ReferenceTablePair,
    ReferenceTableRow,
    Snippet,
    GetAssociatedTypesResult,
)
from neo4japp.models import GraphNode
from neo4japp.models.entity_resources import DomainURLsMap
from neo4japp.services import KgService
from neo4japp.util import get_first_known_label_from_list, snake_to_camel_dict
from neo4japp.utils.logger import EventLog


class VisualizerService(KgService):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def _get_uri_of_node_data(self, id: int, label: str, entity_id: str):
        """Given node meta data returns the appropriate
        URL formatted with the node entity identifier.
        """
        url_map = {
            domain: base_url
            for domain, base_url in self.session.query(
                DomainURLsMap.domain,
                DomainURLsMap.base_URL,
            )
        }

        # Can't get the URI of the node if there is no 'eid' property, so return None
        if entity_id is None:
            current_app.logger.warning(
                f'Node with EID {entity_id} does not have a URI.',
                extra=EventLog(event_type=LogEventType.KNOWLEDGE_GRAPH.value).to_dict()
            )
            return None

        url = None
        try:
            if label == TYPE_CHEMICAL:
                db_prefix, uid = entity_id.split(':')
                if db_prefix == 'CHEBI':
                    url = url_map['chebi'].format(uid)
                else:
                    url = url_map['MESH'].format(uid)
            elif label == TYPE_DISEASE:
                db_prefix, uid = entity_id.split(':')
                if db_prefix == 'MESH':
                    url = url_map['MESH'].format(uid)
                else:
                    url = url_map['omim'].format(uid)
            elif label == TYPE_GENE:
                url = url_map['NCBI_Gene'].format(entity_id)
            elif label == TYPE_LITERATURE_CHEMICAL:
                db_prefix, uid = entity_id.split(':')
                if db_prefix == 'CHEBI':
                    url = url_map['chebi'].format(uid)
                else:
                    url = url_map['MESH'].format(uid)
            elif label == TYPE_LITERATURE_DISEASE:
                db_prefix, uid = entity_id.split(':')
                if db_prefix == 'MESH':
                    url = url_map['MESH'].format(uid)
                else:
                    url = url_map['omim'].format(uid)
            elif label == TYPE_LITERATURE_GENE:
                url = url_map['NCBI_Gene'].format(entity_id)
        except KeyError:
            current_app.logger.warning(
                f'url_map did not contain the expected key value for node with:\n' +
                f'\tID: {id}\n'
                f'\tLabel: {label}\n' +
                f'\tURI: {entity_id}\n'
                'There may be something wrong in the database.',
                extra=EventLog(event_type=LogEventType.KNOWLEDGE_GRAPH.value).to_dict()
            )
        finally:
            return url

    def expand_graph(self, node_id: str, filter_labels: List[str]):
        result = self.graph.read_transaction(self.get_expand_query, node_id, filter_labels)

        node_data = []
        edge_data = []
        if len(result) > 0:
            node_data = result[0]['nodes']
            edge_data = result[0]['relationships']

        nodes = []
        for data in node_data:
            try:
                label = get_first_known_label_from_list(data['labels'])
            except ValueError:
                label = 'Unknown'
            nodes.append({
                'id': data['id'],
                'label': label,
                'domainLabels': [],
                'data': {
                    'name': data['name'],
                    'id': data['entity_id'],
                },
                'subLabels': data['labels'],
                'displayName': data['name'],
                'entityUrl': self._get_uri_of_node_data(data['id'], label, data['entity_id'])
            })

        edges = []
        for data in edge_data:
            try:
                from_label = get_first_known_label_from_list(data['from_labels'])
            except ValueError:
                from_label = 'Unknown'

            try:
                to_label = get_first_known_label_from_list(data['to_labels'])
            except ValueError:
                to_label = 'Unknown'

            edges.append({
                'id': data['id'],
                'label': data['label'],
                'data': {
                    'description': data['relationship'].get('description'),
                    'association_id': data['relationship'].get('association_id'),
                    'type': data['relationship'].get('type'),
                },
                'to': data['relationship'].end_node.id,
                'from': data['relationship'].start_node.id,
                'toLabel': to_label,
                'fromLabel': from_label,
            })

        return {'nodes': nodes, 'edges': edges}

    def get_snippets_from_edges(
        self,
        from_ids: List[int],
        to_ids: List[int],
        description: str,
        page: int,
        limit: int
    ):
        return self.graph.read_transaction(
            self.get_snippets_from_edges_query,
            from_ids,
            to_ids,
            description,
            (page - 1) * limit,
            limit
        )

    def get_snippets_from_node_pair(
        self,
        node_1_id: int,
        node_2_id: int,
        page: int,
        limit: int
    ):
        return self.graph.read_transaction(
            self.get_snippets_from_node_pair_query,
            node_1_id,
            node_2_id,
            (page - 1) * limit,
            limit
        )

    def get_snippet_count_from_node_pair(
        self,
        node_1_id: int,
        node_2_id: int,
    ):
        return self.graph.read_transaction(
            self.get_snippet_count_from_node_pair_query,
            node_1_id,
            node_2_id
        )['snippet_count']

    def get_reference_table_data(self, node_edge_pairs: List[ReferenceTablePair]):
        # For duplicate edges, We need to remember which true node ID pairs map to which
        # duplicate node ID pairs, otherwise when we send the data back to the frontend
        # we won't know which duplicate nodes we should match the snippet data with
        ids_to_pairs = {
            (pair.edge.original_from, pair.edge.original_to): pair
            for pair in node_edge_pairs
        }

        # One of these lists will have all duplicates (depends on the direction
        # of the cluster edge). We remove the duplicates so we don't get weird query results.
        from_ids = list({pair.edge.original_from for pair in node_edge_pairs})
        to_ids = list({pair.edge.original_to for pair in node_edge_pairs})
        description = node_edge_pairs[0].edge.label  # Every edge should have the same label
        direction = Direction.FROM.value if len(from_ids) == 1 else Direction.TO.value

        counts = self.graph.read_transaction(
            self.get_snippet_count_from_edges_query,
            from_ids,
            to_ids,
            description
        )

        reference_table_rows: List[ReferenceTableRow] = []
        for row in counts:
            pair = ids_to_pairs[(row['from_id'], row['to_id'])]
            reference_table_rows.append(ReferenceTableRow(
                node_id=pair.node.id,
                node_display_name=pair.node.display_name,
                node_label=pair.node.label,
                snippet_count=row['count'],
            ))

        return GetReferenceTableDataResult(
            reference_table_rows=reference_table_rows,
            direction=direction
        )

    def get_snippets_for_edge(
        self,
        edge: EdgeConnectionData,
        page: int,
        limit: int,
    ) -> GetEdgeSnippetsResult:
        from_ids = [edge.from_]
        to_ids = [edge.to]
        description = edge.label  # Every edge should have the same label

        data = self.get_snippets_from_edges(from_ids, to_ids, description, page, limit)
        count_results = self.graph.read_transaction(
            self.get_snippet_count_from_edges_query,
            from_ids,
            to_ids,
            description
        )
        total_results = sum(row['count'] for row in count_results)

        # `data` is either length 0 or 1
        snippets = []
        for row in data:
            for reference in row['references']:
                snippets.append(
                    Snippet(
                        reference=GraphNode(
                            reference['snippet']['id'],
                            'Snippet',
                            [],
                            snake_to_camel_dict(reference['snippet']['data'], {}),
                            [],
                            None,
                            None,
                        ),
                        publication=GraphNode(
                            reference['publication']['id'],
                            'Publication',
                            [],
                            snake_to_camel_dict(reference['publication']['data'], {}),
                            [],
                            None,
                            None,
                        ),
                    )
                )

        result = GetSnippetsFromEdgeResult(
            from_node_id=edge.from_,
            to_node_id=edge.to,
            association=edge.label,
            snippets=snippets
        )

        return GetEdgeSnippetsResult(
            snippet_data=result,
            total_results=total_results,
            query_data=edge,
        )

    def get_snippets_for_cluster(
        self,
        edges: List[DuplicateEdgeConnectionData],
        page: int,
        limit: int,
    ) -> GetClusterSnippetsResult:
        # For duplicate edges, We need to remember which true node ID pairs map to which
        # duplicate node ID pairs, otherwise when we send the data back to the frontend
        # we won't know which duplicate nodes we should match the snippet data with
        id_pairs = {
            (edge.original_from, edge.original_to): {'from': edge.from_, 'to': edge.to}
            for edge in edges
        }

        # One of these lists will have all duplicates (depends on the direction
        # of the cluster edge). We remove the duplicates so we don't get weird query results.
        from_ids = list({edge.original_from for edge in edges})
        to_ids = list({edge.original_to for edge in edges})
        description = edges[0].label  # Every edge should have the same label

        data = self.get_snippets_from_edges(from_ids, to_ids, description, page, limit)
        count_results = self.graph.read_transaction(
            self.get_snippet_count_from_edges_query,
            from_ids,
            to_ids,
            description
        )
        total_results = sum(row['count'] for row in count_results)

        results = [
            GetSnippetsFromEdgeResult(
                from_node_id=id_pairs[(row['from_id'], row['to_id'])]['from'],
                to_node_id=id_pairs[(row['from_id'], row['to_id'])]['to'],
                association=row['description'],
                snippets=[Snippet(
                    reference=GraphNode(
                        reference['snippet']['id'],
                        'Snippet',
                        [],
                        snake_to_camel_dict(reference['snippet']['data'], {}),
                        [],
                        None,
                        None,
                    ),
                    publication=GraphNode(
                        reference['publication']['id'],
                        'Publication',
                        [],
                        snake_to_camel_dict(reference['publication']['data'], {}),
                        [],
                        None,
                        None,
                    ),
                ) for reference in row['references']]
            ) for row in data
        ]

        return GetClusterSnippetsResult(
            snippet_data=results,
            total_results=total_results,
            query_data=edges,
        )

    def get_associated_type_snippet_count(
        self,
        source_node: int,
        associated_nodes: List[int],
    ):
        results = self.graph.read_transaction(
            self.get_associated_type_snippet_count_query,
            source_node,
            associated_nodes
        )

        return GetAssociatedTypesResult(
            associated_data=results
        )

    def get_snippets_for_node_pair(
        self,
        node_1_id: int,
        node_2_id: int,
        page: int,
        limit: int,
    ):
        data = self.get_snippets_from_node_pair(node_1_id, node_2_id, page, limit)
        total_results = self.get_snippet_count_from_node_pair(node_1_id, node_2_id)

        results = [
            GetSnippetsFromEdgeResult(
                from_node_id=row['from_id'],
                to_node_id=row['to_id'],
                association=row['description'],
                snippets=[Snippet(
                    reference=GraphNode(
                        reference['snippet']['id'],
                        'Snippet',
                        [],
                        snake_to_camel_dict(reference['snippet']['data'], {}),
                        [],
                        None,
                        None,
                    ),
                    publication=GraphNode(
                        reference['publication']['id'],
                        'Publication',
                        [],
                        snake_to_camel_dict(reference['publication']['data'], {}),
                        [],
                        None,
                        None,
                    ),
                ) for reference in row['references']]
            ) for row in data
        ]

        return GetNodePairSnippetsResult(
            snippet_data=results,
            total_results=total_results,
            query_data={'node_1_id': node_1_id, 'node_2_id': node_2_id},
        )

    def get_expand_query(self, tx: Neo4jTx, node_id: str, labels: List[str]) -> List[Neo4jRecord]:
        return list(
            tx.run(
                """
                MATCH (n)
                WHERE ID(n)=$node_id
                MATCH (n)-[l:ASSOCIATED]-(m)
                WHERE any(x IN $labels WHERE x IN labels(m))
                RETURN
                    apoc.convert.toSet([{
                        id: ID(n),
                        labels: labels(n),
                        entity_id: n.eid,
                        name: n.name
                    }] + collect({
                        id: ID(m),
                        labels: labels(m),
                        entity_id: m.eid,
                        name: m.name
                    })) AS nodes,
                    apoc.convert.toSet(collect({
                        // We have to return the entire relationship as well, so we can get the
                        // start and end nodes.
                        relationship: l,
                        id: id(l),
                        label: type(l),
                        from_labels: labels(n),
                        to_labels: labels(m)
                    })) AS relationships
                """,
                node_id=node_id, labels=labels
            )
        )

    def get_associated_type_snippet_count_query(
        self,
        tx,
        source_node: int,
        associated_nodes: List[int]
    ):
        return list(
            tx.run(
                """
                UNWIND $associated_nodes as associated_node
                MATCH (f)-[r:ASSOCIATED]-(t)
                WHERE
                    ID(f)=$source_node AND
                    ID(t)=associated_node
                WITH
                    ID(startNode(r)) as from_id,
                    ID(endNode(r)) as to_id,
                    t.name as name,
                    ID(t) as node_id
                MATCH (f)-[:HAS_ASSOCIATION]-(a:Association)-[:HAS_ASSOCIATION]-(t)
                WHERE ID(f)=from_id AND ID(t)=to_id
                WITH from_id, to_id, a AS association, name, node_id
                MATCH (association)<-[r:INDICATES]-(s:Snippet)-[:IN_PUB]-(p:Publication)
                RETURN
                    name,
                    node_id,
                    count(DISTINCT {
                        from_id: from_id,
                        to_id: to_id,
                        description: association.description,
                        snippet_id: s.eid
                    }) AS snippet_count
                ORDER BY snippet_count DESC, node_id
                """,
                source_node=source_node, associated_nodes=associated_nodes
            ).data()
        )

    def get_snippets_from_edges_query(
        self,
        tx: Neo4jTx,
        from_ids: List[int],
        to_ids: List[int],
        description: str,
        skip: int,
        limit: int
    ) -> List[Neo4jRecord]:
        return list(
            tx.run(
                """
                MATCH (f)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(t)
                WHERE
                    ID(f) IN $from_ids AND
                    ID(t) IN $to_ids AND
                    a.description=$description
                WITH
                    a AS association,
                    ID(f) AS from_id,
                    ID(t) AS to_id,
                    a.description AS description
                MATCH (association)<-[r:INDICATES]-(s:Snippet)-[:IN_PUB]-(p:Publication)
                WITH
                    s,
                    p,
                    head(collect(r)) as sample_path,
                    coalesce(association.entry1_type, 'Unknown') as entry1_type,
                    coalesce(association.entry2_type, 'Unknown') as entry2_type,
                    from_id,
                    to_id,
                    description
                WITH
                    collect({snippet: s, publication: p, path: sample_path}) as references,
                    count({snippet: s, publication: p, path: sample_path}) as snippet_count,
                    entry1_type,
                    entry2_type,
                    from_id,
                    to_id,
                    description
                UNWIND references as reference
                WITH
                    entry1_type,
                    entry2_type,
                    {
                        snippet: {
                            id: reference.snippet.eid,
                            data: {
                                entry1_text: reference.path.entry1_text,
                                entry2_text: reference.path.entry2_text,
                                entry1_type: entry1_type,
                                entry2_type: entry2_type,
                                sentence: reference.snippet.sentence
                            }
                        },
                        publication: {
                            id: reference.publication.pmid,
                            data: {
                                journal: reference.publication.journal,
                                title: reference.publication.title,
                                pmid: reference.publication.pmid,
                                pub_year: reference.publication.pub_year
                            }
                        }
                    } AS reference,
                    snippet_count,
                    from_id,
                    to_id,
                    description
                ORDER BY
                    snippet_count DESC,
                    [from_id, to_id],
                    coalesce(reference.publication.data.pub_year, -1) DESC
                SKIP $skip LIMIT $limit
                RETURN collect(DISTINCT reference) AS references, from_id, to_id, description
                """,
                from_ids=from_ids, to_ids=to_ids, description=description, skip=skip, limit=limit
            )
        )

    def get_snippets_from_node_pair_query(
        self,
        tx: Neo4jTx,
        node_1_id: int,
        node_2_id: int,
        skip: int,
        limit: int
    ) -> List[Neo4jRecord]:
        return list(
            tx.run(
                """
                MATCH (f)-[r:ASSOCIATED]-(t)
                WHERE
                    ID(f)=$node_1_id AND
                    ID(t)=$node_2_id
                WITH ID(startNode(r)) as from_id, ID(endNode(r)) as to_id
                MATCH (f)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(t)
                WHERE
                    ID(f)=from_id AND
                    ID(t)=to_id
                WITH
                    a AS association,
                    from_id,
                    to_id,
                    a.description AS description
                MATCH (association)<-[r:INDICATES]-(s:Snippet)-[:IN_PUB]-(p:Publication)
                WITH
                    s,
                    p,
                    head(collect(r)) as sample_path,
                    coalesce(association.entry1_type, 'Unknown') as entry1_type,
                    coalesce(association.entry2_type, 'Unknown') as entry2_type,
                    from_id,
                    to_id,
                    description
                WITH
                    collect({snippet: s, publication: p, path: sample_path}) as references,
                    count({snippet: s, publication: p, path: sample_path}) as snippet_count,
                    entry1_type,
                    entry2_type,
                    from_id,
                    to_id,
                    description
                UNWIND references as reference
                WITH
                    entry1_type,
                    entry2_type,
                    {
                        snippet: {
                            id: reference.snippet.eid,
                            data: {
                                entry1_text: reference.path.entry1_text,
                                entry2_text: reference.path.entry2_text,
                                entry1_type: entry1_type,
                                entry2_type: entry2_type,
                                sentence: reference.snippet.sentence
                            }
                        },
                        publication: {
                            id: reference.publication.pmid,
                            data: {
                                journal: reference.publication.journal,
                                title: reference.publication.title,
                                pmid: reference.publication.pmid,
                                pub_year: reference.publication.pub_year
                            }
                        }
                    } AS reference,
                    snippet_count,
                    from_id,
                    to_id,
                    description
                ORDER BY
                    snippet_count DESC,
                    [from_id, to_id],
                    coalesce(reference.publication.data.pub_year, -1) DESC
                SKIP $skip LIMIT $limit
                RETURN collect(DISTINCT reference) AS references, from_id, to_id, description
                """,
                node_1_id=node_1_id, node_2_id=node_2_id, skip=skip, limit=limit
            )
        )

    def get_snippet_count_from_node_pair_query(
        self,
        tx: Neo4jTx,
        node_1_id: int,
        node_2_id: int
    ) -> Neo4jRecord:
        return tx.run(
            """
            MATCH (f)-[r:ASSOCIATED]-(t)
            WHERE
                ID(f)=$node_1_id AND
                ID(t)=$node_2_id
            WITH ID(startNode(r)) as from_id, ID(endNode(r)) as to_id
            MATCH (f)-[:HAS_ASSOCIATION]-(a:Association)-[:HAS_ASSOCIATION]-(t)
            WHERE ID(f)=from_id AND ID(t)=to_id
            WITH from_id, to_id, a AS association
            MATCH (association)<-[r:INDICATES]-(s:Snippet)-[:IN_PUB]-(p:Publication)
            RETURN
                count(DISTINCT {
                    from_id: from_id,
                    to_id: to_id,
                    description: association.description,
                    snippet_id: s.eid
                }) AS snippet_count
            """,
            node_1_id=node_1_id, node_2_id=node_2_id
        ).single()

    def get_snippet_count_from_edges_query(
        self,
        tx: Neo4jTx,
        from_ids: List[int],
        to_ids: List[int],
        description: str
    ) -> List[Neo4jRecord]:
        return list(
            tx.run(
                """
                MATCH (f)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(t)
                WHERE
                    ID(f) IN $from_ids AND
                    ID(t) IN $to_ids AND
                    a.description=$description
                WITH
                    a AS association,
                    ID(f) AS from_id,
                    ID(t) AS to_id,
                    labels(f) AS from_labels,
                    labels(t) AS to_labels
                OPTIONAL MATCH (association)<-[r:INDICATES]-(s:Snippet)-[:IN_PUB]-(p:Publication)
                WITH
                    count(DISTINCT {
                        description: association.description,
                        snippet_id: s.eid
                    }) AS snippet_count,
                    max(p.pub_year) AS max_pub_year,
                    from_id,
                    to_id,
                    from_labels,
                    to_labels
                ORDER BY snippet_count DESC, [from_id, to_id], coalesce(max_pub_year, -1) DESC
                RETURN from_id, to_id, from_labels, to_labels, snippet_count AS count
                """,
                from_ids=from_ids, to_ids=to_ids, description=description
            )
        )
