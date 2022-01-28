from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *
from common.graph_models import *


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'ABBREV-NAME': (PROP_ABBREV_NAME, 'str'),
    'MOLECULAR-WEIGHT-KD': (PROP_MOL_WEIGHT_KD, 'str'),
    'PI': (PROP_PI, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str'),
    'LOCATIONS': (PROP_LOCATION, 'str'),
    'GO-TERMS': (DB_GO, 'str')
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    'COMPONENTS': RelationshipType(REL_IS_COMPONENT, 'from', NODE_PROTEIN, PROP_BIOCYC_ID),
    'GENE': RelationshipType(REL_ENCODE, 'from', NODE_GENE, PROP_BIOCYC_ID),
    'MODIFIED-FORM': RelationshipType(REL_MODIFIED_TO, 'to', NODE_PROTEIN, PROP_BIOCYC_ID)
}

DB_LINK_SOURCES = {DB_GO: True}

POLYPEPTIDES = 'Polypeptides'
MODIFIED_PROTEINS = 'Modified-Proteins'
COMPLEXES = 'Complexes'

class ProteinParser(BaseDataFileParser):
    def __init__(self, db_name, tarfile, base_data_dir):
        BaseDataFileParser.__init__(self, base_data_dir,  db_name, tarfile, 'proteins.dat', NODE_PROTEIN,ATTR_NAMES, REL_NAMES, DB_LINK_SOURCES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_ABBREV_NAME, PROP_MOL_WEIGHT_KD, PROP_PI]

    def create_synonym_rels(self) -> bool:
        return True

    def parse_data_file(self):
        """
        protligandcplxes.dat contains protein complex data. However, the information were mostly also in proteins.dat.
        In case there is any additional information.  In additiona, the 'TYPE_OF' relationship for general type
        (e.g. polyperptide, modified protein, complex) were removed since we don't have a use case to use them now and
        it made the relationships more complicated.  Those can be added later if needed by deleting the code for edge removing.
        """
        nodes = BaseDataFileParser.parse_data_file(self)
        self.datafile = 'protligandcplxes.dat'
        nodes2 = BaseDataFileParser.parse_data_file(self)
        if nodes2:
            nodes = nodes + nodes2
        for node in nodes:
            go_id_str = node.get_attribute(DB_GO)
            if go_id_str:
                go_ids = go_id_str.split('|')
                for go in go_ids:
                    self.add_dblink(node, DB_GO, go)
            ## remove general protein type from type_of relationship
            edges = set(node.edges)
            for edge in edges:
                if edge.label == REL_TYPE:
                    if edge.dest.get_attribute(PROP_BIOCYC_ID)== POLYPEPTIDES:
                        node.edges.remove(edge)
                    elif edge.dest.get_attribute(PROP_BIOCYC_ID)==MODIFIED_PROTEINS:
                        node.edges.remove(edge)
                        for e in edges:
                            if e.label == REL_ENCODE:
                                # make sure encode points to the original peptide only
                                node.edges.remove(e)
                    elif edge.dest.get_attribute(PROP_BIOCYC_ID).endswith(COMPLEXES):
                        node.add_label([NODE_COMPLEX])
                        node.edges.remove(edge)
        return nodes



