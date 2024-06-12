from common.constants import *
from common.graph_models import RelationshipType
from common.obo_parser import OboParser
import logging
import os

attribute_map = {
            'id': (PROP_ID, 'str'),
            'name': (PROP_NAME, 'str'),
            'def': (PROP_DEF, 'str'),
            'formula': ('formula', 'str'),
            'charge': ('charge', 'str'),
            'inchi': (PROP_INCHI, 'str'),
            'inchikey': (PROP_INCHI_KEY, 'str'),
            'smiles': (PROP_SMILES, 'str'),
            'mass': ('mass', 'str'),
            'synonym': (PROP_SYNONYMS, 'str'),
            'alt_id': (PROP_ALT_ID, 'str'),
            'property_value': None  # special mapping, need to extract property name
        }
node_attrs = [PROP_ID, PROP_NAME, PROP_DEF, 'formula','charge', PROP_INCHI_KEY, PROP_INCHI, PROP_SMILES, 'mass', PROP_ALT_ID]

relationship_map = {
        # 'alt_id': RelationshipType(REL_ALT_ID, 'to', DB_CHEBI, PROP_CHEBI_ID),
        'is_a': RelationshipType(REL_IS_A, 'to', DB_CHEBI, PROP_ID),
        'relationship': RelationshipType(None, 'to', DB_CHEBI, PROP_ID)  # special mapping, need to extract relationship type
}

class ChebiOboParser(OboParser):
    def __init__(self, obo_file):
        OboParser.__init__(self, 'ChEBI', obo_file, attribute_map, relationship_map, NODE_CHEBI, node_attrs)
        self.id_prefix = 'CHEBI:'
        self.logger = logging.getLogger(__name__)


def main():
    parser = ChebiOboParser('chebi.obo')
    parser.parse_and_write_data_files('chebi-data-220222.zip')


if __name__ == "__main__":
    main()
