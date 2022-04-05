from common.obo_parser import OboParser
from common.graph_models import RelationshipType
from common.constants import *

attribute_map = {
            'id': (PROP_ID, 'str'),
            'name': (PROP_NAME, 'str'),
            'namespace': (PROP_NAMESPACE, 'str'),
            'def': (PROP_DESCRIPTION, 'str'),
            'synonym': (PROP_SYNONYMS, 'str'),
            'is_obsolete': (PROP_OBSOLETE, 'str'),
            'alt_id': (PROP_ALT_ID, 'str'),
        }

relationship_map = {
        # 'alt_id': RelationshipType(REL_ALT_ID, 'to', DB_GO, PROP_GO_ID, ),
        'is_a': RelationshipType(REL_IS_A, 'to', NODE_GO, PROP_ID),
        'replaced_by': RelationshipType(REL_REPLACEDBY, 'to', NODE_GO, PROP_ID)
}
node_attrs = [PROP_ID, PROP_NAME, PROP_DESCRIPTION, PROP_OBSOLETE, PROP_ALT_ID, PROP_NAMESPACE]


class GoOboParser(OboParser):
    def __init__(self, obo_file):
        OboParser.__init__(self, DB_GO, obo_file, attribute_map, relationship_map, NODE_GO, node_attrs)
        # set id_prefix='GO:' if you would like to remove the prefix from all GO IDs.
        self.id_prefix = 'GO:'


def main():
    parser = GoOboParser('go.obo')
    parser.parse_and_write_data_files('go-data-220320.zip')


if __name__ == "__main__":
    main()
