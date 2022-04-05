from biocyc.data_file_parser import DataFileParser
from common.graph_models import *


PROP_TRANS_DIRECTION = 'transcription_direction'
ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'ABSOLUTE-PLUS-1-POS': (PROP_POS_1, 'str'),
    'TRANSCRIPTION-DIRECTION': (PROP_STRAND, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}
REL_NAMES = {
}

class PromoterParser(DataFileParser):
    def __init__(self, db_name, tarfile):
        DataFileParser.__init__(self, db_name, tarfile, 'promoters.dat', NODE_PROMOTER,ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_POS_1, PROP_STRAND]




