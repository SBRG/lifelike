import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
from common.query_builder import *
from ncbi.ncbi_taxonomy_parser import *

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))

class NcbiTaxonomyChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        if initial_load:
            self.add_index_change_set()
        self.load_ncbi_taxonomy_nodes()
        self.load_ncbi_taxonomy_synonym_rels()
        self.load_ncbi_taxonomy_parent_rels()
        self.set_species_id()

    def load_ncbi_taxonomy_nodes(self):
        id = f'NCBI taxonomy data on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Load NCBI taxonomy nodes'
        query = get_create_update_nodes_query(NODE_TAXONOMY, PROP_ID, NODE_ATTRS, [NODE_NCBI], datasource='NCBI Taxonomy')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{NCBI_TAXONOMY_FILE}')
        self.change_sets.append(changeset)

    def load_ncbi_taxonomy_synonym_rels(self):
        id = f'load NCBI taxonomy synonym relationship on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Load NCBI gene taxonomy relationship'
        query = get_create_synonym_relationships_query(NODE_TAXONOMY, PROP_ID, PROP_ID, PROP_NAME, [PROP_TYPE])
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{NCBI_TAXONOMY_SYNONYM_FILE}')
        self.change_sets.append(changeset)

    def load_ncbi_taxonomy_parent_rels(self):
        id = f'create relationship between taxonomy and parent nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Taxonomy relationship with parent'
        query = """
        CALL apoc.periodic.iterate(
        'MATCH (n:Taxonomy), (m:Taxonomy) WHERE m.prop = n.parent_id RETURN n, m',
        'MERGE (n)-[:HAS_PARENT]->(m)', {batchSize:5000})
        """.replace('prop', PROP_ID)
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def set_species_id(self):
        id = f'set species_id for taxonomy nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Taxonomy needs species_id'
        query = f"MATCH (n:Taxonomy)-[:HAS_PARENT*0..]->(s:Taxonomy {{rank: 'species'}}) SET n.species_id = s.{PROP_ID}"
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_TAXONOMY, PROP_ID, 'constraint_taxonomy_id') + ';')
        queries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name') + ';')
        queries.append(get_create_index_query(NODE_TAXONOMY, PROP_NAME, 'index_taxonomy_name') + ';')
        queries.append(get_create_index_query(NODE_TAXONOMY, 'species_id', 'index_taxonomy_speciesid') + ';')
        return queries

    def add_index_change_set(self):
        id = f'create NCBI taxonomy constraints on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Create constraints and indexes for NCBI taxonomy nodes'
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = NcbiTaxonomyChangeLog('Binh Vu', 'LL-3212')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('ncbi_taxonomy_changelog.xml', directory)
