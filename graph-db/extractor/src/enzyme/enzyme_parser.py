import pandas as pd
import logging
import re
import os

from common.base_parser import BaseParser
from common.constants import *
from common.query_builder import (
    get_create_relationships_query,
    get_create_synonym_relationships_query,
    get_create_update_nodes_query
)


ENZYME_FILE = 'enzyme.tsv'
ENZYME_SYNONYM_FILE = 'enzyme_synonym.tsv'
ENZYME_REL_FILE = 'enzyme_rels.tsv'

SEP = '[ ]{2,}'

class Enzyme:
    def __init__(self, code, name=''):
        self.ec_number = ''
        self.code = code
        self.set_ec_number()
        self.name = name
        self.set_ec_number()
        self.synonyms = []
        self.activities = []
        self.cofactors = []
        self.children = []
        self.labels = ['db_Enzyme', 'EC_Number']

    def add_synonym(self, name:str):
        self.synonyms.append(name)

    def add_activity(self, v:str):
        self.activities.append(v)

    def add_cofactor(self, v:str):
        self.cofactors.append(v)

    def add_child(self, e):
        self.children.append(e)

    def get_synonyms(self):
        return self.synonyms + [self.name]

    def set_ec_number(self):
        if not self.ec_number:
            codes = self.code.split('.')
            valid_codes = [c for c in codes if c != '-']
            self.ec_number = 'EC-' + '.'.join(valid_codes)

    def get_enzyme_dict(self):
        """
        Used for build node dataframe
        :return: dict for node properties
        """
        return {
            PROP_ID: self.ec_number,
            PROP_NAME: self.name,
            PROP_CODE: self.code,
            PROP_ACTIVITIES: ' | '.join(self.activities),
            PROP_COFACTORS: ' | '.join(self.cofactors)
        }

    def get_enzyme_synonyms(self):
        syns = list()
        syns.append({
            PROP_ID: self.ec_number,
            PROP_NAME: self.name
        })
        for syn in self.synonyms:
            syns.append({
                PROP_ID: self.ec_number,
                PROP_NAME: syn
            })
        return syns

    def get_parent2child(self):
        children = []
        for c in self.children:
            children.append({
                PROP_PARENT_ID: self.ec_number,
                PROP_ID: c.ec_number
            })
        return children


class EnzymeParser(BaseParser):
    def __init__(self, prefix: str, base_dir=None):
        BaseParser.__init__(self, prefix, DB_ENZYME.lower(), base_dir)
        self.class_file = 'enzclass.txt'
        self.data_file = 'enzyme.dat'
        self.logger = logging.getLogger(__name__)

    def parse_classes(self) -> dict:
        ec_classes = dict()
        with open(os.path.join(self.download_dir, self.class_file), 'r') as f:
            start = False
            for line in f:
                if line.startswith('1.'):
                    start = True
                if start:
                    row = re.split(SEP, line)
                    if len(row)==2:
                        id = row[0].replace(' ', '')
                        name = row[1].strip().strip('.')
                        ec_classes[id] = Enzyme(id, name)
        self.logger.info(f'enzyme classes: {len(ec_classes)}')
        return ec_classes

    def parse_data_files(self) -> list:
        """
        Parse both data files and return list of enzyme nodes
        """
        nodes = self.parse_classes()
        enz_nodes = self.parse_enz_data_file()
        nodes.update(enz_nodes)
        self.build_tree(nodes)
        return list(nodes.values())

    def parse_enz_data_file(self)->dict:
        """
        Parse enzyme data file, return dictionary with enzyme code as key, Enzyme object as value. The enzyme data file
        contains only leaf nodes
        :return: code-node dict
        """
        enzymes = dict()
        with open(os.path.join(self.download_dir, self.data_file), 'r') as f:
            enzyme = None
            for line in f:
                if line.startswith('ID  '):
                    code = self._get_data_val(line)
                    enzyme = Enzyme(code)
                    enzymes[code] = enzyme
                elif enzyme and line.startswith('DE  '):
                    enzyme.name = self._get_data_val(line)
                elif enzyme and line.startswith('AN  '):
                    enzyme.add_synonym(self._get_data_val(line))
                elif enzyme and line.startswith('CA  '):
                    enzyme.add_activity(self._get_data_val(line))
                elif enzyme and line.startswith('CF  '):
                    enzyme.add_cofactor(self._get_data_val(line))
        self.logger.info(f'enzymes: {len(enzymes)}')
        return enzymes

    def parse_classes(self)->dict:
        """
        parse enzyme classes file to get the parent node (enzyme classes, subclasses and sub-subclasses)
        :return: dict with enzyme code as key, Enzyme object as value
        """
        ec_classes = dict()
        with open(os.path.join(self.download_dir, self.class_file), 'r') as f:
            start = False
            for line in f:
                if line.startswith('1.'):
                    start = True
                if start:
                    row = re.split(SEP, line)
                    if len(row)==2:
                        id = row[0].replace(' ', '')
                        name = row[1].strip().strip('.')
                        ec_classes[id] = Enzyme(id, name)
        self.logger.info(f'enzyme classes: {len(ec_classes)}')
        return ec_classes

    def _get_data_val(self, line: str):
        row = re.split(SEP, line)
        return row[1].strip().strip('.')

    def _get_parent_code(self, enzyme:Enzyme):
        tokens = enzyme.code.split('.')
        for i in range(len(tokens), 1, -1):
            if tokens[i-1] != '-':
                tokens[i-1] = '-'
                return '.'.join(tokens)
        return None

    def build_tree(self, enzyme_dict: dict):
        """
        Build enzyme hierachy using enzyme code. Adding children for enzyme nodes
        :param enzyme_dict
        :return: updated enzyme dict with children data
        """
        for id, enz in enzyme_dict.items():
            parent_code = self._get_parent_code(enz)
            if parent_code:
                parent = enzyme_dict[parent_code]
                parent.add_child(enz)

    def load_data_to_neo4j(self):
        enzymes = self.parse_data_files()
        self.logger.info('load enzyme nodes')
        data = [enzyme.get_enzyme_dict() for enzyme in enzymes]
        self.logger.info(f'total enzymes: {len(data)}')
        df = pd.DataFrame.from_records(data)
        query = get_create_update_nodes_query(NODE_ENZYME, PROP_ID,
            [PROP_NAME, PROP_CODE, PROP_ACTIVITIES, PROP_COFACTORS], [NODE_EC_NUMBER])
        print(query)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + ENZYME_FILE)
        df.to_csv(outfile, index=False, sep='\t')

        self.logger.info('load enzyme synonyms')
        enzyme2syns = []
        for enzyme in enzymes:
            enzyme2syns += enzyme.get_enzyme_synonyms()
        df = pd.DataFrame.from_records(enzyme2syns)
        self.logger.info(f'enzyme synonyms: {len(df)}')
        query = get_create_synonym_relationships_query(NODE_ENZYME, PROP_ID, PROP_ID, PROP_NAME)
        print(query)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + ENZYME_SYNONYM_FILE)
        df.to_csv(outfile, index=False, sep='\t')

        self.logger.info('load enzyme parent-child relationships')
        parent2child_list = []
        for enzyme in enzymes:
            parent2child_list += enzyme.get_parent2child()
        df = pd.DataFrame.from_records(parent2child_list)
        self.logger.info(f'parent-child rels:{len(df)}')
        query = get_create_relationships_query(NODE_ENZYME, PROP_ID, PROP_ID, NODE_ENZYME, PROP_ID, PROP_PARENT_ID, REL_PARENT)
        print(query)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + ENZYME_REL_FILE)
        df.to_csv(outfile, index=False, sep='\t')


def main(args):
    parser = EnzymeParser(args.prefix)
    parser.load_data_to_neo4j()

    for filename in [ENZYME_FILE, ENZYME_SYNONYM_FILE, ENZYME_REL_FILE]:
        parser.upload_azure_file(filename, args.prefix)


if __name__ == '__main__':
    main()
