import os
from datetime import datetime

from common.query_builder import (
    get_create_constraint_query,
    get_create_index_query,
    get_create_relationships_query,
    get_create_synonym_relationships_query,
    get_create_update_nodes_query
)
from common.constants import *
from common.liquibase_utils import *
from mesh.mesh_parser import (
    MESH_CHEMICAL_FILE,
    MESH_CHEMICAL_TOPICALDESC_REL_FILE,
    MESH_DISEASE_FILE,
    MESH_DISEASE_TOPICALDESC_REL_FILE,
    MESH_SYNONYM_REL_FILE,
    MESH_TREENUMBER_FILE,
    MESH_TREENUMBER_PARENT_REL_FILE,
    MESH_TREENUMBER_TOPICALDESC_REL_FILE,
    MESH_TOPICALDESC_FILE
)

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))

class MeshChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        # # first need to load MeSH RDF file
        # # this is seeded into a temp db because the RDF schema
        # # is complex, so we let neo4j do it for us
        # self.create_meshdb()
        # self.load_mesh_rdf()

        if initial_load:
            self.add_index_change_set()
        self.load_treenumber_nodes()
        self.load_treenumber_parent_rels()
        self.load_topicaldescriptor_nodes()
        self.load_treenumber_topicaldesc_rels()
        self.load_mesh_chemical_nodes()
        self.load_mesh_chemical_topicaldesc_rels()
        self.load_mesh_disease_nodes()
        self.load_mesh_disease_topicaldesc_rels()

    # def create_meshdb(self):
    #     id = f'Create empty MeSH db to load RDF data on date {self.date_tag}'
    #     comment = 'Let Neo4j handle the parsing of RDF using neosemantic'
    #     queries = []
    #     queries.append('CREATE OR REPLACE DATABASE meshdb;')
    #     queries.append(':use meshdb;')
    #     queries.append(get_create_constraint_query('Resource', 'uri', 'constraint_uri') + ';')
    #     query_str = '\n'.join(queries)
    #     changeset = ChangeSet(id, self.author, comment, query_str)
    #     self.change_sets.append(changeset)

    # def load_mesh_rdf(self):
    #     id = f'Load RDF data into the empty MeSH db on date {self.date_tag}'
    #     comment = 'Let Neo4j handle the parsing of RDF using neosemantic'
    #     queries = []
    #     queries.append(':use meshdb;')
    #     queries.append('CALL n10s.graphconfig.init();')
    #     queries.append("""
    #     CALL n10s.graphconfig.set({
    #         handleVocabUris: 'IGNORE',
    #         handleMultival: 'ARRAY',
    #         multivalPropList : ['http://id.nlm.nih.gov/mesh/vocab#altLabel']
    #     });
    #     """)
    #     queries.append("CALL n10s.rdf.import.fetch('https://nlmpubs.nlm.nih.gov/projects/mesh/rdf/mesh.nt', 'N-Triples');")
    #     query_str = '\n'.join(queries)
    #     changeset = ChangeSet(id, self.author, comment, query_str)
    #     self.change_sets.append(changeset)

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_MESH, PROP_ID, 'constraint_mesh_id') + ';')
        queries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME, 'constraint_ecnumber_id') + ';')
        queries.append(get_create_index_query(NODE_MESH, PROP_NAME, 'index_mesh_name') + ';')
        return queries

    def add_index_change_set(self):
        id = f'MeSH data initial load {self.date_tag}'
        comment = "Create constraints and indexes for MeSH nodes"
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)

    def load_treenumber_nodes(self):
        id = f'Create MeSH treenumbers nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f''
        query = get_create_update_nodes_query(NODE_MESH, PROP_ID, [PROP_OBSOLETE], [NODE_TREENUMBER], datasource='MeSH')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{MESH_TREENUMBER_FILE}')
        self.change_sets.append(changeset)

    def load_treenumber_parent_rels(self):
        id = f'Create MeSH treenumber-treenumber parent rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID, PROP_PARENT_ID, REL_PARENT)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{MESH_TREENUMBER_PARENT_REL_FILE}')
        self.change_sets.append(changeset)

    def load_topicaldescriptor_nodes(self):
        id = f'Create MeSH topical descriptor nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f''
        query = get_create_update_nodes_query(NODE_MESH, PROP_ID, [PROP_NAME, PROP_OBSOLETE], [NODE_TOPICALDESC], datasource='MeSH')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{MESH_TOPICALDESC_FILE}')
        self.change_sets.append(changeset)

    def load_treenumber_topicaldesc_rels(self):
        id = f'Create MeSH treenumber-topicaldescriptor rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID, 'treenumber', REL_TREENUMBER)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{MESH_TREENUMBER_TOPICALDESC_REL_FILE}')
        self.change_sets.append(changeset)

    def load_mesh_chemical_nodes(self):
        id = f'Create MeSH chemical nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f''
        query = get_create_update_nodes_query(NODE_MESH, PROP_ID, [PROP_NAME, PROP_OBSOLETE], [NODE_CHEMICAL], datasource='MeSH')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{MESH_CHEMICAL_FILE}')
        self.change_sets.append(changeset)

    def load_mesh_chemical_topicaldesc_rels(self):
        id = f'Create MeSH chemical-topicaldescriptor rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID, 'descriptor_id', REL_MAPPED_TO_DESCRIPTOR, [PROP_TYPE])
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{MESH_CHEMICAL_TOPICALDESC_REL_FILE}')
        self.change_sets.append(changeset)

    def load_mesh_disease_nodes(self):
        id = f'Create MeSH disease nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f''
        query = get_create_update_nodes_query(NODE_MESH, PROP_ID, [PROP_NAME, PROP_OBSOLETE], [NODE_DISEASE], datasource='MeSH')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{MESH_DISEASE_FILE}')
        self.change_sets.append(changeset)

    def load_mesh_disease_topicaldesc_rels(self):
        id = f'Create MeSH disease-topicaldescriptor rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID, 'descriptor_id', REL_MAPPED_TO_DESCRIPTOR, [PROP_TYPE])
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{MESH_DISEASE_TOPICALDESC_REL_FILE}')
        self.change_sets.append(changeset)

    def load_mesh_synonym_rels(self):
        id = f'Create MeSH-synonym rels rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_synonym_relationships_query(NODE_MESH, PROP_ID, PROP_ID, PROP_NAME)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{MESH_SYNONYM_REL_FILE}')
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = MeshChangeLog('Binh Vu', 'LL-3214')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('mesh_changelog.xml', directory)
