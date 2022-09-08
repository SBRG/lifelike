from biocyc.data_file_parser import DataFileParser
from common.graph_models import *


PROP_TRANS_DIRECTION = 'transcription_direction'
ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    'REACTION-LIST': RelationshipType(REL_IN_PATHWAY, 'from', NODE_PROTEIN, PROP_BIOCYC_ID),
    'IN-PATHWAY': RelationshipType(REL_IN_PATHWAY, 'to', NODE_PATHWAY, PROP_BIOCYC_ID)
}

class PathwayParser(DataFileParser):
    def __init__(self, db_name, tarfile):
        DataFileParser.__init__(self, db_name, tarfile, 'pathways.dat', NODE_PATHWAY, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME]




