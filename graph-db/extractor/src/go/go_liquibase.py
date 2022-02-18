import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
from common.query_builder import *
from go.go_parser import *

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))

# TODO: maybe better to parse the .tsv file in data/processed/go folder?
NAMESPACES = ['biological_process', 'molecular_function', 'cellular_component']
GO_EDGES = ['IS_A', 'PART_OF', 'REGULATES', 'HAS_PART', 'REPLACED_BY', 'NEGATIVELY_REGULATES', 'POSITIVELY_REGULATES', 'OCCURS_IN', 'HAPPENS_DURING', 'ENDS_DURING']


class GoChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        if initial_load:
            self.add_index_change_set()
        self.load_go_nodes()
        self.load_gosynonym_rels()
        self.load_gospecific_rels()

    def load_go_nodes(self):
        for ns in NAMESPACES:
            namespace_str = ns.title().replace('_', '')
            id = f'load GO {namespace_str} on date {self.date_tag}'
            if self.id_prefix:
                id = f'{self.id_prefix} {id}'
            comment = f'Load GO {namespace_str}'
            query = get_create_update_nodes_query(NODE_GO, PROP_ID, NODE_ATTRS, namespace_label=ns)
            changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{GO_FILE}')
            self.change_sets.append(changeset)

    def load_gosynonym_rels(self):
        id = f'load GO synonym on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f'Load GO synonym relationship'
        query = get_create_synonym_relationships_query(NODE_GO, PROP_ID, PROP_ID, PROP_NAME)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{GO_FILE}')
        self.change_sets.append(changeset)

    def load_gospecific_rels(self):
        for edge in GO_EDGES:
            id = f'load GO {edge} on date {self.date_tag}'
            if self.id_prefix:
                id = f'{self.id_prefix} {id}'
            comment = f'Load GO {edge} relationship'
            query = get_create_relationships_query(NODE_GO, PROP_ID, 'from_id', NODE_GO, PROP_ID, 'to_id', edge, foreach=True, foreach_property='relationship')
            changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{GO_RELATIONSHIP}')
            self.change_sets.append(changeset)

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_GO, PROP_ID, 'constraint_go_id') + ';')
        queries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name') + ';')
        queries.append(get_create_index_query(NODE_GO, PROP_NAME, 'index_go_name') + ';')
        return queries

    def add_index_change_set(self):
        id = f'GO data constraints on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = "Create constraints and indexes for GO nodes"
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = GoChangeLog('Binh Vu', 'LL-3213')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('go_changelog.xml', directory)
