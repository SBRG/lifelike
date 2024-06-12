from biocyc.data_file_parser import DataFileParser
from common.graph_models import *
from biocyc.utils import cleanhtml


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'ABBREV-NAME': (PROP_ABBREV_NAME, 'str'),
    'INCHI-KEY': (PROP_INCHI_KEY, 'str'),
    'INCHI': (PROP_INCHI, 'str'),
    'SMILES': (PROP_SMILES, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    'DBLINKS': RelationshipType(REL_DBLINKS, 'to', NODE_DBLINK, PROP_REF_ID),
}

# True indicate that the dblink id has prefix, eg. CHEBI:1234.  In lifelike, we only use the id, no prefix
DB_LINK_SOURCES = {'CHEBI':False}

class CompoundParser(DataFileParser):
    def __init__(self, biocyc_dbname, tarfile):
        DataFileParser.__init__(self, biocyc_dbname, tarfile, 'compounds.dat', NODE_COMPOUND,ATTR_NAMES, REL_NAMES, DB_LINK_SOURCES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_ABBREV_NAME, PROP_INCHI_KEY, PROP_INCHI, PROP_SMILES]

    def parse_data_file(self):
        nodes = DataFileParser.parse_data_file(self)
        for node in nodes:
            name = node.get_attribute(PROP_NAME)
            if name:
                # clean compound names
                name = cleanhtml(name)
                if name.startswith('a '):
                    name = name[2:]
                elif name.startswith('an '):
                    name = name[3:]
                node.update_attribute(PROP_NAME, name)

            inchi_key = node.get_attribute(PROP_INCHI_KEY)
            if inchi_key:
                node.update_attribute(PROP_INCHI_KEY, inchi_key[len('InChIKey='):])

        return nodes



