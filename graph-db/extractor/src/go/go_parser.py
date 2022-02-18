from common.graph_models import *
from common.obo_parser import OboParser
from common.base_parser import BaseParser
from common.database import *
import logging
import pandas as pd


attribute_map = {
            'id': (PROP_ID, 'str'),
            'name': (PROP_NAME, 'str'),
            'namespace': ('namespace', 'str'),
            'def': (PROP_DESCRIPTION, 'str'),
            'synonym': (PROP_SYNONYMS, 'str'),
            'is_obsolete': (PROP_OBSOLETE, 'str'),
            'alt_id': (PROP_ALT_ID, 'str'),
            # 'property_value': ()
        }

relationship_map = {
        # 'alt_id': RelationshipType(REL_ALT_ID, 'to', DB_GO, PROP_GO_ID, ),
        'is_a': RelationshipType(REL_IS_A, 'to', NODE_GO, PROP_ID),
        'replaced_by': RelationshipType('replaced_by'.upper(), 'to', NODE_GO, PROP_ID),
        'relationship': None
}

NODE_ATTRS = [PROP_ID, PROP_NAME, PROP_DESCRIPTION, PROP_ALT_ID, PROP_OBSOLETE, PROP_DATA_SOURCE]
GO_FILE = 'go-data.tsv'
GO_RELATIONSHIP = 'go-relationship.tsv'


class GoOboParser(OboParser, BaseParser):
    def __init__(self, prefix: str, basedir=None):
        BaseParser.__init__(self, prefix, 'go', basedir)
        OboParser.__init__(self, attribute_map, relationship_map, NODE_GO, PROP_ID)

        self.id_prefix = 'GO:'

    def parse_obo_and_write_data_files(self):
        logging.info('Parsing go.obo')
        nodes = self.parse_file(os.path.join(self.download_dir, 'go.obo'))
        # need to remove prefix 'GO:' from id
        for node in nodes:
            node.update_attribute(PROP_ID, node.get_attribute(PROP_ID).replace(self.id_prefix, ''))
            node.update_attribute(PROP_DATA_SOURCE, DB_GO)
        logging.info(f'Total go nodes: {len(nodes)}')

        go_df = pd.DataFrame([node.to_dict() for node in nodes])
        go_df.fillna('', inplace=True)
        go_df.to_csv(os.path.join(self.output_dir, self.file_prefix + GO_FILE), sep='\t', index=False)

        go_rel_df = pd.DataFrame([{
            'relationship': edge.label,
            'from_id': edge.source.attributes['eid'],
            'to_id': edge.dest.attributes['eid']} for node in nodes for edge in node.edges])
        go_rel_df.fillna('', inplace=True)
        go_rel_df.to_csv(os.path.join(self.output_dir, self.file_prefix + GO_RELATIONSHIP), sep='\t', index=False)


def main(args):
    parser = GoOboParser(args.prefix)
    parser.parse_obo_and_write_data_files()

    for filename in [GO_FILE, GO_RELATIONSHIP]:
        parser.upload_azure_file(filename, args.prefix)


if __name__ == "__main__":
    main()
