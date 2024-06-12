import os, gzip
from config.config import Config
from common.constants import *
from zipfile import ZipFile
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])
"""
Parsers read the downloaded file from download directory, parse and format data, write into tsv files.  
Then zip the output tsv files into a zip file
"""
class BaseParser:
    REL_LABEL_COL = 'REL_TYPE'
    NODE_LABEL_COL = 'NODE_LABEL'
    IGNORE = ':IGNORE'

    def __init__(self, data_dir_name, base_dir: str = None):
        if not base_dir:
            base_dir = Config().data_dir
        self.base_dir = base_dir
        self.download_dir = os.path.join(self.base_dir, 'download', data_dir_name)
        self.output_dir = os.path.join(self.base_dir, 'processed', data_dir_name)
        os.makedirs(self.output_dir, 0o777, True)

    def output_sample_import_file(self):
        """
        This is for exam data only.  Some files are too big to view.
        Read all files in the download folder and write the fist 5000 lines to a .s file
        """
        for file in os.listdir(self.download_dir):
            if file.endswith('.gz'):
                inputfilename = os.path.join(self.download_dir, file)
                outfilename = os.path.join(self.download_dir, file.replace('.gz', '.s'))
                with gzip.open(inputfilename, 'rt') as input, open(outfilename, 'w') as output:
                    rowcnt = 0
                    for line in input:
                        output.write(line)
                        rowcnt += 1
                        if rowcnt > 5000:
                            break

    def extrace_synonyms(self, df:pd.DataFrame):
        """
        extract synonyms from 'synonyms' column, combine with name, return dataframe for id-synonym (columns[ID, NAME])
        """
        df_syn = pd.DataFrame()
        if PROP_SYNONYMS in df.columns:
            df_syn = df[[PROP_ID, PROP_SYNONYMS]].dropna()
            df_syn = df_syn[df_syn[PROP_SYNONYMS] != '']
            df_syn = df_syn.set_index(PROP_ID).synonyms.str.split('|', expand=True).stack()
            df_syn = df_syn.reset_index().rename(columns={0: PROP_NAME}).loc[:, [PROP_ID, PROP_NAME]]
        df_name = df[[PROP_ID, PROP_NAME]]
        df_syn = pd.concat([df_name, df_syn]).drop_duplicates()
        df_syn = df_syn[df_syn[PROP_NAME].str.len() > 1]
        return df_syn

    def zip_output_files(self, output_files:[], zip_file):
        os.chdir(self.output_dir)
        with ZipFile(zip_file, 'w') as zipfile:
            for f in output_files:
                zipfile.write(f)

    def parse_and_write_data_files(self):
        pass

    def write_node_file(self, nodes: [], node_attrs:[], outfile:str):
        if not nodes:
            return None
        df = pd.DataFrame([node.to_dict() for node in nodes])
        cols = [c for c in node_attrs if c in df.columns]
        df = df[cols]
        df.fillna('', inplace=True)
        self.logger.info(f"writing {outfile}")
        df.to_csv(os.path.join(self.output_dir, outfile), index=False, sep='\t', quotechar='"')
        return outfile

    def write_synonyms_file(self, nodes:[], outfile:str):
        if not nodes:
            return None
        df = pd.DataFrame([node.to_dict() for node in nodes])
        df_syn = self.extrace_synonyms(df)
        if not df_syn.empty:
            self.logger.info(f"writing {outfile}")
            df_syn.to_csv(os.path.join(self.output_dir, outfile), sep='\t', index=False)
            return outfile
        return None

    def write_internal_relationships_file(self, nodes:[], outfile:str):
        """
        This is used for relationships bebetween the same data source entities, e.g. gene-protein within BioCyc database
        """
        if not nodes:
            nodes = None
        df = pd.DataFrame([{
            REL_RELATIONSHIP: edge.label,
            PROP_FROM_ID: edge.source.get_id_attribute(),
            PROP_TO_ID: edge.dest.get_id_attribute()
        } for node in nodes for edge in node.edges])
        if len(df) > 0:
            self.logger.info(f"writing {outfile}")
            df.to_csv(os.path.join(self.output_dir, outfile), sep='\t', index=False)
            return outfile
        return None

