import re

from flask import current_app
from neo4j import Record as N4jRecord, Transaction as Neo4jTx
from typing import Any, Dict, List

from neo4japp.constants import LogEventType
from neo4japp.data_transfer_objects import (
    FTSQueryRecord,
    FTSResult,
    FTSTaxonomyRecord
)
from neo4japp.models import GraphNode
from neo4japp.services.common import GraphBaseDao
from neo4japp.util import (
    get_first_known_label_from_list,
    get_known_domain_labels_from_list,
    normalize_str,
    snake_to_camel_dict
)
from neo4japp.utils.logger import EventLog


class SearchService(GraphBaseDao):

    def __init__(self, graph):
        super().__init__(graph)

    def _fulltext_query_sanitizer(self, query):
        """ Ensures the query is syntactically correct
        and safe from cypher injections for Neo4j full
        text search.

        Special characters in Lucene
        + - && || ! ( ) { } [ ] ^ " ~ * ? : \\ /
        See docs: http://lucene.apache.org/ for more information
        We will escape these characters with a forward ( \\ ) slash
        """
        lucene_chars = re.compile(r'([\+\-\&\|!\(\)\{\}\[\]\^"~\*\?:\/])')

        def escape(m):
            """ Adds an escape '\' to reserved Lucene characters"""
            char = m.group(1)
            return r'\{c}'.format(c=char)

        query = re.sub(lucene_chars, escape, query).strip()
        if not query:
            return query

        # Wrap the query in backticks, doubling existing backticks. This effectively escapes the
        # query input.
        return f"`{query.replace('`', '``')}`"

    def predictive_search(self, term: str, limit: int = 5):
        """ Performs a predictive search; not necessarily a prefix based autocomplete.
        # TODO: FIX the search algorithm to perform a proper prefix based autocomplete"""
        raise NotImplementedError

    def _visualizer_search_result_formatter(self, result: List[N4jRecord]) -> List[FTSQueryRecord]:
        formatted_results: List[FTSQueryRecord] = []
        for record in result:
            entity = record['entity']
            literature_id = record['literature_id']
            taxonomy_id = record.get('taxonomy_id', '')
            taxonomy_name = record.get('taxonomy_name', '')
            go_class = record.get('go_class', '')

            try:
                entity_label = get_first_known_label_from_list(entity["labels"])
            except ValueError:
                current_app.logger.warning(
                    f'Node with ID {entity["id"]} had an unexpected list of labels: ' +
                    f'{entity["labels"]}',
                    extra=EventLog(event_type=LogEventType.KNOWLEDGE_GRAPH.value).to_dict()
                )
                entity_label = 'Unknown'

            graph_node = GraphNode(
                # When it exists, we use the literature node ID instead so the node can be expanded
                # in the visualizer
                id=literature_id or entity['id'],
                label=entity_label,
                sub_labels=entity['labels'],
                domain_labels=(
                    get_known_domain_labels_from_list(entity['labels']) +
                    (['Literature'] if literature_id is not None else [])
                ),
                display_name=entity['name'],
                data=snake_to_camel_dict(entity['data'], {}),
                url=None,
            )
            formatted_results.append(FTSTaxonomyRecord(
                node=graph_node,
                taxonomy_id=taxonomy_id if taxonomy_id is not None
                else 'N/A',
                taxonomy_name=taxonomy_name if taxonomy_name is not None
                else 'N/A',
                go_class=go_class if go_class is not None
                else 'N/A'
            ))
        return formatted_results

    def sanitize_filter(
        self,
        domains: List[str],
        entities: List[str],
    ):
        domains_map = {
            'chebi': 'n:db_CHEBI',
            'go': 'n:db_GO',
            'mesh': 'n:db_MESH',
            'ncbi': 'n:db_NCBI',
            'uniprot': 'n:db_UniProt'
        }
        entities_map = {
            'biologicalprocess': 'n:BiologicalProcess',
            'cellularcomponent': 'n:CellularComponent',
            'chemical': 'n:Chemical',
            'disease': 'n:Disease',
            'gene': 'n:Gene',
            'molecularfunction': 'n:MolecularFunction',
            'protein': 'n:Protein',
            'taxonomy': 'n:Taxonomy'
        }
        result_domains = []
        result_entities = []

        # NOTE: If the user supplies an entity/domain that *isn't* in these maps,
        # they may get unexpected results! We essentially silently ignore any
        # unexpected values in favor of getting *some* results back.

        for domain in domains:
            normalized_domain = normalize_str(domain)
            if normalized_domain in domains_map:
                result_domains.append(domains_map[normalized_domain])
            else:
                current_app.logger.info(
                    f'Found an unexpected value in `domains` list: {domain}',
                    extra=EventLog(event_type=LogEventType.VISUALIZER_SEARCH.value).to_dict()
                )

        for entity in entities:
            normalized_entity = normalize_str(entity)
            if normalized_entity in entities_map:
                result_entities.append(entities_map[normalized_entity])
            else:
                current_app.logger.info(
                    f'Found an unexpected value in `entities` list: {entity}',
                    extra=EventLog(event_type=LogEventType.VISUALIZER_SEARCH.value).to_dict()
                )

        # If the domain list or entity list provided by the user is empty, then assume ALL
        # domains/entities should be used.
        result_domains = result_domains if len(result_domains) > 0 else [val for val in domains_map.values()]  # noqa
        result_entities = result_entities if len(result_entities) > 0 else [val for val in entities_map.values()]  # noqa

        return f'({" OR ".join(result_domains)}) AND ({" OR ".join(result_entities)})'

    def visualizer_search(
        self,
        term: str,
        organism: str,
        domains: List[str],
        entities: List[str],
        page: int = 1,
        limit: int = 10,
    ) -> FTSResult:
        if not term:
            return FTSResult(term, [], 0, page, limit)

        if organism:
            organism_match_string = 'MATCH (n)-[:HAS_TAXONOMY]-(t:Taxonomy {eid: $organism})'
        else:
            organism_match_string = 'OPTIONAL MATCH (n)-[:HAS_TAXONOMY]-(t:Taxonomy)'

        result_filters = self.sanitize_filter(domains, entities)

        literature_in_selected_domains = any([
            normalize_str(domain) == 'literature'
            for domain in domains
        ])
        # Return nodes in one or more domains, with mapped Literature data (if it exists)
        if domains == [] or (len(domains) > 1 and literature_in_selected_domains):
            literature_match_string = """
                WITH n, t, n.namespace as go_class
                OPTIONAL MATCH (n)<-[:MAPPED_TO]-(m:LiteratureEntity)
            """
        # Return nodes in one or more domains, and *exclude* Literature data from the result
        elif not literature_in_selected_domains:
            literature_match_string = """
                WITH n, t, n.namespace as go_class, NULL as m
            """
        # Return only nodes mapped to Literature nodes
        else:
            literature_match_string = """
                WITH n, t, n.namespace as go_class
                MATCH (n)<-[:MAPPED_TO]-(m:LiteratureEntity)
            """

        result = self.graph.read_transaction(
            self.visualizer_search_query,
            term,
            organism,
            (page - 1) * limit,
            limit,
            result_filters,
            organism_match_string,
            literature_match_string
        )

        records = self._visualizer_search_result_formatter(result)

        total_results = len(
            self.graph.read_transaction(
                self.visualizer_search_query,
                term,
                organism,
                0,
                1001,
                result_filters,
                organism_match_string,
                literature_match_string
            )
        )

        return FTSResult(term, records, total_results, page, limit)

    def get_organism_with_tax_id(self, tax_id: str):
        result = self.graph.read_transaction(self.get_organism_with_tax_id_query, tax_id)
        return result[0] if len(result) else None

    def get_organisms(self, term: str, limit: int) -> Dict[str, Any]:
        query_term = self._fulltext_query_sanitizer(term)
        if not query_term:
            return {
                'limit': limit,
                'nodes': [],
                'query': query_term,
                'total': 0,
            }

        terms = query_term.split(' ')
        query_term = ' AND '.join(terms)
        nodes = self.graph.read_transaction(self.get_organisms_query, query_term, limit)

        return {
            'limit': limit,
            'nodes': nodes,
            'query': query_term,
            'total': len(nodes),
        }

    def get_synonyms(
        self,
        search_term: str,
        organisms: List[str],
        types: List[str],
        page: int,
        limit: int
    ) -> List[dict]:
        results = self.graph.read_transaction(
            self.get_synonyms_query,
            search_term,
            organisms,
            types,
            page,
            limit
        )
        synonym_data = []

        for row in results:
            try:
                type = get_first_known_label_from_list(row['entity_labels'])
            except ValueError:
                type = 'Unknown'
                current_app.logger.warning(
                    f"Node had an unexpected list of labels: {row['entity_labels']}",
                    extra=EventLog(event_type=LogEventType.KNOWLEDGE_GRAPH.value).to_dict()
                )

            synonym_data.append({
                'type': type,
                'name': row['entity_name'],
                'organism': row['taxonomy_name'],
                'synonyms': row['synonyms'],
            })
        return synonym_data

    def get_synonyms_count(
        self,
        search_term: str,
        organisms: List[str],
        types: List[str]
    ) -> List[dict]:
        results = self.graph.read_transaction(
            self.get_synonyms_count_query,
            search_term,
            organisms,
            types
        )
        return results[0]['count']

    def visualizer_search_query(
        self,
        tx: Neo4jTx,
        search_term: str,
        organism: str,
        amount: int,
        limit: int,
        result_filters: str,
        organism_match_string: str,
        literature_match_string: str
    ) -> List[N4jRecord]:
        """Need to collect synonyms because a gene node can have multiple
        synonyms. So it is possible to send duplicate internal node ids to
        a later query."""
        return [
            record for record in tx.run(
                f"""
                CALL db.index.fulltext.queryNodes("synonymIdx", $search_term)
                YIELD node
                MATCH (node)-[]-(n)
                WHERE {result_filters}
                WITH n
                {organism_match_string}
                {literature_match_string}
                WITH
                {{
                    id: id(n),
                    name: n.name,
                    labels: labels(n),
                    data: {{
                        eid: n.eid,
                        data_source: n.data_source
                    }}
                }} as entity, id(m) as literature_id, t, go_class
                RETURN DISTINCT entity, literature_id, t.eid AS taxonomy_id,
                    t.name AS taxonomy_name, go_class AS go_class
                SKIP $amount
                LIMIT $limit
                """,
                search_term=search_term, organism=organism, amount=amount, limit=limit
            )
            # IMPORTANT: We do NOT use `data` here, because if we did we would lose some metadata
            # attached to the `node` return value. We need this metadata to deterimine node labels.
            # TODO: Should create a helper function that produces key-value pair records for all
            # Neo4j driver data types, so we don't have to selectively use `data`.
        ]

    def get_organism_with_tax_id_query(self, tx: Neo4jTx, tax_id: str) -> List[Dict]:
        return [
            record for record in tx.run(
                """
                MATCH (t:Taxonomy {eid: $tax_id})
                RETURN t.eid AS tax_id, t.name AS organism_name
                """,
                tax_id=tax_id
            ).data()
        ]

    def get_organisms_query(self, tx: Neo4jTx, term: str, limit: int) -> List[Dict]:
        return [
            record for record in tx.run(
                """
                CALL db.index.fulltext.queryNodes("synonymIdx", $term)
                YIELD node, score
                MATCH (node)-[]-(t:Taxonomy)
                with t, collect(node.name) as synonyms LIMIT $limit
                RETURN t.eid AS tax_id, t.name AS organism_name, synonyms[0] AS synonym
                """,
                term=term, limit=limit
            ).data()
        ]

    def get_synonyms_query(
        self,
        tx: Neo4jTx,
        search_term: str,
        organisms: List[str],
        types: List[str],
        page: int,
        limit: int
    ) -> List[N4jRecord]:
        """
        Gets a list of synoynm data for a given search term. Data includes any matched entities, as
        well as any linked organism, if there is one.
        """
        type_match_str = ''
        if len(types):
            type_match_str = ' AND any(x IN $types WHERE x IN labels(entity))'

        tax_match_str = 'OPTIONAL MATCH (entity)-[:HAS_TAXONOMY]-(t:Taxonomy)'
        if len(organisms):
            tax_match_str = 'MATCH (entity)-[:HAS_TAXONOMY]-(t:Taxonomy) WHERE t.eid IN $organisms'

        return list(
            tx.run(
                f"""
                MATCH (synonym:Synonym {{lowercase_name: toLower($search_term)}})
                    <-[:HAS_SYNONYM]-(entity)
                WHERE NOT 'Protein' IN labels(entity){type_match_str}
                MATCH (entity)-[:HAS_SYNONYM]->(synonyms)
                WHERE
                    size(synonyms.name) > 2 OR
                    any(x IN ['Chemical', 'Compound'] WHERE x IN labels(entity))
                WITH
                    entity,
                    synonyms.name AS synonyms,
                    toLower(entity.name) = toLower($search_term) AS matches_term
                ORDER BY size(synonyms) DESC
                {tax_match_str}
                RETURN
                    entity.name as entity_name,
                    t.name as taxonomy_name,
                    labels(entity) as entity_labels,
                    collect(DISTINCT synonyms) AS synonyms,
                    COUNT(DISTINCT synonyms) AS synonym_count,
                    matches_term
                ORDER BY matches_term DESC
                SKIP $page
                LIMIT $limit
                """,
                search_term=search_term,
                organisms=organisms,
                types=types,
                page=page,
                limit=limit
            )
        )

    def get_synonyms_count_query(
        self,
        tx: Neo4jTx,
        search_term: str,
        organisms: List[str],
        types: List[str]
    ) -> List[N4jRecord]:
        """
        Gets the count of synoynm data for a given search term.
        """
        type_match_str = ''
        if len(types):
            type_match_str = ' AND all(x IN $types WHERE x IN labels(entity))'

        tax_match_str = ''
        if len(organisms):
            tax_match_str = 'MATCH (entity)-[:HAS_TAXONOMY]-(t:Taxonomy) WHERE t.eid IN $organisms'

        return tx.run(
            f"""
            MATCH (synonym:Synonym {{lowercase_name: toLower($search_term)}})
                <-[:HAS_SYNONYM]-(entity)
            WHERE NOT 'Protein' IN labels(entity){type_match_str}
            MATCH (entity)-[:HAS_SYNONYM]->(synonyms)
            WHERE
                size(synonyms.name) > 2 OR
                any(x IN labels(entity) WHERE x IN ['Chemical', 'Compound'])
            {tax_match_str}
            RETURN count(DISTINCT entity) AS count
            """,
            search_term=search_term,
            organisms=organisms,
            types=types
        ).data()
