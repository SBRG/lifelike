import logging, tarfile, codecs
from common.constants import *
from common.graph_models import NodeData
from biocyc import utils as biocyc_utils
from common.base_parser import BaseParser
from tarfile import TarFile
import pandas as pd
import os

UNIQUE_ID = 'UNIQUE-ID'
NODE_LABEL = 'node_label'
LABEL = ':LABEL'


class DataFileParser(BaseParser):
    """
    Base parser for Biocyc .dat files.
    """
    def __init__(self, biocyc_dbname, tar_file, datafile_name, entity_name, attr_names:dict, rel_names:dict,
                 db_link_sources: dict=None):
        """
        :param biocyc_dbname: biocyc database name, eg. DB_ECOCYC, DB_HUMANCYC
        :param tar_file: tar file downloaded from biocyc website
        :param datafile_name: the data file name to process (in tar_file), e.g. genes.dat
        :param entity_name: The entity to process, e.g. Gene, Protein etc.
        :param attr_names: mapping for tagName and attrName
        :param rel_names:  mapping for tagName and relName
        :param db_link_sources:  mapping for tagName and linkRel
        """
        BaseParser.__init__(self, DB_BIOCYC.lower())
        self.input_zip = os.path.join(self.download_dir, tar_file)
        self.output_dir = os.path.join(self.output_dir, biocyc_dbname.lower())
        os.makedirs(self.output_dir, 0o777, True)
        self.biocyc_dbname = biocyc_dbname
        self.datafile = datafile_name
        self.entity_name = entity_name
        self.attr_name_map = attr_names
        self.rel_name_map = rel_names
        self.db_link_sources = db_link_sources
        self.attrs = []
        self.version = ''
        self.logger = logging.getLogger(__name__)

    @classmethod
    def get_node_outfile(cls, entity)->str:
        return f"{entity}.tsv"

    @classmethod
    def get_node_synonyms_outfile(cls, entity)->str:
        return f"{entity}-synonyms.tsv"

    @classmethod
    def get_node_rels_outfile(cls, entity)->str:
        return f"{entity}-rels.tsv"

    @classmethod
    def get_dblink_rel_outfile(cls, entity):
        return f"{entity}-dblinks.tsv"

    def get_db_version(self, tar:TarFile):
        """
        find the latest version of data in the tar file.  Sometimes a tar file has multiple version data.
        :param tar:
        :return:
        """
        versions = {}
        for file in tar.getmembers():
            data_path = os.path.sep + 'data'
            if data_path in file.name:
                sub = file.name.split(data_path)[0]
                paths = sub.split(os.path.sep)
                version = paths[-1]
                versions[float(version)] = version
        maxkey = max(versions.keys())
        return versions[maxkey]

    def parse_data_file(self):
        # self.logger.info('read ' + self.datafile + ' from ' + self.input_zip)
        with tarfile.open(self.input_zip, mode='r:gz') as tar:
            if not self.version:
                self.version = self.get_db_version(tar)
                self.logger.info(f'Database file version: "{self.version}"')
            for tarinfo in tar:
                if tarinfo.name.endswith(os.path.sep + self.datafile) and self.version in tarinfo.name:
                    self.logger.info('Parse ' + tarinfo.name)
                    utf8reader = codecs.getreader('ISO-8859-1')
                    f = utf8reader(tar.extractfile(tarinfo.name))
                    nodes = []
                    node = None
                    for line in f:
                        line = biocyc_utils.cleanhtml(line)
                        node = self.parse_line(line, node, nodes)
                    return nodes

    def parse_line(self, line, node, nodes):
        try:
            if line.startswith(UNIQUE_ID):
                node = NodeData(self.entity_name, PROP_BIOCYC_ID)
                nodes.append(node)
            if node:
                attr, val = biocyc_utils.get_attr_val_from_line(line)
                if attr in self.attr_name_map:
                    prop_name, data_type = biocyc_utils.get_property_name_type(attr, self.attr_name_map)
                    node.add_attribute(prop_name, val, data_type)
                    if attr == UNIQUE_ID:
                        node.add_attribute(PROP_ID, val, data_type)
                elif attr in self.rel_name_map:
                    # some rel could also be an attribute, e.g. types
                    if attr == 'DBLINKS':
                        tokens = val.split(' ')
                        if len(tokens) > 1:
                            db_name = tokens[0].lstrip('(')
                            reference_id = tokens[1].strip(')').strip('"')
                            self.add_dblink(node, db_name, reference_id )
                    else:
                        rel_type = self.rel_name_map.get(attr)
                        node.add_edge_type(rel_type, val)

        except Exception as ex:
            self.logger.error('line:', line)
        return node

    def add_dblink(self, node:NodeData, db_name, reference_id):
        link_node = NodeData(NODE_DBLINK, PROP_REF_ID)
        if reference_id.startswith(db_name):
            reference_id = reference_id[len(db_name)+1:]  # remove db prefix
        link_node.update_attribute(PROP_REF_ID, reference_id)
        link_node.update_attribute(PROP_DB_NAME, db_name)
        node.add_edge(node, link_node, REL_DBLINKS)

    def write_node_file(self, nodes: [], node_attrs:[], outfile:str):
        if not nodes:
            return None
        df = pd.DataFrame([node.to_dict() for node in nodes])
        cols = [c for c in node_attrs if c in df.columns]
        df = df[cols]
        df[PROP_ID] = df[PROP_BIOCYC_ID]
        df.fillna('', inplace=True)
        self.logger.info(f"writing {outfile}")
        df.to_csv(os.path.join(self.output_dir, outfile), index=False, sep='\t', quotechar='"')
        return outfile

    def write_relationships_files(self, nodes):
        if not nodes:
            return []
        df = pd.DataFrame([{
            REL_RELATIONSHIP: edge.label,
            PROP_FROM_ID: edge.source.get_id_attribute(),
            PROP_TO_ID: edge.dest.get_id_attribute(),
            PROP_DB_NAME: edge.dest.get_attribute(PROP_DB_NAME)
            } for node in nodes for edge in node.edges])
        if df.empty:
            return []
        outfiles = []
        # print(df.head())
        if self.db_link_sources:
            db_names = [v for v in self.db_link_sources.keys()]
            df_link = df[df[PROP_DB_NAME].isin(db_names)]
            df_link = df_link[[PROP_FROM_ID, PROP_TO_ID, PROP_DB_NAME]]
            dblinkfile = self.get_dblink_rel_outfile(self.entity_name)
            self.logger.info(f"writing {dblinkfile}")
            df_link.to_csv(os.path.join(self.output_dir, dblinkfile), sep='\t', index=False)
            outfiles.append(dblinkfile)
        df_rel = df[df[REL_RELATIONSHIP] != REL_DBLINKS]
        if len(df_rel) > 0:
            df_rel = df_rel[[REL_RELATIONSHIP, PROP_FROM_ID, PROP_TO_ID]]
            rel_outfile = self.get_node_rels_outfile(self.entity_name)
            self.logger.info(f"writing {rel_outfile}")
            df_rel.to_csv(os.path.join(self.output_dir, rel_outfile), sep='\t', index=False)
            outfiles.append(rel_outfile)
        return outfiles

    def parse_and_write_data_files(self, nodes:[]):
        if not nodes:
            return []
        self.logger.info(f"Parse {self.biocyc_dbname} {self.entity_name}: {len(nodes)}")
        # add data_source property
        node_file = self.write_node_file(nodes, self.attrs, self.get_node_outfile(self.entity_name))
        synonym_file = self.write_synonyms_file(nodes, self.get_node_synonyms_outfile(self.entity_name))
        rel_files = self.write_relationships_files(nodes)
        all_files = [node_file]
        if synonym_file:
            all_files.append(synonym_file)
        if rel_files:
            all_files += rel_files
        return all_files


