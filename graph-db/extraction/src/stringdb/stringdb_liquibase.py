import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
from common.query_builder import (
    get_create_constraint_query,
    get_create_index_query,
    get_create_relationships_query,
    get_create_synonym_relationships_query,
    get_create_update_nodes_query
)
from stringdb.stringdb_parser import STRING_FILE, STRING2GENE_FILE

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


class StringDBChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        if initial_load:
            self.add_index_change_set()
        self.load_stringdb_data()
        self.load_stringdb_synonym_rels()
        self.load_stringdb_gene_rels()

    def load_stringdb_data(self):
        id = f'load Stringdb on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        headers = [PROP_ID, PROP_NAME, 'protein_size', 'annotation', 'tax_id', 'refseq']
        query = get_create_update_nodes_query(NODE_STRING, PROP_ID, headers, [NODE_PROTEIN], datasource=DB_STRING, original_entity_types=[NODE_PROTEIN])
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{STRING_FILE}')
        self.change_sets.append(changeset)

    def load_stringdb_synonym_rels(self):
        id = f'load Stringdb synonym rel on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_synonym_relationships_query(NODE_STRING, PROP_ID, PROP_ID, PROP_NAME)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{STRING_FILE}')
        self.change_sets.append(changeset)

    def load_stringdb_gene_rels(self):
        id = f'load Stringdb-Gene rel on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_STRING, PROP_ID, PROP_ID, NODE_GO, PROP_ID, 'gene_id', REL_GENE)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{STRING2GENE_FILE}')
        self.change_sets.append(changeset)

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_STRING, PROP_ID, 'constraint_string_id') + ';')
        return queries

    def add_index_change_set(self):
        id = f'load Stringdb constraints on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Create constraints and indexes for Stringdb data'
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = StringDBChangeLog('Binh Vu', 'LL-3215')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('stringdb_changelog.xml', directory)
