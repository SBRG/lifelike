import os.path

from common.base_data_loader import BaseDataLoader
from common.constants import *
from common.database import Database
from kegg.kegg_parser import *


class KeggDataLoader(BaseDataLoader):
    def __init__(self, basedir):
        BaseDataLoader.__init__(self, DB_KEGG.lower(), basedir)
        self.logger = logging.getLogger(__name__)

    def create_indexes(self, database: Database):
        database.create_constraint(NODE_KEGG, PROP_ID, "constraint_kegg_id")
        database.create_constraint(NODE_KO, PROP_ID, 'constraint_ko_id')
        database.create_constraint(NODE_PATHWAY, PROP_ID, 'constraint_pathway_id')
        database.create_constraint(NODE_GENE, PROP_ID, 'constraint_gene_id')
        database.create_constraint(NODE_GENOME, PROP_ID, 'constraint_genome_id')
        database.create_constraint(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name')
        database.create_index(NODE_PATHWAY, PROP_NAME, 'index_pathway_name')

    def load_data_to_neo4j(self, database: Database):
        self.load_gene_nodes(database)
        self.load_genome_nodes(database)
        self.load_ko_nodes(database)
        self.load_pathway_nodes(database)
        self.load_gene2ko_rels(database)
        self.load_gene2ncbi_rels(database)
        self.load_ko2pathway_rels(database)
        self.load_genome2pathway_rels(database)

    @classmethod
    def get_load_gene_query(cls):
        cols = [PROP_ID, PROP_GENOME, PROP_GENE_ID]
        query = get_create_update_nodes_query(NODE_KEGG, PROP_ID, cols, [NODE_GENE], datasource=DB_KEGG)
        return query

    def load_gene_nodes(self, database):
        self.logger.info('load gene')
        query = self.get_load_gene_query()
        database.load_csv_file(query, os.path.join(self.output_dir, GENE_FILE), sep='\t', dtype={PROP_GENE_ID: str}, chunksize=5000)

    @classmethod
    def get_load_geneome_query(cls):
        return get_create_update_nodes_query(NODE_GENOME, PROP_ID, [], [NODE_KEGG], datasource=DB_KEGG, original_entity_type=NODE_GENOME)

    def load_genome_nodes(self, database):
        self.logger.info('load genome')
        query = self.get_load_geneome_query()
        database.load_csv_file(query, os.path.join(self.output_dir, GENOME_FILE), sep='\t')

    @classmethod
    def get_load_ko_query(cls):
        cols = [PROP_ID, PROP_NAME, PROP_DEF]
        query = get_create_update_nodes_query(NODE_KEGG, PROP_ID, cols, [NODE_KO], datasource=DB_KEGG)
        return query

    def load_ko_nodes(self, database):
        self.logger.info('load ko')
        query = self.get_load_ko_query()
        database.load_csv_file(query, os.path.join(self.output_dir, KO_FILE))

    @classmethod
    def get_load_pathway_query(cls):
        cols = [PROP_ID, PROP_NAME]
        query = get_create_update_nodes_query(NODE_KEGG, PROP_ID, cols, [NODE_PATHWAY], DB_KEGG, NODE_PATHWAY)
        return query

    def load_pathway_nodes(self, database):
        # load pathway
        self.logger.info('load pathways')
        query = self.get_load_pathway_query()
        database.load_csv_file(query, os.path.join(self.output_dir, PATHWAY_FILE), dtype={PROP_ID: str})


    @classmethod
    def get_load_gene2ko_query(cls):
        return get_create_relationships_query(NODE_KEGG, PROP_ID, 'gene', NODE_KO, PROP_ID, 'ko', 'HAS_KO')

    def load_gene2ko_rels(self, database):
        self.logger.info('load gene-ko relationships')
        query = self.get_load_gene2ko_query()
        database.load_csv_file(query, os.path.join(self.output_dir, GENE2KO_FILE), chunksize=5000)

    @classmethod
    def get_load_gene2ncbi_query(cls):
        return get_create_relationships_query(NODE_KEGG, PROP_ID, PROP_ID, NODE_GENE, PROP_ID, PROP_GENE_ID,
                                               REL_IS)

    def load_gene2ncbi_rels(self, database):
        self.logger.info('load gene-ncbi gene relationships')
        query = self.get_load_gene2ncbi_query()
        database.load_csv_file(query, os.path.join(self.output_dir, GENE_FILE), sep='\t', dtype={PROP_GENE_ID: str}, chunksize=5000)

    @classmethod
    def get_load_ko2pathway_query(cls):
        return get_create_relationships_query(NODE_KO, PROP_ID, 'ko', NODE_PATHWAY, PROP_ID, 'pathway', 'IN_PATHWAY')

    def load_ko2pathway_rels(self, database):
        self.logger.info('load ko-pathway relationships')
        query = self.get_load_ko2pathway_query()
        database.load_csv_file(query, os.path.join(self.output_dir, KO2PATHWAY_FILE), chunksize=5000)

    @classmethod
    def get_load_genome2pathway_query(cls):
        return get_create_relationships_query(NODE_GENOME, PROP_ID, 'genome', NODE_PATHWAY, PROP_ID, 'pathway',
                                               REL_HAS_PATHWAY)

    def load_genome2pathway_rels(self, database):
        self.logger.info('load genome-pathway association')
        query = self.get_load_genome2pathway_query()
        database.load_csv_file(query, os.path.join(self.output_dir, GENOME2PATHWAY_FILE), sep='\t',
                               dtype={'pathway': str}, chunksize=5000)

