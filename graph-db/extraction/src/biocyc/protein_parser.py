from biocyc.data_file_parser import DataFileParser
from common.constants import *
from common.graph_models import *
import pandas as pd

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

# True indicate that the dblink id has prefix, eg. GO:1234.  In lifelike, we only use the id, no prefix
DB_LINK_SOURCES = {DB_GO: False}

POLYPEPTIDES = 'Polypeptides'
MODIFIED_PROTEINS = 'Modified-Proteins'
COMPLEXES = 'Complexes'

class ProteinParser(DataFileParser):
    def __init__(self, db_name, tarfile):
        DataFileParser.__init__(self, db_name, tarfile, 'proteins.dat', NODE_PROTEIN,ATTR_NAMES, REL_NAMES, DB_LINK_SOURCES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_ABBREV_NAME, PROP_MOL_WEIGHT_KD, PROP_PI]

    def parse_data_file(self):
        """
        protligandcplxes.dat contains protein complex data. However, the information were mostly also in proteins.dat.
        In case there is any additional information.  In additiona, the 'TYPE_OF' relationship for general type
        (e.g. polyperptide, modified protein, complex) were removed since we don't have a use case to use them now and
        it made the relationships more complicated.  Those can be added later if needed by deleting the code for edge removing.
        """
        nodes = DataFileParser.parse_data_file(self)
        self.datafile = 'protligandcplxes.dat'
        nodes2 = DataFileParser.parse_data_file(self)
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

    def extrace_synonyms(self, df:pd.DataFrame):
        """
        extract synonyms from 'synonyms' column, combine with name, return dataframe for id-synonym (columns[ID, NAME])
        """
        if PROP_ABBREV_NAME in df.columns:
            df_syn = df[[PROP_ID, PROP_SYNONYMS]].dropna()
            df_syn = df_syn[df_syn[PROP_SYNONYMS] != '']
            df_syn = df_syn.set_index(PROP_ID).synonyms.str.split('|', expand=True).stack()
            df_syn = df_syn.reset_index().rename(columns={0: PROP_NAME}).loc[:, [PROP_ID, PROP_NAME]]
            df_name = df[[PROP_ID, PROP_NAME]]
            df_symbol = df[[PROP_ID, PROP_ABBREV_NAME]].dropna()
            df_symbol.columns = [PROP_ID, PROP_NAME]
            df_syn = pd.concat([df_name, df_symbol, df_syn]).drop_duplicates()
            df_syn = df_syn[df_syn[PROP_NAME].str.len() > 1]
            return df_syn
        return DataFileParser.extrace_synonyms(self, df)

