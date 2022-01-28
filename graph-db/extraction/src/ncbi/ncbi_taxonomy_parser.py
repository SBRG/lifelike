from common.base_parser import BaseParser
from common.constants import *

import csv
import io
import logging
import zipfile


"""
URL = 'https://ftp.ncbi.nlm.nih.gov/pub/taxonomy/new_taxdump/'
    nodes.dmp file consists of taxonomy nodes. The description for each node includes the following
    fields:
            tax_id                              -- node id in GenBank taxonomy database
            parent tax_id                       -- parent node id in GenBank taxonomy database
            rank                                -- rank of this node (superkingdom, kingdom, ...)
            embl code                           -- locus-name prefix; not unique
            division id                         -- see division.dmp file
            inherited div flag  (1 or 0)        -- 1 if node inherits division from parent
            genetic code id                     -- see gencode.dmp file
            inherited GC  flag  (1 or 0)        -- 1 if node inherits genetic code from parent
            mitochondrial genetic code id       -- see gencode.dmp file
            inherited MGC flag  (1 or 0)        -- 1 if node inherits mitochondrial gencode from parent
            GenBank hidden flag (1 or 0)        -- 1 if name is suppressed in GenBank entry lineage
            hidden subtree root flag (1 or 0)   -- 1 if this subtree has no sequence data yet
            comments                            -- free-text comments and citations

        Taxonomy names file (names.dmp): not all tax_id in the file
            tax_id          -- the id of node associated with this name
            name_txt        -- name itself
            unique name     -- the unique variant of this name if name not unique
            name class      -- (synonym, common name, ...)

        Full name lineage file fields:
            tax_id          -- node id
            tax_name        -- scientific name of the organism
            lineage         -- sequence of sncestor names separated by semicolon ';' denoting nodes' ancestors starting from the most distant one and ending with the immediate one


    For nodes.dmp, use only tax_id, parent_tax_id and rank fields
    For names.dmp, keep only names if name_class = synonym or 'scientific name'
"""

PROP_MAP = {
    'synonym': PROP_SYNONYMS,
    'scientific name': PROP_SCIENTIFIC_NAME
}
TOP_CLASS_TAXONOMY = ['Archaea', 'Bacteria', 'Eukaryota', 'Viruses']
EXCLUDED_NAMES = ['environmental sample']

NODE_ATTRS = [PROP_ID, PROP_NAME, PROP_RANK, PROP_CATEGORY, PROP_PARENT_ID]
SYNONYM_NODE_ATTRS = [PROP_ID, PROP_NAME, PROP_TYPE]

NODES_FILE = 'nodes.dmp'
NAMES_FILE = 'names.dmp'
LINEAGE_FILE = 'fullnamelineage.dmp'

NCBI_TAXONOMY_FILE = 'taxonomy.tsv'
NCBI_TAXONOMY_SYNONYM_FILE = 'taxonomy2synonym.tsv'

class Taxonomy:
    def __init__(self, tax_id, name):
        self.tax_id = tax_id
        self.name = name
        self.parent_tax_id = ''
        self.rank = ''
        self.names = dict()
        self.children = set()
        self.top_category:str = ''
        self.orig_id = ''

    def add_name(self, name, name_class):
        self.names[name] = name_class

    def add_child(self, child):
        self.children.add(child)

    def get_child_tax_ids(self):
        child_ids = []
        for tax in self.children:
            child_ids.append(tax.tax_id)
            child_ids += tax.get_child_tax_ids()
        return child_ids


class TaxonomyParser(BaseParser):
    def __init__(self, prefix: str, base_dir:str=None):
        BaseParser.__init__(self, prefix, 'taxonomy', base_dir)
        self.zip_file = os.path.join(self.download_dir, 'new_taxdump.zip')
        self.top_class_nodes = []
        self.logger = logging.getLogger(__name__)

    def parse_files(self) -> dict:
        ''' parse files, and get taxonomy nodes dict where key = tax_id'''
        nodes = dict()
        with zipfile.ZipFile(self.zip_file) as zp:
            with zp.open(LINEAGE_FILE, 'r') as f:
                self.logger.info(f'Parse file {LINEAGE_FILE}')
                items_file = io.TextIOWrapper(f)
                reader = csv.reader(items_file, delimiter='|')
                for row in reader:
                    tokens = [x.strip() for x in row]
                    tax = Taxonomy(tokens[0], tokens[1])
                    nodes[tax.tax_id] = tax
                    if tax.name in TOP_CLASS_TAXONOMY:
                        self.top_class_nodes.append(tax)

            with zp.open(NODES_FILE, 'r') as f:
                self.logger.info(NODES_FILE)
                items_file = io.TextIOWrapper(f)
                reader = csv.reader(items_file, delimiter='|')
                for row in reader:
                    tokens = [x.strip() for x in row]
                    tax_id = tokens[0]
                    if tax_id in nodes:
                        tax = nodes[tax_id]
                        tax.parent_tax_id = tokens[1]
                        tax.rank = tokens[2]
                        if tax.parent_tax_id:
                            parent_tax = nodes[tax.parent_tax_id]
                            parent_tax.add_child(tax)
                    else:
                        self.logger.info('Node not found', tax_id)

            with zp.open(NAMES_FILE, 'r') as f:
                self.logger.info(f'Parse {NAMES_FILE}')
                items_file = io.TextIOWrapper(f)
                reader = csv.reader(items_file, delimiter='|')
                for row in reader:
                    tokens = [x.strip() for x in row]
                    tax_id = tokens[0]
                    name_class = tokens[3]
                    if name_class == 'authority':
                        continue  # ignore 'authority' term
                    if tax_id not in nodes:
                        self.logger.error('Error: cannot find tax_id', tax_id)
                        continue
                    tax = nodes[tax_id]
                    name = '"' + tokens[1].replace('"', "'") + '"'
                    if len(tokens) < 4:
                        tax.add_name(name, '')
                    else:
                        tax.add_name(name, tokens[3])
        self.logger.info(f"total nodes {len(nodes)}")
        # set up top node class
        for top_tax in self.top_class_nodes:
            self._label_top_class_for_children(top_tax)
        return nodes

    def _label_top_class_for_children(self, tax:Taxonomy):
        if not tax.top_category:
            tax.top_category = tax.name
        for child in tax.children:
            child.top_category = tax.top_category
            self._label_top_class_for_children(child)

    def parse_and_write_data_files(self):
        nodes = self.parse_files()
        tax_file = open(os.path.join(self.output_dir, self.file_prefix + NCBI_TAXONOMY_FILE), 'w')
        synonym_file = open(os.path.join(self.output_dir, self.file_prefix + NCBI_TAXONOMY_SYNONYM_FILE), 'w')
        tax_file.write('\t'.join(NODE_ATTRS) + '\n')
        synonym_file.write('\t'.join(SYNONYM_NODE_ATTRS) + '\n')
        for tax_id, tax in nodes.items():
            if not tax.top_category:
                # skip unclassified and other
                continue
            if tax.parent_tax_id == tax.tax_id:
                tax.parent_tax_id = ''
            tax_file.write('\t'.join([tax_id, tax.name, tax.rank, tax.top_category, tax.parent_tax_id]) + '\n')
            for name, type in tax.names.items():
                synonym_file.write('\t'.join([tax_id, name, type]) + '\n')
        tax_file.close()
        synonym_file.close()


def main(args):
    parser = TaxonomyParser(args.prefix)
    parser.parse_and_write_data_files()

    for filename in [NCBI_TAXONOMY_FILE, NCBI_TAXONOMY_SYNONYM_FILE]:
        parser.upload_azure_file(filename, args.prefix)


if __name__ == '__main__':
    main()
