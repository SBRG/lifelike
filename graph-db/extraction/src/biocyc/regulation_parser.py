from biocyc.data_file_parser import DataFileParser
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

class RegulationParser(DataFileParser):
    def __init__(self, db_name, tarfile):
        DataFileParser.__init__(self, db_name, tarfile, 'regulation.dat', NODE_REGULATION,ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_MODE, PROP_MECHANISM]

    def write_synonyms_file(self, nodes, outfile):
        return None

