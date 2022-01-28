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
from enzyme.enzyme_parser import (
    ENZYME_FILE,
    ENZYME_SYNONYM_FILE,
    ENZYME_REL_FILE
)

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


class EnzymeChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        if initial_load:
            self.add_index_change_set()
        self.load_enzyme_nodes()
        self.load_enzyme_synonym_rels()
        self.load_enzyme_parent_rels()

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_ENZYME, PROP_ID, 'constraint_enzyme_id') + ';')
        queries.append(get_create_constraint_query(NODE_EC_NUMBER, PROP_ID, 'constraint_ecnumber_id') + ';')
        queries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name') + ';')
        queries.append(get_create_index_query(NODE_ENZYME, PROP_NAME, 'index_enzyme_name') + ';')
        queries.append(get_create_index_query(NODE_EC_NUMBER, PROP_NAME, 'index_ecnumber_name') + ';')
        return queries

    def add_index_change_set(self):
        id = f'Enzyme data initial load {self.date_tag}'
        comment = 'Create constraints and indexes for enzyme nodes'
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)

    def load_enzyme_nodes(self):
        id = f'Create Enzyme nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f''
        query = get_create_update_nodes_query(NODE_ENZYME, PROP_ID, [PROP_NAME, PROP_CODE, PROP_ACTIVITIES, PROP_COFACTORS], [NODE_EC_NUMBER], datasource='Enzyme')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{ENZYME_FILE}')
        self.change_sets.append(changeset)

    def load_enzyme_synonym_rels(self):
        id = f'Create enzyme and synonym rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_synonym_relationships_query(NODE_ENZYME, PROP_ID, PROP_ID, PROP_NAME)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{ENZYME_SYNONYM_FILE}')
        self.change_sets.append(changeset)

    def load_enzyme_parent_rels(self):
        id = f'Create enzyme to enzyme parent rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_ENZYME, PROP_ID, PROP_ID, NODE_ENZYME, PROP_ID, PROP_PARENT_ID, REL_PARENT)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{ENZYME_REL_FILE}')
        self.change_sets.append(changeset)

if __name__ == '__main__':
    task = EnzymeChangeLog('Binh Vu', 'LL-3217')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('enzyme_changelog.xml', directory)
