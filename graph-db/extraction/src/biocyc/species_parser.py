from biocyc.data_file_parser import DataFileParser
from common.constants import *
from common.graph_models import *


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'GENOME': (PROP_GENOME, 'str'),
    'TYPES': (PROP_TAX_ID, 'str'),
    'SEQUENCE-SOURCE': (PROP_SEQUENCE, 'str'),
    'STRAIN-NAME': (PROP_STRAIN_NAME, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str'),
}


class SpeciesParser(DataFileParser):
    def __init__(self, db_name, tarfile):
        DataFileParser.__init__(self, db_name, tarfile, 'species.dat', NODE_SPECIES, ATTR_NAMES, {})
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_GENOME, PROP_TAX_ID, PROP_STRAIN_NAME, PROP_SYNONYMS]

