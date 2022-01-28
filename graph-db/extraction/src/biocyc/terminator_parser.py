from biocyc.base_data_file_parser import BaseDataFileParser
from common.graph_models import *


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'LEFT-END-POSITION': (PROP_POS_LEFT, 'str'),
    'RIGHT-END-POSITION': (PROP_POS_RIGHT, 'str'),
}
REL_NAMES = {
}

class TerminatorParser(BaseDataFileParser):
    def __init__(self, db_name, tarfile, base_data_dir):
        BaseDataFileParser.__init__(self, base_data_dir, db_name, tarfile, 'terminators.dat', NODE_TERMINATOR,ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_ACCESSION, PROP_POS_LEFT, PROP_POS_RIGHT,PROP_STRAND]

    def create_synonym_rels(self) -> bool:
        return False


