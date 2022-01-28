import logging
import os

from common.constants import *
from common.database import get_database
from common.base_parser import BaseParser
from common.query_builder import (
    get_create_update_nodes_query,
    get_create_relationships_query,
    get_create_synonym_relationships_query
)

MESH_CHEMICAL_FILE = 'mesh_chemicals.tsv'
MESH_CHEMICAL_TOPICALDESC_REL_FILE = 'mesh_chemical_topicaldesc_rels.tsv'
MESH_DISEASE_FILE = 'mesh_diseases.tsv'
MESH_DISEASE_TOPICALDESC_REL_FILE = 'mesh_disease_topicaldesc_rels.tsv'
MESH_SYNONYM_REL_FILE = 'mesh_synonym_rels.tsv'
MESH_TOPICALDESC_FILE = 'mesh_topicaldescriptors.tsv'
MESH_TREENUMBER_FILE = 'mesh_treenumber.tsv'
MESH_TREENUMBER_PARENT_REL_FILE = 'mesh_treenumber_parent_rels.tsv'
MESH_TREENUMBER_TOPICALDESC_REL_FILE = 'mesh_treenumber_topicaldesc_rels.tsv'


class MeshParser(BaseParser):
    def __init__(self, prefix: str, base_dir=None):
        BaseParser.__init__(self, prefix, DB_MESH.lower(), base_dir)
        self.logger = logging.getLogger(__name__)

    def load_data_to_neo4j(self, db):
        """Data was first loaded in temp db to easily parse RDF, now create data files from that."""
        self._load_treenumber(db)
        self._load_topical_descriptor(db)
        self._load_chemical(db)
        self._load_disease(db)
        self._load_synonym(db)

    def _load_treenumber(self, db):
        self.logger.info('Load treenumber nodes')
        df = db.get_data(f'MATCH (t:TreeNumber) RETURN t.label AS {PROP_ID}')
        df[PROP_OBSOLETE] = df[PROP_ID].str.startswith('[OBSOLETE]').astype(int)
        df[PROP_ID] = df[PROP_ID].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        self.logger.info(f'len of df: {len(df)}')
        query = get_create_update_nodes_query(NODE_MESH, PROP_ID, [PROP_OBSOLETE], [NODE_TREENUMBER], datasource='MeSH')
        print(query)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + MESH_TREENUMBER_FILE)
        df.to_csv(outfile, index=False, sep='\t')

        self.logger.info('node treenumber has_parent relationship')
        df = db.get_data(f'MATCH (t:TreeNumber)-[:parentTreeNumber]->(p:TreeNumber) RETURN t.label AS {PROP_ID}, p.label AS {PROP_PARENT_ID}')
        self.logger.info(f'len of df: {len(df)}')
        df[PROP_ID] = df[PROP_ID].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        df[PROP_PARENT_ID] = df[PROP_PARENT_ID].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID, PROP_PARENT_ID, REL_PARENT)
        print(query)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + MESH_TREENUMBER_PARENT_REL_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def _load_topical_descriptor(self, db):
        self.logger.info('load topicaldescriptor nodes')
        df = db.get_data(f'MATCH (d:TopicalDescriptor) RETURN d.identifier AS {PROP_ID}, d.label AS {PROP_NAME}')
        self.logger.info(f'len of df: {len(df)}')
        df[PROP_OBSOLETE] = df[PROP_NAME].str.startswith('[OBSOLETE]').astype(int)
        df[PROP_NAME] = df[PROP_NAME].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        query = get_create_update_nodes_query(NODE_MESH, PROP_ID, [PROP_NAME, PROP_OBSOLETE], [NODE_TOPICALDESC], datasource='MeSH')
        print(query)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + MESH_TOPICALDESC_FILE)
        df.to_csv(outfile, index=False, sep='\t')

        self.logger.info('map mesh to tree-number')
        df = db.get_data(f'MATCH (t:TreeNumber)-[]-(d:TopicalDescriptor) RETURN d.identifier AS {PROP_ID}, t.label AS treenumber')
        self.logger.info(f'len of df: {len(df)}')
        df['treenumber'] = df['treenumber'].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID, 'treenumber', REL_TREENUMBER)
        print(query)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + MESH_TREENUMBER_TOPICALDESC_REL_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def _load_chemical(self, db):
        self.logger.info('node mesh chemical nodes')
        df = db.get_data(f'MATCH (n:SCR_Chemical) RETURN n.identifier AS {PROP_ID}, n.label AS {PROP_NAME}')
        self.logger.info(f'len of df: {len(df)}')
        df[PROP_OBSOLETE] = df[PROP_NAME].str.startswith('[OBSOLETE]').astype(int)
        df[PROP_NAME] = df[PROP_NAME].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        query = get_create_update_nodes_query(NODE_MESH, PROP_ID, [PROP_NAME, PROP_OBSOLETE], [NODE_CHEMICAL], datasource='MeSH')
        print(query)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + MESH_CHEMICAL_FILE)
        df.to_csv(outfile, index=False, sep='\t')

        self.logger.info('map chemical to topical descriptor')
        df = db.get_data(f"""
            MATCH (n:SCR_Chemical)-[r:preferredMappedTo|mappedTo]->(d:TopicalDescriptor)
            WITH n, d, r
            MATCH (d)-[:treeNumber]-(t:TreeNumber) WHERE substring(t.label, 0, 1) = 'D'
            RETURN DISTINCT n.identifier AS {PROP_ID}, d.identifier AS descriptor_id, type(r) AS {PROP_TYPE}
            """)
        self.logger.info(f'len of df: {len(df)}')
        query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID, 'descriptor_id', REL_MAPPED_TO_DESCRIPTOR, [PROP_TYPE])
        print(query)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + MESH_CHEMICAL_TOPICALDESC_REL_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def _load_disease(self, db):
        self.logger.info('load mesh disease nodes')
        df = db.get_data(f'MATCH (n:SCR_Disease) RETURN n.identifier AS {PROP_ID}, n.label AS {PROP_NAME}')
        df[PROP_OBSOLETE] = df[PROP_NAME].str.startswith('[OBSOLETE]').astype(int)
        df[PROP_NAME] = df[PROP_NAME].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        self.logger.info(f'len of df: {len(df)}')
        query = get_create_update_nodes_query(NODE_MESH, PROP_ID, [PROP_NAME, PROP_OBSOLETE], [NODE_DISEASE], datasource='MeSH')
        print(query)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + MESH_DISEASE_FILE)
        df.to_csv(outfile, index=False, sep='\t')

        self.logger.info('map disease to topical descriptor')
        df = db.get_data(f"""
            MATCH (n:SCR_Disease)-[r:preferredMappedTo|mappedTo]->(d:TopicalDescriptor)
            WITH n, d, r
            MATCH (d)-[:treeNumber]-(t:TreeNumber) WHERE substring(t.label, 0, 1) = 'C'
            RETURN DISTINCT n.identifier AS {PROP_ID}, d.identifier AS descriptor_id, type(r) AS {PROP_TYPE}
            """)
        self.logger.info(f'len of df: {len(df)}')
        query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID, 'descriptor_id', REL_MAPPED_TO_DESCRIPTOR, [PROP_TYPE])
        print(query)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + MESH_DISEASE_TOPICALDESC_REL_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def _load_synonym(self, db):
        data_query = f"""
            MATCH (n:TopicalDescriptor)-[]-(:Concept)-[]-(t:Term)
            WITH n, [t.prefLabel]+coalesce(t.altLabel, []) AS terms
            UNWIND terms AS synonym
            RETURN n.identifier AS {PROP_ID}, synonym
            UNION
            MATCH (n:SCR_Chemical)-[]-(:Concept)-[]-(t:Term)
            WITH n, [t.prefLabel]+coalesce(t.altLabel, []) AS terms
            UNWIND terms AS synonym
            RETURN n.identifier AS {PROP_ID}, synonym
            UNION
            MATCH (n:SCR_Disease)-[]-(:Concept)-[]-(t:Term)
            WITH n, [t.prefLabel]+coalesce(t.altLabel, []) AS terms
            UNWIND terms AS synonym
            RETURN n.identifier AS {PROP_ID}, synonym
        """
        df = db.get_data(data_query)
        self.logger.info(f'len of df: {len(df)}')
        query = get_create_synonym_relationships_query(NODE_MESH, PROP_ID, PROP_ID, PROP_NAME)
        print(query)
        # exclude synonyms with comma
        # only care about the ones with eid starting with certain letters
        df2 = df[df.eid.str.startswith(tuple(['A', 'C', 'F', 'G']))]
        df3 = df2[df2.synonym.str.contains(',')]
        df = df[~df.eid.isin(df3.eid)]
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + MESH_SYNONYM_REL_FILE)
        df.to_csv(outfile, index=False, sep='\t')


def main(args):
    db = get_database()
    parser = MeshParser(args.prefix)
    parser.load_data_to_neo4j(db)
    db.close()

    for filename in [
        MESH_CHEMICAL_FILE, MESH_CHEMICAL_TOPICALDESC_REL_FILE, MESH_DISEASE_FILE, MESH_DISEASE_TOPICALDESC_REL_FILE,
        MESH_SYNONYM_REL_FILE, MESH_TOPICALDESC_FILE, MESH_TREENUMBER_FILE, MESH_TREENUMBER_PARENT_REL_FILE, MESH_TREENUMBER_TOPICALDESC_REL_FILE
    ]:
        parser.upload_azure_file(filename, args.prefix)


if __name__ == "__main__":
    main()
