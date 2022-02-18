from biocyc.base_data_file_parser import BaseDataFileParser
from common.graph_models import *

ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str'),
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
}

FRAMES = 'FRAMES'

class ClassParser(BaseDataFileParser):
    """
    The classes.dat file contains list of terms for biocyc classification, including some go terms and taxonomy.
    """
    def __init__(self, db_name, tarfile, base_data_dir):
        BaseDataFileParser.__init__(self, base_data_dir, db_name, tarfile, 'classes.dat', NODE_CLASS, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_SYNONYMS]

    def create_synonym_rels(self) -> bool:
        return False

    def parse_data_file(self):
        nodes = BaseDataFileParser.parse_data_file(self)
        mynodes = []
        for node in nodes:
            # skip GO terms, Taxonomy terms, Organims
            if node.get_attribute(PROP_BIOCYC_ID).startswith('GO:') or \
                    node.get_attribute(PROP_BIOCYC_ID).startswith('TAX-') or \
                    node.get_attribute(PROP_BIOCYC_ID).startswith('ORG-'):
                continue
            mynodes.append(node)
            # Skip relationships of type FRAMES, since there is no biocyc id 'FRAMES'
            edges = set(node.edges)
            for edge in edges:
                if edge.label == REL_TYPE:
                    if edge.dest.get_attribute(PROP_BIOCYC_ID) == FRAMES or edge.source.get_attribute(PROP_BIOCYC_ID)==FRAMES:
                        node.edges.remove(edge)
        return mynodes


