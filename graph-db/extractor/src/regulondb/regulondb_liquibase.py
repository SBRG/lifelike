import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
from common.query_builder import (
    get_create_constraint_query,
    get_create_index_query,
    get_create_relationships_query,
    get_create_update_nodes_query
)
from regulondb.regulondb_parser import (
    REGULON_D_FILE,
    REGULON_GENE_FILE,
    REGULON_OPERON_FILE,
    REGULON_PRODUCT_FILE,
    REGULON_PROMOTER_FILE,
    REGULON_TERMINATOR_FILE,
    REGULON_TRANSCRIPTION_FACTOR_FILE,
    REGULON_TRANSCRIPTION_UNIT_FILE,
    REGULON_PROMOTOR_TRANSUNIT_REL_FILE,
    REGULON_OPERON_TRANSUNIT_REL_FILE,
    REGULON_GENE_PRODUCT_REL_FILE,
    REGULON_REGULATES_REL_FILE,
    REGULON_PRODUCT_TRANSFACTOR_REL_FILE,
    REGULON_FUNC_PROMOTER_REGULATES_REL_FILE,
    REGULON_TRANSFACTOR_REL_FILE,
    REGULON_GENE_TRANSUNIT_REL_FILE,
    REGULON_TERMINATOR_TRANSUNIT_REL_FILE,
    REGULON_NCBI_GENE_REL_FILE
)

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


class RegulonChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        if initial_load:
            self.add_index_change_set()
        self.load_gene_nodes()
        self.load_operon_nodes()
        self.load_gene_product_nodes()
        self.load_promoter_nodes()
        self.load_regulon_nodes()
        self.load_terminator_nodes()
        self.load_transcription_factor_nodes()
        self.load_transcription_unit_nodes()
        self.load_promoter_transunit_rels()
        self.load_operon_transunit_rels()
        self.load_encodes_rels()
        self.load_regulates_rels()
        self.load_product_tf_rels()
        self.load_promoter_function_rels()
        self.load_regulon_tf_rels()
        self.load_gene_tu_rels()
        self.load_terminator_tu_rels()
        self.load_regulon_ncbi_rels()

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_REGULONDB, PROP_ID, 'constraint_regulondb_id') + ';')
        queries.append(get_create_index_query(NODE_REGULONDB, PROP_NAME, 'index_regulondb_name') + ';')
        return queries

    def add_index_change_set(self):
        id = f'RegulonDB data initial load {self.date_tag}'
        comment = "Create constraints and indexes for regulon nodes"
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)

    def load_gene_nodes(self):
        id = f'Create RegulonDB gene nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f'Property {PROP_REGULONDB_ID} is for backward compatibility in Lifelike, some queries uses it.'
        query = get_create_update_nodes_query(NODE_REGULONDB, PROP_ID, [PROP_REGULONDB_ID, PROP_NAME, PROP_POS_LEFT, PROP_POS_RIGHT, PROP_STRAND], [NODE_GENE], data_source='RegulonDB')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_GENE_FILE}')
        self.change_sets.append(changeset)

    def load_operon_nodes(self):
        id = f'Create RegulonDB operon nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f'Property {PROP_REGULONDB_ID} is for backward compatibility in Lifelike, some queries uses it.'
        query = get_create_update_nodes_query(NODE_REGULONDB, PROP_ID, [PROP_REGULONDB_ID, PROP_NAME, PROP_POS_LEFT, PROP_POS_RIGHT, PROP_STRAND], [NODE_OPERON], data_source='RegulonDB')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_OPERON_FILE}')
        self.change_sets.append(changeset)

    def load_gene_product_nodes(self):
        id = f'Create RegulonDB gene product nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f'Property {PROP_REGULONDB_ID} is for backward compatibility in Lifelike, some queries uses it.'
        query = get_create_update_nodes_query(NODE_REGULONDB, PROP_ID, [PROP_REGULONDB_ID, PROP_NAME, PROP_MOLECULAR_WEIGHT, PROP_LOCATION], [NODE_PRODUCT], data_source='RegulonDB')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_PRODUCT_FILE}')
        self.change_sets.append(changeset)

    def load_promoter_nodes(self):
        id = f'Create RegulonDB promoter nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f'Property {PROP_REGULONDB_ID} is for backward compatibility in Lifelike, some queries uses it.'
        query = get_create_update_nodes_query(NODE_REGULONDB, PROP_ID, [PROP_REGULONDB_ID, PROP_NAME, PROP_POS_1, PROP_SIGMA_FACTOR, PROP_SEQUENCE, PROP_STRAND], [NODE_PROMOTER], data_source='RegulonDB')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_PROMOTER_FILE}')
        self.change_sets.append(changeset)

    def load_regulon_nodes(self):
        id = f'Create RegulonDB nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f'Property {PROP_REGULONDB_ID} is for backward compatibility in Lifelike, some queries uses it.'
        query = get_create_update_nodes_query(NODE_REGULONDB, PROP_ID, [PROP_REGULONDB_ID, PROP_NAME, PROP_NUM_TFS], [NODE_REGULON], data_source='RegulonDB')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_D_FILE}')
        self.change_sets.append(changeset)

    def load_terminator_nodes(self):
        id = f'Create RegulonDB terminator nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f'Property {PROP_REGULONDB_ID} is for backward compatibility in Lifelike, some queries uses it.'
        query = get_create_update_nodes_query(NODE_REGULONDB, PROP_ID, [PROP_REGULONDB_ID, PROP_POS_LEFT, PROP_POS_RIGHT, PROP_TERMINATOR_CLASS, PROP_SEQUENCE], [NODE_TERMINATOR], data_source='RegulonDB')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_TERMINATOR_FILE}')
        self.change_sets.append(changeset)

    def load_transcription_factor_nodes(self):
        id = f'Create RegulonDB transcription factor nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f'Property {PROP_REGULONDB_ID} is for backward compatibility in Lifelike, some queries uses it.'
        query = get_create_update_nodes_query(NODE_REGULONDB, PROP_ID, [PROP_REGULONDB_ID, PROP_NAME, PROP_REGULATORY_FAMILY], [NODE_TRANS_FACTOR], data_source='RegulonDB')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_TRANSCRIPTION_FACTOR_FILE}')
        self.change_sets.append(changeset)

    def load_transcription_unit_nodes(self):
        id = f'Create RegulonDB transcription unit nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f'Property {PROP_REGULONDB_ID} is for backward compatibility in Lifelike, some queries uses it.'
        query = get_create_update_nodes_query(NODE_REGULONDB, PROP_ID, [PROP_REGULONDB_ID, PROP_NAME, PROP_COMMENT], [NODE_TRANS_UNIT], data_source='RegulonDB')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_TRANSCRIPTION_UNIT_FILE}')
        self.change_sets.append(changeset)

    def load_promoter_transunit_rels(self):
        id = f'Create RegulonDB promoter transcription unit rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_REGULONDB, PROP_ID, 'promoter_id',
            NODE_REGULONDB, PROP_ID, 'transcription_unit_id', REL_IS_ELEMENT)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_PROMOTOR_TRANSUNIT_REL_FILE}')
        self.change_sets.append(changeset)

    def load_operon_transunit_rels(self):
        id = f'Create RegulonDB operon transcription unit rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_REGULONDB, PROP_ID, 'transcription_unit_id',
            NODE_REGULONDB, PROP_ID, 'operon_id', REL_IS_ELEMENT)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_OPERON_TRANSUNIT_REL_FILE}')
        self.change_sets.append(changeset)

    def load_encodes_rels(self):
        id = f'Create RegulonDB encodes rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_REGULONDB, PROP_ID, 'gene_id', NODE_REGULONDB, PROP_ID, 'product_id', REL_ENCODE)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_GENE_PRODUCT_REL_FILE}')
        self.change_sets.append(changeset)

    def load_regulates_rels(self):
        id = f'Create RegulonDB regulates rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_REGULONDB, PROP_ID, 'regulator_id', NODE_REGULONDB, PROP_ID, 'regulated_id',
            REL_REGULATE, rel_properties=['regulator_id', 'regulated_id', 'function', 'evidence'])
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_REGULATES_REL_FILE}')
        self.change_sets.append(changeset)

    def load_product_tf_rels(self):
        id = f'Create RegulonDB product transfactor rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_REGULONDB, PROP_ID, 'product_id', NODE_REGULONDB, PROP_ID, 'transcript_factor_id', REL_IS_COMPONENT)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_PRODUCT_TRANSFACTOR_REL_FILE}')
        self.change_sets.append(changeset)

    def load_promoter_function_rels(self):
        id = f'Create RegulonDB promoter function rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_REGULONDB, PROP_ID, 'regulon_id', NODE_REGULONDB, PROP_ID, 'promoter_id',
            REL_REGULATE, rel_properties=[PROP_FUNCTION])
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_FUNC_PROMOTER_REGULATES_REL_FILE}')
        self.change_sets.append(changeset)

    def load_regulon_tf_rels(self):
        id = f'Create RegulonDB transcription factor rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_REGULONDB, PROP_ID, 'transcript_factor_id', NODE_REGULONDB, PROP_ID, 'regulon_id', REL_IS_COMPONENT)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_TRANSFACTOR_REL_FILE}')
        self.change_sets.append(changeset)

    def load_gene_tu_rels(self):
        id = f'Create RegulonDB gene transcription unit rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_REGULONDB, PROP_ID, 'gene_id', NODE_REGULONDB, PROP_ID, 'transcription_unit_id', REL_IS_ELEMENT)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_GENE_TRANSUNIT_REL_FILE}')
        self.change_sets.append(changeset)

    def load_terminator_tu_rels(self):
        id = f'Create RegulonDB terminator transcription unit rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_REGULONDB, PROP_ID, 'terminator_id', NODE_REGULONDB, PROP_ID, 'transcription_unit_id', REL_IS_ELEMENT)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_TERMINATOR_TRANSUNIT_REL_FILE}')
        self.change_sets.append(changeset)

    def load_regulon_ncbi_rels(self):
        id = f'Create RegulonDB NCBI gene rels on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_REGULONDB, PROP_ID, 'regulon_id', NODE_GENE, PROP_LOCUS_TAG, PROP_LOCUS_TAG, REL_IS)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{REGULON_NCBI_GENE_REL_FILE}')
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = RegulonChangeLog('Binh Vu', 'LL-3218')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('regulon_changelog.xml', directory)
