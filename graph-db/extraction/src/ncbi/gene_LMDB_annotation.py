import pandas as pd
import os, logging
from common.constants import *
from ncbi.ncbi_gene_parser import GENE_INFO_ATTR_MAP, GeneParser

def write_LMDB_annotation_file(self, base_data_dir):
    """
    2021-06-08 14:28:36,984 rows processed: 43259367
    LMDB gene annotation file has the following columns:
    id, name, synonym, data_source.

    Since the gene.info file is very big, data were loaded and write in chunks
    """
    gene_parser = GeneParser(base_data_dir)
    outfile = os.path.join(gene_parser.output_dir, 'gene_list_for_LMDB.tsv')
    open(outfile, 'w').close()
    gene_info_cols = [k for k in GENE_INFO_ATTR_MAP.keys()]
    geneinfo_chunks = pd.read_csv(gene_parser.gene_info_file, sep='\t', chunksize=200000, usecols=gene_info_cols)
    count = 0
    header = True
    for chunk in geneinfo_chunks:
        df = chunk.rename(columns=GENE_INFO_ATTR_MAP)
        # remove any gene with name as 'NEWENTRY'.
        df = df[df['name'] != 'NEWENTRY']
        df = df.replace('-', '')
        # get columns for synonym, then expand the synonyms so that each synonym in one row
        df_syn = df[[PROP_ID, PROP_NAME, PROP_SYNONYMS]]
        df_syn = df_syn.set_index([PROP_ID, PROP_NAME]).synonyms.str.split('|', expand=True).stack()
        df_syn = df_syn.reset_index().rename(columns={0: 'synonym'}).loc[:, [PROP_ID, PROP_NAME, 'synonym']]
        # add gene name as synonym
        df_names = df[[PROP_ID, PROP_NAME]].copy()
        df_names['synonym'] = df_names[PROP_NAME]
        # add locus tag as synonym
        df_locus = df[[PROP_ID, PROP_NAME, PROP_LOCUS_TAG]]
        df_locus = df_locus.rename(columns={PROP_LOCUS_TAG: 'synonym'})
        # combine dataframes
        df_syns = pd.concat([df_names, df_locus, df_syn])
        df_syns.drop_duplicates(inplace=True)
        # remove synonyms with only one letter, or do not have non-digit chars
        df_syns = df_syns[df_syns['synonym'].str.len() > 1 & df_syns['synonym'].str.contains('[a-zA-Z]')]
        # gene_parser.logger.info(f"names: {len(df_names)}, syn: {len(df_syn)}, final syns: {len(df_syns)}")
        df_syns[PROP_DATA_SOURCE] = DS_NCBI_GENE
        df_syns.sort_values(by=[PROP_ID], inplace=True)
        count += len(df_syns)
        df_syns.to_csv(outfile, header=header, sep='\t', mode='a', index=False)
        header = False
    gene_parser.logger.info(f"Rows processed: {count}")