from common.base_parser import BaseParser
from common.constants import *
from common.query_builder import *
import pandas as pd
import logging


"""
Download ncbi genes from ftp://ftp.ncbi.nlm.nih.gov/gene/DATA/.  Parse gene_info file, and gene2go.

For gene synonyms, remove any names with only one letter, and remove names that contain no non-digit characters. 
"""

GENE_INFO_ATTR_MAP = {
    '#tax_id': PROP_TAX_ID,
    'GeneID': PROP_ID,
    'Symbol': PROP_NAME,
    'LocusTag': PROP_LOCUS_TAG,
    'Synonyms': PROP_SYNONYMS,
    'description': PROP_FULLNAME
}

NODE_ATTRS = [PROP_NAME, PROP_LOCUS_TAG, PROP_FULLNAME, PROP_TAX_ID, PROP_DATA_SOURCE]
NCBI_GENE_FILE = 'gene.tsv'
NCBI_GENE_GO_FILE = 'gene2go.tsv'
NCBI_GENE_SYNONYM_FILE = 'gene_synonym.tsv'

class GeneParser(BaseParser):
    def __init__(self, prefix: str, base_dir=None):
        BaseParser.__init__(self, prefix, 'gene', base_dir)
        self.gene_info_file = os.path.join(self.download_dir, 'gene_info.gz')
        self.gene2go_file = os.path.join(self.download_dir, 'gene2go.gz')
        self.logger = logging.getLogger(__name__)

    def parse_and_write_data_files(self):
        self.logger.info('Parse bioinfo...')
        self._load_bioinfo_to_neo4j()
        self.logger.info('Parse gene2go...')
        self._load_gene2go_to_neo4j()

    def _load_bioinfo_to_neo4j(self):
        """
        Read bioinfo file, and load gene nodes, gene synonyms listed in the synonyms column.  Associate genes with taxonomy
        :param database: database to laod data
        :param update: if False, it is initial loading; if True, update the database (no node and relationship deletion)
        """
        gene_info_cols = [k for k in GENE_INFO_ATTR_MAP.keys()]
        geneinfo_chunks = pd.read_csv(self.gene_info_file, sep='\t', chunksize=10000, usecols=gene_info_cols)

        outfile = os.path.join(self.output_dir, self.file_prefix + NCBI_GENE_FILE)
        syn_outfile = os.path.join(self.output_dir, self.file_prefix + NCBI_GENE_SYNONYM_FILE)

        f = open(outfile, 'w')
        f.close()
        f2 = open(syn_outfile, 'w')
        f2.close()

        for i, chunk in enumerate(geneinfo_chunks):
            df = chunk.rename(columns=GENE_INFO_ATTR_MAP)
            df = df[df['name'] != 'NEWENTRY']
            df = df.replace('-', '')
            df = df.astype('str')
            df[PROP_DATA_SOURCE] = DS_NCBI_GENE

            df_syn = df[[PROP_ID, PROP_SYNONYMS]]
            df_syn = df_syn.set_index(PROP_ID).synonyms.str.split('|', expand=True).stack()
            df_syn = df_syn.reset_index().rename(columns={0: 'synonym'}).loc[:, [PROP_ID, 'synonym']]
            # ignore single letter synonym, and synonyms without letters
            df_syn = df_syn[df_syn['synonym'].str.len() > 1 & df_syn['synonym'].str.contains('[a-zA-Z]')]

            df.to_csv(outfile, header=(i==0), mode='a', sep='\t', index=False)
            df_syn.to_csv(syn_outfile, header=(i==0), mode='a', sep='\t', index=False)

    def _load_gene2go_to_neo4j(self):
        chunks = pd.read_csv(self.gene2go_file, sep='\t', chunksize=10000, usecols=['GeneID', 'GO_ID'])
        outfile = os.path.join(self.output_dir, self.file_prefix + NCBI_GENE_GO_FILE)
        f = open(outfile, 'w')
        f.close()
        for i, chunk in enumerate(chunks):
            df = chunk.astype('str')
            df.to_csv(outfile, header=(i==0), mode='a', sep='\t', index=False)


def main(args):
    parser = GeneParser(args.prefix)
    parser.parse_and_write_data_files()

    for filename in [NCBI_GENE_FILE, NCBI_GENE_GO_FILE, NCBI_GENE_SYNONYM_FILE]:
        parser.upload_azure_file(filename, args.prefix)


if __name__ == '__main__':
    main()
