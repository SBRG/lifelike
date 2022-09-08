from config.config import Config
from common.base_parser import BaseParser
from common.constants import *
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

from biocyc import (class_parser, compound_parser, dnabindsite_parser,
                    enzymereaction_parser, gene_parser, pathway_parser,
                    promoter_parser, protein_parser, reaction_parser,
                    regulation_parser, rna_parser, species_parser,
                    terminator_parser,transcripitionunit_parser)

ENTITIES = [NODE_SPECIES, NODE_CLASS, NODE_COMPOUND, NODE_DNA_BINDING_SITE,
            NODE_GENE, NODE_TERMINATOR, NODE_PROMOTER,
            NODE_TRANS_UNIT, NODE_RNA, NODE_PROTEIN,
            NODE_REACTION, NODE_PATHWAY, NODE_ENZ_REACTION, NODE_REGULATION]

PARSERS = {
    NODE_CLASS: class_parser.ClassParser,
    NODE_COMPOUND: compound_parser.CompoundParser,
    NODE_DNA_BINDING_SITE: dnabindsite_parser.DnaBindSiteParser,
    NODE_ENZ_REACTION: enzymereaction_parser.EnzymeReactionParser,
    NODE_GENE: gene_parser.GeneParser,
    NODE_PATHWAY: pathway_parser.PathwayParser,
    NODE_PROMOTER: promoter_parser.PromoterParser,
    NODE_PROTEIN: protein_parser.ProteinParser,
    NODE_REACTION: reaction_parser.ReactionParser,
    NODE_REGULATION: regulation_parser.RegulationParser,
    NODE_RNA: rna_parser.RnaParser,
    NODE_SPECIES: species_parser.SpeciesParser,
    NODE_TERMINATOR: terminator_parser.TerminatorParser,
    NODE_TRANS_UNIT: transcripitionunit_parser.TranscriptionUnitParser,
}


class BiocycParser(BaseParser):
    def __init__(self, biocyc_dbname: str):
        """
        @param biocyc_dbname: biocyc database name, e.g. EcoCyc, HumanCyc, YeastCyc ...
        @param is_independent_db: if True, the database is not independent, not part of bigger database,
        then we don't need the db_BioCyc labels for all nodes
        """
        BaseParser.__init__(self, DB_BIOCYC.lower())
        self.output_dir = os.path.join(self.output_dir, biocyc_dbname.lower())
        self.tar_data_file = Config().get_biocyc_tar_file(biocyc_dbname)
        self.biocyc_dbname = biocyc_dbname
        self.version = ''
        self.logger = logging.getLogger(__name__)

    def get_parser(self, entity_name):
        return PARSERS[entity_name](self.biocyc_dbname, self.tar_data_file)

    @classmethod
    def get_data_output_zip(cls, biocyc_dbname, version):
        return f"{biocyc_dbname}-data-{version}.zip"

    def parse_and_write_data_files(self):
        """
        Use the default ENTITIES and DB_FILE_DICT to load all 4 biocyc databases into KG database. After load data,
        need to run scripts to set displayname and description.  See docs/biocyc/set_displayname_description.md
        :param database: the neo4j database to load data
        """
        all_files = []
        for entity in ENTITIES:
            self.logger.info(f"Load {self.biocyc_dbname}: {entity}")
            parser = self.get_parser(entity)
            parser.version = self.version
            if parser:
                nodes = parser.parse_data_file()
                if not self.version and parser.version:
                    self.version = parser.version
                if nodes:
                    all_files += parser.parse_and_write_data_files(nodes)
        zip_file = self.get_data_output_zip(self.biocyc_dbname, self.version)
        self.zip_output_files(all_files, zip_file)


def main(biocyc_dbname):
    parser = BiocycParser(biocyc_dbname)
    parser.parse_and_write_data_files()

if __name__ == "__main__":
    main(DB_ECOCYC)
