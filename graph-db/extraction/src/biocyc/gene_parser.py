from biocyc.data_file_parser import DataFileParser
from common.graph_models import *
from common.constants import *
import pandas as pd
import logging, os

ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'ACCESSION-1': (PROP_ACCESSION, 'str'),
    'ACCESSION-2': (PROP_ACCESSION2, 'str'),
    'LEFT-END-POSITION': (PROP_POS_LEFT, 'str'),
    'RIGHT-END-POSITION': (PROP_POS_RIGHT, 'str'),
    'TRANSCRIPTION-DIRECTION':(PROP_STRAND, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}

class GeneParser(DataFileParser):
    def __init__(self, db_name, tarfile):
        DataFileParser.__init__(self, db_name, tarfile, 'genes.dat', NODE_GENE,ATTR_NAMES, dict())
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_ACCESSION, PROP_ACCESSION2, PROP_POS_LEFT, PROP_POS_RIGHT,PROP_STRAND]
        self.logger = logging.getLogger(__name__)

    def extrace_synonyms(self, df:pd.DataFrame):
        """
        extract synonyms from 'synonyms' column, combine with name, return dataframe for id-synonym (columns[ID, NAME])
        """
        df_syn = df[[PROP_ID, PROP_SYNONYMS]].dropna()
        df_syn = df_syn[df_syn[PROP_SYNONYMS] != '']
        df_syn = df_syn.set_index(PROP_ID).synonyms.str.split('|', expand=True).stack()
        df_syn = df_syn.reset_index().rename(columns={0: PROP_NAME}).loc[:, [PROP_ID, PROP_NAME]]
        df_name = df[[PROP_ID, PROP_NAME]]
        df_accession = df[[PROP_ID, PROP_ACCESSION]]
        df_accession.columns = [PROP_ID, PROP_NAME]
        df_syn = pd.concat([df_name, df_accession, df_syn]).drop_duplicates()
        df_syn = df_syn[df_syn[PROP_NAME].str.len() > 1]
        return df_syn
