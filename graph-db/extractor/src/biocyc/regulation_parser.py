from biocyc.base_data_file_parser import BaseDataFileParser
from common.graph_models import *


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'MODE': (PROP_MODE, 'str'),
    'MECHANISM': (PROP_MECHANISM, 'str'),
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    'ASSOCIATED-BINDING-SITE': RelationshipType(REL_BIND, 'to', NODE_DNA_BINDING_SITE, PROP_BIOCYC_ID),
    'REGULATOR': RelationshipType(REL_REGULATE, 'from', DB_BIOCYC, PROP_BIOCYC_ID),
    'REGULATED-ENTITY': RelationshipType(REL_REGULATE, 'to', DB_BIOCYC, PROP_BIOCYC_ID)
}

class RegulationParser(BaseDataFileParser):
    def __init__(self, db_name, tarfile, base_data_dir):
        BaseDataFileParser.__init__(self, base_data_dir, db_name, tarfile, 'regulation.dat', NODE_REGULATION,ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_MODE, PROP_MECHANISM]




