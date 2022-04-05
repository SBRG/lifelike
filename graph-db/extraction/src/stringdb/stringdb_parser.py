from common.base_parser import BaseParser
from common.constants import *
from config.config import Config
import pandas as pd
import os

PROT_INFO_HEADER = [PROP_ID, PROP_NAME, PROP_PROTEIN_SIZE, PROP_ANNOTATION]

class StringParser(BaseParser):
    def __init__(self, prot_info_file: str = None):
        """
        if prot_info_file is none, process all protein.info file in the download folder
        """
        BaseParser.__init__(self, 'string')
        self.filename = prot_info_file

    def parse_and_write_data_files(self, outputfile):
        if self.filename:
            self.add_data_to_outfile(self.filename, False)
        else:
            files = os.listdir(self.download_dir)
            append = False
            for file in files:
                if 'protein.info' in file and file.endswith('.txt.gz'):
                    print('read', file)
                    self.add_data_to_outfile(file, outputfile, append)
                    append = True

    def add_data_to_outfile(self, inputfile, outputfile, append=True):
        """
        read inputfile, and write into outputfile.  If append = False, write header. Otherwise append data without header
        """
        chunks = pd.read_csv(os.path.join(self.download_dir, inputfile), sep='\t', skiprows=1,
                         names=PROT_INFO_HEADER, compression='gzip', chunksize=20000)
        datafile = 'string-data.tsv'
        outfile = os.path.join(self.output_dir, datafile)
        for i, chunk in enumerate(chunks):
            if not append and i==0:
                mode = 'w'
                header = True
            else:
                mode = 'a'
                header = False
            chunk.to_csv(outfile, index=False, sep='\t', header=header, mode=mode)
        self.zip_output_files([datafile], outputfile)


if __name__ == '__main__':
    outputfile = "string-data-v11.5.zip"
    parser = StringParser()
    parser.parse_and_write_data_files(outputfile)
