import os
import logging
import traceback
import warnings

import pandas as pd
import numpy as np

from pandas.core.common import SettingWithCopyWarning
from common.base_parser import BaseParser
from common.constants import *
from common.database import get_database

warnings.simplefilter(action="ignore", category=SettingWithCopyWarning)
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s', handlers=[logging.StreamHandler()])

NODE_ASSOCIATION = 'Association'
ZENODO_CHEMICAL2DISEASE_FILE = 'Chemical2Disease_assoc_theme.tsv'
ZENODO_CHEMICAL2GENE_FILE = 'Chemical2Gene_assoc_theme.tsv'
ZENODO_GENE2DISEASE_FILE = 'Gene2Disease_assoc_theme.tsv'
ZENODO_GENE2GENE_FILE = 'Gene2Gene_assoc_theme.tsv'

headers = ['pmid', 'sentence_num', 'entry_formatted', 'entry1Loc', 'entry2_formatted', 'entry2Loc',
           'entry1_name', 'entry2_name', 'entry1_id', 'entry2_id', 'entry1_type', 'entry2_type', 'path', 'sentence']
dependency_headers = ['snippet_id', 'entry1_id', 'entry2_id', 'entry1_name', 'entry2_name', 'path']
columns = ['pmid', 'sentence_num', 'entry1_name', 'entry2_name', 'entry1_id', 'entry2_id', 'path', 'sentence']

theme_map = {
    'A+': 'agonism, activation',
    'A-': 'antagonism, blocking',
    'B': 'binding, ligand (esp. receptors)',
    'E+': 'increases expression/production',
    'E-': 'decreases expression/production',
    'E': 'affects expression/production (neutral)',
    'N': 'inhibits',
    'O': 'transport, channels',
    'K': 'metabolism, pharmacokinetics',
    'Z': 'enzyme activity',
    'T': 'treatment/therapy (including investigatory)',
    'C': 'inhibits cell growth (esp. cancers)',
    'Sa': 'side effect/adverse event',
    'Pr': 'prevents, suppresses',
    'Pa': 'alleviates, reduces',
    'J': 'role in disease pathogenesis',
    'Mp': 'biomarkers (of disease progression)',
    'U': 'causal mutations',
    'Ud': 'mutations affecting disease course',
    'D': 'drug targets',
    'Te': 'possible therapeutic effect',
    'Y': 'polymorphisms alter risk',
    'G': 'promotes progression',
    'Md': 'biomarkers (diagnostic)',
    'X': 'overexpression in disease',
    'L': 'improper regulation linked to disease',
    'W': 'enhances response',
    'V+': 'activates, stimulates',
    'I': 'signaling pathway',
    'H': 'same protein or complex',
    'Rg': 'regulation',
    'Q': 'production by cell population',
}

class LiteratureDataParser(BaseParser):
    def __init__(self, prefix: str):
        BaseParser.__init__(self, prefix, 'literature')
        self.parsed_dir = os.path.join(self.output_dir, 'parsed')
        os.makedirs(self.output_dir, 0o777, True)
        os.makedirs(self.parsed_dir, 0o777, True)
        self.literature_chemicals = set()
        self.literature_genes = set()
        self.literature_diseases = set()

    def get_datafile_name(self, entry1_type, entry2_type, with_theme=False):
        if with_theme:
            return os.path.join(
                self.download_dir, f'part-ii-dependency-paths-{entry1_type.lower()}-{entry2_type.lower()}-sorted-with-themes.txt.gz')
        return os.path.join(
            self.download_dir, f'part-ii-dependency-paths-{entry1_type.lower()}-{entry2_type.lower()}-sorted.txt.gz')

    def get_path2theme_datafile_name(self, entry1_type, entry2_type):
        return os.path.join(
            self.download_dir, f'part-i-{entry1_type.lower()}-{entry2_type.lower()}-path-theme-distributions.txt.gz')

    def parse_dependency_file(self, entry1_type, entry2_type, snippet_file, with_theme=True):
        """
        clean file, and write into a few cleaned file format into outfile folder 'parsed'. Update entities set,
        and write data to the following files in the parsed folder
        - snippet.tsv
        - entity12entity2_assoc.tsv: with snippet_id, entry1, entry2, path columns
        The files need to be further validated and cleaned by removing duplicates, un-matched genes, chemicals and diseaese
        :param entry1_type:
        :param entry2_type:
        :return:
        """
        file = self.get_datafile_name(entry1_type, entry2_type, with_theme)
        if with_theme:
            outfile = open(os.path.join(self.parsed_dir, f'{entry1_type}2{entry2_type}_assoc_theme.tsv'), 'w')
        else:
            outfile = open(os.path.join(self.parsed_dir, f'{entry1_type}2{entry2_type}_assoc.tsv'), 'w')

        f = lambda x: str(x)
        converters = {'pmid': f, 'sentence_num': f, 'entry1_id': f, 'entry2_id': f}
        logging.info('processing ' + file)
        count = 0
        filerow_count = 0
        data_chunk = pd.read_csv(
            file, sep='\t',
            names=headers,
            usecols=columns,
            converters=converters,
            chunksize=10000,
            index_col=False
        )

        for i, trunk in enumerate(data_chunk):
            filerow_count += len(trunk)
            if i % 10 == 0:
                print(i)
            try:
                df = trunk.replace({'null': np.nan, '-': np.nan})
                df.dropna(inplace=True)
                df.drop_duplicates(inplace=True)
                if entry1_type == entry2_type:
                    df = df[(df['entry1_name'] != df['entry2_name']) & (df['entry1_id'] != df['entry2_id'])]
                if len(df) == 0:
                    continue

                # clean gene ids
                if entry1_type == NODE_GENE:
                    df = self.clean_gene_column(df, 'entry1_id')
                    df['entry1_id'] = df['entry1_id'].apply(f)
                if entry2_type == NODE_GENE:
                    df = self.clean_gene_column(df, 'entry2_id')
                    df['entry2_id'] = df['entry2_id'].apply(f)
                    if entry1_type == NODE_GENE:
                        df = df[df['entry1_id'] != df['entry2_id']]

                if entry2_type == NODE_DISEASE:
                    df = df[~df['entry2_id'].str.startswith('OMIM')]
                    df['entry2_id'] = df['entry2_id'].apply(
                        lambda x: x if str(x).startswith('MESH') else 'MESH:' + str(x))

                if entry1_type == NODE_CHEMICAL:
                    df['entry1_id'] = df['entry1_id'].apply(
                        lambda x: x if str(x).startswith('CHEBI') or str(x).startswith('MESH') else 'MESH:' + str(x)
                    )

                df['snippet_id'] = df.apply(lambda row: str(row['pmid']) + '-' + str(row['sentence_num']), axis=1)
                df_assoc = df[dependency_headers]

                df_assoc.to_csv(outfile, index=False, mode='a', sep='\t')
                if snippet_file:
                    df_snippet = df[['snippet_id', 'pmid', 'sentence']].copy()
                    df_snippet.drop_duplicates(inplace=True)
                    df_snippet.to_csv(snippet_file, index=False, mode='a', sep='\t')

                # update literature genes, diseases
                if entry1_type == NODE_GENE:
                    self.literature_genes.update(df['entry1_id'].tolist())
                if entry1_type == NODE_CHEMICAL:
                    self.literature_chemicals.update(df['entry1_id'].tolist())
                if entry2_type == NODE_GENE:
                    self.literature_genes.update(df['entry2_id'].tolist())
                if entry2_type == NODE_DISEASE:
                    self.literature_diseases.update(df['entry2_id'].tolist())
                count = count + len(df)
            except Exception as ex:
                traceback.print_exc()
                print(f'Errored out at index {i}')
                break
        logging.info('file rows processed: ' + str(filerow_count) + ', cleaned file row:' + str(count))
        outfile.close()

    def parse_dependency_files(self):
        """
        Process all dependency file (with theme), write into parsed folder.

        part-ii-dependency-paths-chemical-disease-sorted.txt.gz
        file rows processed: 15645444, cleaned file row:12881577

        part-ii-dependency-paths-chemical-gene-sorted.txt.gz
        file rows processed: 9525647, cleaned file row:7958425

        part-ii-dependency-paths-gene-disease-sorted.txt.gz
        file rows processed: 12792758, cleaned file row:12808885

        part-ii-dependency-paths-gene-gene-sorted.txt.gz
        file rows processed: 34089578, cleaned file row:25333884

        literature genes:150380
        literature diseases:8586
        literature chemicals:66178
        :return:
        """
        snippet_file = open(os.path.join(self.parsed_dir, self.file_prefix + 'snippet.tsv'), 'w')
        self.parse_dependency_file(NODE_CHEMICAL, NODE_DISEASE, snippet_file, True)
        self.parse_dependency_file(NODE_CHEMICAL, NODE_GENE, snippet_file, True)
        self.parse_dependency_file(NODE_GENE, NODE_DISEASE, snippet_file, True)
        self.parse_dependency_file(NODE_GENE, NODE_GENE, snippet_file, True)
        snippet_file.close()

        self.parse_dependency_file(NODE_CHEMICAL, NODE_DISEASE, None, True)
        self.parse_dependency_file(NODE_CHEMICAL, NODE_GENE, None, True)
        self.parse_dependency_file(NODE_GENE, NODE_DISEASE, None, True)
        self.parse_dependency_file(NODE_GENE, NODE_GENE, None, True)

        logging.info('literature genes:' + str(len(self.literature_genes)))
        logging.info('literature diseases:' + str(len(self.literature_diseases)))
        logging.info('literature chemicals:' + str(len(self.literature_chemicals)))

        db = get_database()
        print('Cleaning chemical...')
        self.literature_chemicals = set(val for entry in self.literature_chemicals for val in entry.split('|'))
        chemical_ids_to_exclude = db.get_data(
            'MATCH (n:Chemical) WITH collect(n.eid) AS entity_ids RETURN [entry in $zenodo_ids WHERE NOT split(entry, ":")[1] IN entity_ids] AS exclude',
            {'zenodo_ids': list(self.literature_chemicals)})['exclude'].tolist()[0]
        print('Cleaning disease...')
        disease_ids_to_exclude = db.get_data(
            'MATCH (n:Disease) WITH collect(n.eid) AS entity_ids RETURN [entry in $zenodo_ids WHERE NOT split(entry, ":")[1] IN entity_ids] AS exclude',
            {'zenodo_ids': list(self.literature_diseases)})['exclude'].tolist()[0]
        print('Cleaning gene...')
        gene_ids_to_exclude = db.get_data(
            'MATCH (n:Gene:db_NCBI) WITH collect(n.eid) AS entity_ids RETURN [entry in $zenodo_ids WHERE NOT entry IN entity_ids] AS exclude',
            {'zenodo_ids': list(self.literature_genes)})['exclude'].tolist()[0]

        # print('Cleaning chemical...')
        # with open(os.path.join(self.parsed_dir, self.file_prefix + 'chemical.tsv'), 'w') as f:
        #     f.writelines([s + '\n' for s in list(self.literature_chemicals - set(chemical_ids_to_exclude))])
        # print('Cleaning disease...')
        # with open(os.path.join(self.parsed_dir, self.file_prefix + 'disease.tsv'), 'w') as f:
        #     f.writelines([s + '\n' for s in list(self.literature_diseases - set(disease_ids_to_exclude))])
        # print('Cleaning gene...')
        # with open(os.path.join(self.parsed_dir, self.file_prefix + 'gene.tsv'), 'w') as f:
        #     f.writelines([s + '\n' for s in list(self.literature_genes - set(gene_ids_to_exclude))])

        cleaned_chemical_ids = list(self.literature_chemicals - set(chemical_ids_to_exclude))
        cleaned_disease_ids = list(self.literature_diseases - set(disease_ids_to_exclude))
        cleaned_gene_ids = list(self.literature_genes - set(gene_ids_to_exclude))
        self.clean_dependency_files(NODE_CHEMICAL, NODE_DISEASE, cleaned_chemical_ids, cleaned_disease_ids)
        self.clean_dependency_files(NODE_CHEMICAL, NODE_GENE, cleaned_chemical_ids, cleaned_gene_ids)
        self.clean_dependency_files(NODE_GENE, NODE_DISEASE, cleaned_gene_ids, cleaned_disease_ids)
        self.clean_dependency_files(NODE_GENE, NODE_GENE, cleaned_gene_ids, cleaned_gene_ids)

    def clean_dependency_files(self, entry1_type, entry2_type, entry1_ids, entry2_ids):
        input_file = f'{entry1_type}2{entry2_type}_assoc_theme.tsv'
        file_path = os.path.join(self.parsed_dir, input_file)
        converters = None
        if entry1_type == NODE_GENE or entry2_type == NODE_GENE:
            f = lambda x: str(x)
            converters = {'entry1_id': f, 'entry2_id': f}

        df = pd.read_csv(file_path, header=0, sep='\t', converters=converters, names=dependency_headers)
        df.drop_duplicates(inplace=True)
        df.set_index('entry1_id', inplace=True)
        df = df[df.index.isin(entry1_ids)]
        df.reset_index(inplace=True)
        df.set_index('entry2_id', inplace=True)
        df = df[df.index.isin(entry2_ids)]
        df.reset_index(inplace=True)

        df.to_csv(file_path, index=False, sep='\t', chunksize=50000)

    def parse_path2theme_file(self, entry1_type, entry2_type):
        file = self.get_path2theme_datafile_name(entry1_type, entry2_type)
        df = pd.read_csv(file, sep='\t', index_col='path')
        cols = [col for col in df.columns if not col.endswith('.ind')]
        df = df[cols]
        df['max'] = df.max(axis=1)
        df['sum'] = df[cols].sum(axis=1)
        # keep only scores that is max or relative score > 0.3
        for c in cols:
            df.loc[(df[c] < df['max']) & (df[c] / df['sum'] < 0.3), c] = np.nan
        df.reset_index(inplace=True)
        # melt columns - change matrix format to database table format
        df_theme = pd.melt(df, id_vars=['path', 'sum'], value_vars=cols, var_name='theme', value_name='score')
        df_theme.dropna(inplace=True)
        df_theme['relscore'] = df_theme['score'] / df_theme['sum']
        df_theme.set_index('path', inplace=True)
        df_theme.drop(['sum'], axis=1, inplace=True)
        df_theme.sort_index(inplace=True)
        df_theme.reset_index(inplace=True)
        df_theme.set_index('theme', inplace=True)
        # add theme description column
        themes = pd.DataFrame.from_dict(theme_map, orient='index', columns=['description'])
        themes.index.name = 'theme'
        df_path2theme = pd.merge(df_theme, themes, how='inner', left_index=True, right_index=True)
        df_path2theme.reset_index(inplace=True)
        return df_path2theme

    @staticmethod
    def get_create_literature_query(entry1_type, entry2_type):
        query = """
        UNWIND $rows AS row
        MERGE (n1:db_Literature:LiteratureEntity {eid:row.entry1_id})
            ON CREATE SET n1.name = apoc.text.join([c in apoc.text.split(row.entry1_name, ' ') | apoc.text.capitalize(toLower(c))], '')
            FOREACH (item IN CASE WHEN NOT '%s' IN labels(n1) THEN [1] ELSE [] END | SET n1:%s)
        MERGE (n2:db_Literature:LiteratureEntity {eid:row.entry2_id})
            ON CREATE SET n2.name = apoc.text.join([c in apoc.text.split(row.entry2_name,' ') | apoc.text.capitalize(toLower(c))], '')
            FOREACH (item IN CASE WHEN NOT '%s' IN labels(n2) THEN [1] ELSE [] END | SET n2:%s)
        WITH n1, n2, row
        MERGE (a:Association {eid:row.entry1_id + '-' + row.entry2_id + '-' + row.theme})
        ON CREATE
        SET a:db_Literature,
            a.entry1_type = '%s',
            a.entry2_type = '%s',
            a.description = row.description,
            a.type = row.theme,
            a.data_source = 'Literature'
        MERGE (n1)-[:ASSOCIATED {description:row.description, type:row.theme}]->(n2)
        MERGE (n1)-[:HAS_ASSOCIATION]->(a)
        MERGE (a)-[:HAS_ASSOCIATION]->(n2)
        """ % (
            f'Literature{entry1_type}',
            f'Literature{entry1_type}',
            f'Literature{entry2_type}',
            f'Literature{entry2_type}',
            entry1_type,
            entry2_type
        )
        return query

    @staticmethod
    def get_create_literature_snippet_pub_query():
        query = """
        UNWIND $rows AS row
        MERGE (s:Snippet {eid:row.snippet_id})
        ON CREATE
        SET s:db_Literature,
            s.pmid = row.pmid,
            s.sentence = row.sentence,
            s.data_source = 'Literature'
        WITH s, row
        MATCH (a:Association {eid:row.entry1_id + '-' + row.entry2_id + '-' + row.theme})
        MERGE (s)-[i:INDICATES {normalized_score:toFloat(row.relscore), raw_score:toFloat(row.score), entry1_text:row.entry1_name, entry2_text:row.entry2_name, path:row.path}]->(a)
        MERGE (pub:Publication {pmid:row.pmid}) SET pub:db_Literature
        MERGE (s)-[:IN_PUB]->(pub)
        """
        return query

    def clean_gene_column(self, df, column_name):
        """
        Remove tax_id from gene column, then split gene id's into multiple rows
        :param df:
        :return: cleaned df
        """
        df[column_name].replace(r"\(Tax[:][0-9]*\)", '', regex=True, inplace=True)
        new_df = df.set_index(df.columns.drop(column_name,1).tolist())[column_name].str.split(';', expand=True).stack()
        new_df = new_df.reset_index().rename(columns={0:column_name}).loc[:, df.columns]
        return new_df

    def clean_snippets(self):
        """Remove duplicates"""
        logging.info('clean snippet.tsv')
        df = pd.read_csv(os.path.join(self.parsed_dir, self.file_prefix + 'snippet.tsv'), sep='\t', header=0,
                            names=['id', 'pmid', 'sentence'])
        logging.info('total rows:' + str(len(df)))
        df.drop_duplicates(subset=['id'], inplace=True)
        logging.info('unique rows: ' + str(len(df)))
        translate = {'-LRB- ': '(', ' -RRB-': ')', '-LRB-': '(', '-RRB-': ')', '-LSB- ': '[', ' -RSB-': ']'}
        for current, replace in translate.items():
            df.sentence = df.sentence.str.replace(current, replace)
        df.to_csv(os.path.join(self.parsed_dir, self.file_prefix + 'snippet.tsv'), index=False, sep='\t', chunksize=50000)
        logging.info('done')

    def parse_and_write_data_files(self):
        df = pd.read_csv(os.path.join(self.parsed_dir, self.file_prefix + 'snippet.tsv'), sep='\t')

        for filename, (entity1_type, entity2_type) in [
            (ZENODO_CHEMICAL2DISEASE_FILE, (NODE_CHEMICAL, NODE_DISEASE)),
            (ZENODO_CHEMICAL2GENE_FILE, (NODE_CHEMICAL, NODE_GENE)),
            (ZENODO_GENE2DISEASE_FILE, (NODE_GENE, NODE_DISEASE)),
            (ZENODO_GENE2GENE_FILE, (NODE_GENE, NODE_GENE))
        ]:
            file_df = pd.read_csv(os.path.join(self.parsed_dir, filename), sep='\t')
            file_df['sentence'] = file_df.snippet_id.map(df.set_index('id')['sentence'].to_dict())
            file_df['pmid'] = file_df.snippet_id.map(df.set_index('id')['pmid'].to_dict())
            cols = list(file_df.columns.values)
            # put pmid column first
            cols = cols[-1:] + cols[:-1]
            reordered_df = file_df[cols]

            path_df = self.parse_path2theme_file(entity1_type, entity2_type)
            reordered_df2 = reordered_df.copy(deep=True)
            """
            The path_df has lower case paths, need to lower in order to merge.

            Quote from ref: https://zenodo.org/record/3459420

            A few users have mentioned that the dependency paths in the "part-i" files are all lowercase text,
            whereas those in the "part-ii" files maintain the case of the original sentence.
            This complicates mapping between the two sets of files.

            We kept the part-ii files in the same case as the original sentence to facilitate downstream
            debugging - it's easier to tell which words in a particular sentence are contributing to the
            dependency path if their original case is maintained. When working with the part-ii "with-themes" files,
            if you simply convert the dependency path to lowercase, it is guaranteed to match to one of the
            paths in the corresponding part-i file and you'll be able to get the theme scores.
            """
            reordered_df2['PATH'] = reordered_df2.path
            reordered_df2.path = reordered_df2.path.str.lower()
            # do a left-join
            reordered_df3 = reordered_df2.merge(path_df, how='left', left_on='path', right_on='path')
            del reordered_df2
            # revert the path column back to original casing
            reordered_df3.drop(columns=['path'], inplace=True)
            reordered_df3.rename(columns={'PATH': 'path'}, inplace=True)
            reordered_df3.dropna(inplace=True)
            reordered_df3.drop_duplicates(inplace=True)
            reordered_df3.to_csv(os.path.join(self.output_dir, self.file_prefix + filename), index=False, sep='\t', chunksize=50000)


def main(args):
    parser = LiteratureDataParser(args.prefix)
    parser.parse_dependency_files()
    parser.clean_snippets()
    parser.parse_and_write_data_files()

    for filename in [ZENODO_CHEMICAL2DISEASE_FILE, ZENODO_CHEMICAL2GENE_FILE, ZENODO_GENE2DISEASE_FILE, ZENODO_GENE2GENE_FILE]:
        parser.upload_azure_file(filename, args.prefix)


if __name__ == '__main__':
    main()
