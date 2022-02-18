import os
import csv
import gzip
import logging

from common.base_parser import BaseParser
from common.constants import *

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

STRING_TAX_IDS = ['9606', '511145', '160488', '559292', '4932']

class StringProtein:
    def __init__(self):
        self.id = ''
        self.name = ''
        self.protein_size = ''
        self.annotation = ''
        self.refseq = ''
        self.tax_id = ''

STRING2GENE_FILE = 'string2gene.tsv'
STRING_FILE = 'string.tsv'


class StringParser(BaseParser):
    def __init__(self, prefix: str):
        BaseParser.__init__(self, prefix, 'string')

    def parse_protein_info(self):
        """
        Parse protein info files, and get a map for string_id->StringProtein
        :return: dict with key = string_id, value = StringProtein
        """
        files = os.listdir(self.download_dir)
        protein_map = dict()
        for file in files:
            if file.endswith('.gz') and 'protein.info' in file:
                with gzip.open(os.path.join(self.download_dir, file), 'rt') as f:
                    logging.info(f'parse file: {file}')
                    f.readline()
                    reader = csv.reader(f, delimiter='\t')
                    for row in reader:
                        protein = StringProtein()
                        protein.id = row[0]
                        protein.name = row[1]
                        protein.protein_size = row[2]
                        protein.annotation = '"' + row[3].replace('"', '') + '"'
                        protein.tax_id = protein.id[:protein.id.find('.')]
                        protein_map[protein.id] = protein

        for file in files:
            if file.endswith('.gz') and 'refseq_2_string' in file:
                logging.info(f'parse data from {file}')
                with gzip.open(os.path.join(self.download_dir, file), 'rt') as f:
                    f.readline()
                    reader = csv.reader(f, delimiter='\t')
                    for row in reader:
                        id = row[2]
                        if id in protein_map:
                            protein = protein_map[id]
                            # protein.tax_id = row[0]
                            protein.refseq = row[1]
        return protein_map.values()

    def write_protein_info_file(self):
        """
        write string protein info to tsv file for given organisms (in download folder).
        protein fields: id, name, tax_id, refseq, annotation
        :return: None
        """
        logging.info('write file string.tsv')
        proteins = self.parse_protein_info()
        with open(os.path.join(self.output_dir, self.file_prefix + 'string.tsv'), 'w') as f:
            # cols: id, name, protein_size, annotation
            f.write('\t'.join([PROP_ID, PROP_NAME, 'protein_size', 'annotation', 'tax_id', 'refseq']) + '\n')
            for protein in proteins:
                f.write('\t'.join([protein.id, protein.name, protein.protein_size, protein.annotation, protein.tax_id, protein.refseq]) + '\n')
        logging.info('total strings: ' + str(len(proteins)))

    def write_data_files_for_import(self):
        self.write_protein_info_file()
        self.write_gene2accession_file()
        self.write_string2gene()

    def write_gene2accession_file(self, tax_ids=[]):
        logging.info('writing gene2accession.tsv')
        input_file = os.path.join(self.download_dir, 'gene2accession.gz')
        output_file = os.path.join(self.output_dir, 'gene2accession.tsv')
        with gzip.open(input_file, 'rt') as f, open(output_file, 'w') as outfile:
            outfile.write('\t'.join(['tax_id', 'gene_id', 'protein_accession']) + '\n')
            f.readline()
            for line in f:
                row = line.split('\t')
                if row[5].strip() == '-':
                    continue
                if not tax_ids or (tax_ids and row[0].strip() in tax_ids):
                    outfile.write('\t'.join([row[0], row[1], row[5].split('.')[0]]) + '\n')

    def write_string2gene(self):
        logging.info('writing string2gene.tsv')
        # match string protein with NCBI genes through gene2accession.  The refseq in STRING DB are actually accession for NCBI genes
        # create lookup dict for accession-to-geneId
        # get accession-gene dict
        with open(os.path.join(self.output_dir, 'gene2accession.tsv'), 'r') as f:
            reader = csv.reader(f,  delimiter='\t')
            next(reader) # skip headers
            accession2gene_map = {row[2]:row[1] for row in reader}

        output_string_file = os.path.join(self.output_dir, self.file_prefix + 'string.tsv')
        output_string2gene_file = os.path.join(self.output_dir, self.file_prefix + 'string2gene.tsv')
        # output_string2gene_count_file = os.path.join(self.output_dir, self.file_prefix + 'string2gene_count.tsv')

        with open(output_string_file, 'r') as f, open(output_string2gene_file, 'w') as out:  # , open(output_string2gene_count_file, 'w') as cnt:
            reader = csv.reader(f, delimiter='\t')
            next(reader) # skip headers
            out.write('\t'.join(['string_id', 'gene_id']) + '\n')
            for row in reader:
                if row[5]:
                    refseqs = row[5].split('|')
                    genes = set(accession2gene_map[reqseq] for reqseq in refseqs if reqseq in accession2gene_map)
                    out.writelines([f'{row[0]}\t{g}\n' for g in genes])
                    # cnt.write(f'{row[0]}\t{len(genes)}\n')


def main(args):
    parser = StringParser(args.prefix)
    parser.write_data_files_for_import()

    for filename in [STRING_FILE, STRING2GENE_FILE]:
        parser.upload_azure_file(filename, args.prefix)


if __name__ == '__main__':
    main()

