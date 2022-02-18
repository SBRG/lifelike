from biocyc.base_data_file_parser import BaseDataFileParser
from common.graph_models import *
from common.query_builder import *
from common.database import Database
from common.constants import *
import logging

ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'ACCESSION-1': (PROP_ACCESSION, 'str'),
    'LEFT-END-POSITION': (PROP_POS_LEFT, 'str'),
    'RIGHT-END-POSITION': (PROP_POS_RIGHT, 'str'),
    'TRANSCRIPTION-DIRECTION':(PROP_STRAND, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}
REL_NAMES = {
    'DBLINKS': RelationshipType(REL_DBLINKS, 'to', NODE_DBLINK, PROP_REF_ID),
    # 'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    # 'PRODUCT': RelationshipType(REL_ENCODE, 'to', NODE_PROTEIN, PROP_BIOCYC_ID),
}
DB_LINK_SOURCES = {'NCBI-GENE':False}

class GeneParser(BaseDataFileParser):
    def __init__(self, db_name, tarfile, base_data_dir):
        BaseDataFileParser.__init__(self, base_data_dir,  db_name, tarfile, 'genes.dat', NODE_GENE,ATTR_NAMES, REL_NAMES, DB_LINK_SOURCES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_ACCESSION, PROP_POS_LEFT, PROP_POS_RIGHT,PROP_STRAND]
        self.logger = logging.getLogger(__name__)

    def create_synonym_rels(self) -> bool:
        return True

    def create_indexes(self, database: Database):
        BaseDataFileParser.create_indexes(database)
        database.create_index(NODE_GENE, PROP_ACCESSION, 'index_gene_accession')

    def add_dblinks_to_graphdb(self, db_link_dict:dict, database: Database, etl_load_id):
        no_of_created_relations = 0
        no_of_updated_relations = 0
        for db in db_link_dict.keys():
            self.logger.info("Add relationship links to " + db)
            if db == 'NCBI-GENE':
                dest_label = NODE_GENE
                relType = 'IS'
            else:
                dest_label = 'db_' + db
                relType = db.uppper() + '_LINK'
            query = get_create_relationships_query(NODE_BIOCYC, PROP_BIOCYC_ID, 'from_id',
                                                              dest_label, PROP_ID, 'to_id', relType, etl_load_id=etl_load_id, return_node_count=True)
            self.logger.debug(query)
            node_count, result_counters = database.load_data_from_rows(query, db_link_dict[db], return_node_count=True)
            no_of_created_relations += result_counters.relationships_created
            no_of_updated_relations += node_count - result_counters.relationships_created

        return no_of_created_relations, no_of_updated_relations