import unittest
import pandas as pd
from common.database import *
from common.constants import *
from ncbi.ncbi_gene_parser import GeneParser
import logging


class TestGeneParser(unittest.TestCase):
    """
    Test gene parser using given organism data
    Issues: need timestamp for the updates. Otherwise, cannot identify which ones were newly loaded/updated.
    """
    def __init__(self, database, tax_id:int):
        self.parser = GeneParser('/Users/rcai/data')
        self.database = database
        self.tax_id = tax_id
        self.logger = logging.getLogger(__name__)

    def get_geneinfo_file(self):
        return os.path.join(self.parser.output_dir, 'geneinfo_' + str(self.tax_id) + '.tsv')

    def write_geneinfo(self):
        df_geneinfo = self.parser.extract_organism_geneinfo(self.tax_id)
        self.logger.info(len(df_geneinfo))
        df_geneinfo.to_csv(self.get_geneinfo_file(), sep='\t', index=False)

    def test_gene_count(self):
        query = """
        match (n:Gene:db_NCBI)-[:HAS_TAXONOMY]-(t:Taxonomy {id:$taxId}) where exists(n.tax_id) return count(*) as count
        """
        result = self.database.get_data(query, {'taxId': str(self.tax_id)})
        db_count = result.loc[0][0]

        df = pd.read_csv(self.get_geneinfo_file(), sep='\t')
        geneinfo_count = len(df)
        self.assertTrue(db_count == geneinfo_count, 'gene count does not match')

    def get_synonyms_from_geneinfo(self):
        df = pd.read_csv(self.get_geneinfo_file(), sep='\t')
        df = df.replace('-', '')
        df_syn = df[[PROP_ID, PROP_SYNONYMS]]
        df_names = df[[PROP_ID, PROP_NAME]]
        df_locus = df[df[PROP_LOCUS_TAG].str.len()>0][[PROP_ID, PROP_LOCUS_TAG]]
        df_syn = df_syn.set_index(PROP_ID).synonyms.str.split('|', expand=True).stack()
        df_syn = df_syn.reset_index().rename(columns={0: 'name'}).loc[:, [PROP_ID, 'name']]
        df_locus = df_locus.rename(columns={PROP_LOCUS_TAG: 'name'})
        df_syns = pd.concat([df_names, df_locus, df_syn])
        df_syns.drop_duplicates(inplace=True)
        # remove synonyms with only one letter, or do not have non-digit chars
        df_syns = df_syns[df_syns['name'].str.len() > 1 & df_syns['name'].str.contains('[a-zA-Z]')]
        df_syns = df_syns[df_syns['name'].str.len() > 1]
        self.logger.info(len(df_names), len(df_locus), len(df_syns))
        return df_syns

    def test_synonym_count(self):
        """
        Synonyms in google stg and prod were not unique (need to merge nodes), therefore need to use distinct synonym name
        """
        query = f"""
        match(n:Gene:db_NCBI)-[:HAS_TAXONOMY]-(:Taxonomy {id:$taxId}) with n where exists(n.tax_id) 
        match (n)-[r:HAS_SYNONYM]-(s) where not exists(r.inclusion_date) 
        with distinct n.{PROP_ID} as id, s.name as name return count(*)
        """
        result = self.database.get_data(query, {'taxId': str(self.tax_id)})
        db_count = result.loc[0][0]
        file_count = len(self.get_synonyms_from_geneinfo())
        self.assertTrue(db_count == file_count, f'synonym counts does not match: {db_count}, {file_count}')

    def compare_synonyms(self):
        query = f"""
                match(n:Gene:db_NCBI)-[:HAS_TAXONOMY]-(:Taxonomy {id:$taxId}) with n where exists(n.tax_id) 
                match (n)-[r:HAS_SYNONYM]-(s) where not exists(r.inclusion_date) 
                return distinct n.{PROP_ID} as id, s.name as name order by id, name
                """
        df_db = self.database.get_data(query, {'taxId': str(self.tax_id)})
        df_db = df_db.drop_duplicates()
        df_db.to_csv(os.path.join(self.parser.output_dir, 'gene_syn_9606_db.tsv'), sep='\t', index=False)
        df_file = self.get_synonyms_from_geneinfo()
        df_file = df_file.astype('str')
        df_file = df_file.sort_values(by=[PROP_ID, PROP_NAME])
        df_file = df_file.drop_duplicates()
        df_file.to_csv(os.path.join(self.parser.output_dir, 'gene_syn_9606_file.tsv'), sep='\t', index=False)
        self.logger.info(f"kg synonyms: {len(df_db)}")
        self.logger.info(f"file synonyms: {len(df_file)}")
        df = pd.concat([df_db, df_file]).drop_duplicates(keep=False)
        self.logger.debug(df)


if __name__ == "__main__":
    database = get_database()
    test = TestGeneParser(database, 9606)
    test.test_synonym_count()
    database.close()
