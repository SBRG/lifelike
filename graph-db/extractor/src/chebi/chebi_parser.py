from common.graph_models import *
from common.constants import *
from common.obo_parser import OboParser
from common.base_parser import BaseParser
from common.database import *
from common.graph_models import NodeData
from common.query_builder import *

import csv
import logging
import pandas as pd

from common.cloud_utils import azure_upload


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
            'property_value': ()
        }

relationship_map = {
        # 'alt_id': RelationshipType(REL_ALT_ID, 'to', DB_CHEBI, PROP_CHEBI_ID),
        'is_a': RelationshipType(REL_IS_A, 'to', DB_CHEBI, PROP_ID),
        'relationship': RelationshipType(None, 'to', DB_CHEBI, PROP_ID)
}

NODE_ATTRS = [PROP_ID, PROP_NAME, PROP_DEF, PROP_INCHI, PROP_INCHI_KEY, PROP_SMILES, PROP_ALT_ID, PROP_DATA_SOURCE]


class ChebiOboParser(OboParser, BaseParser):
    def __init__(self, basedir=None):
        BaseParser.__init__(self, 'chebi', basedir)
        OboParser.__init__(self, attribute_map, relationship_map, NODE_CHEBI, PROP_ID)
        self.id_prefix = 'CHEBI:'
        self.logger = logging.getLogger(__name__)

    def create_indexes(self, database: Database):
        """
        Create indices and constraint if thet don't already exist
        """
        database.create_constraint(NODE_CHEBI, PROP_ID, "constraint_chebi_id")
        database.create_index(NODE_CHEBI, PROP_NAME, "index_chebi_name")
        database.create_index(NODE_CHEMICAL, PROP_ID, "index_chemical_id")
        database.create_index(NODE_CHEMICAL, PROP_NAME, "index_chemical_name")
        database.create_constraint(NODE_SYNONYM, PROP_NAME, "constraint_synonym_name")

    def parse_obo_file(self):
        self.logger.info("Parsing chebi.obo")
        file = os.path.join(self.download_dir, 'chebi.obo')
        nodes = self.parse_file(file)
        # remove prefix 'GO:' from id
        for node in nodes:
            node.update_attribute(PROP_DATA_SOURCE, 'ChEBI')
        self.logger.info(f"Number of chebi nodes parsed from chebi.obo: {len(nodes)}")
        filename = 'jira-LL-3198-chebi-data.tsv'
        filepath = os.path.join(self.output_dir, filename)
        zip_filename = 'jira-LL-3198-chebi-data.zip'
        zip_filepath = os.path.join(self.output_dir, zip_filename)

        df = pd.DataFrame([node.to_dict() for node in nodes])
        df.fillna('', inplace=True)
        with open(filepath, 'w', newline='\n') as tsvfile:
            writer = csv.writer(tsvfile, delimiter='\t', quotechar='"')
            writer.writerow(list(df.columns.values))

        df.to_csv(filepath, sep='\t', index=False)
        azure_upload(zip_filename, zip_filepath)

        filename = 'jira-LL-3198-chebi-relationship-data.tsv'
        filepath = os.path.join(self.output_dir, filename)
        zip_filename = 'jira-LL-3198-chebi-relationship-data.zip'
        zip_filepath = os.path.join(self.output_dir, zip_filename)

        df = pd.DataFrame([{
            'relationship': edge.label,
            'from_id': edge.source.attributes['eid'],
            'to_id': edge.dest.attributes['eid']} for node in nodes for edge in node.edges])
        df.fillna('', inplace=True)

        with open(filepath, 'w', newline='\n') as tsvfile:
            writer = csv.writer(tsvfile, delimiter='\t', quotechar='"')
            writer.writerow(list(df.columns.values))

        df.to_csv(filepath, sep='\t', index=False)
        azure_upload(zip_filename, zip_filepath)
        return nodes

    def load_data_to_neo4j(self, database: Database):
        nodes = self.parse_obo_file()
        # if not nodes:
        #     return
        # self.create_indexes(database)
        # self.logger.info("Add nodes to " + NODE_CHEBI)
        # self.load_nodes(database, nodes, NODE_CHEBI, NODE_CHEMICAL, PROP_ID, NODE_ATTRS)
        # self.logger.info("Add synonyms to " + NODE_CHEBI)
        # self.load_synonyms(database, nodes, NODE_CHEBI, PROP_ID)
        # self.logger.info("Add edges to " + NODE_CHEBI)
        # self.load_edges(database, nodes, NODE_CHEBI, PROP_ID)


def main():
    parser = ChebiOboParser()
    database = get_database()
    parser.load_data_to_neo4j(database)
    database.close()


if __name__ == "__main__":
    main()
