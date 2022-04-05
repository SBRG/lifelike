import os.path

import pandas as pd

from common.graph_models import *
from common.base_parser import BaseParser
import logging
import gzip
import re
from typing import List


class OboParser(BaseParser):
    """
    Base parser to parse obo format files.
    """
    def __init__(self, data_source:str, obo_file:str, attributes_map: dict, relationships_map: dict, node_label, node_attrs=[]):
        """
        datasource: node data source, e.g. GO, CHEBI.
        """
        BaseParser.__init__(self, data_source.lower())
        self.data_source = data_source
        self.data_file = obo_file
        self.attributes_map = attributes_map
        self.relationships_map = relationships_map
        self.node_label = node_label
        self.node_id_name = PROP_ID
        self.attrs = node_attrs
        if not node_attrs:
            self.attrs = [v[0] for v in attributes_map.values() if v is not None]
        self.rel_names = set()
        self.id_prefix = ''
        self.nodes = None
        self.logger = logging.getLogger(__name__)

    def parse_obo_file(self, filename, gzfile=False):
        """
        Parse obo file, and return list of NodeData
        """
        file_path = os.path.join(self.download_dir, filename)
        if gzfile:
            with gzip.open(file_path, 'rt') as file_data:
                self.nodes = self._map_nodes(file_data)
        else:
            with open(file_path, 'r', encoding="ISO-8859-1") as file_data:
                self.nodes = self._map_nodes(file_data)
        self.logger.info(f'Total nodes: {len(self.nodes)}')
        return self.nodes

    def _map_nodes(self, file_data) -> List[NodeData]:
        nodes = list()
        for line in file_data:
            if line.strip().startswith('[Term]'):
                node = NodeData(self.node_label, self.node_id_name)
                for line in file_data:
                    # End processing of a single record
                    if line == '\n':
                        nodes.append(node)
                        break
                    # Processing single records
                    else:
                        attr_name, attr_val = line.split(': ', 1)
                        self._process_property(node, attr_name, attr_val)
        self.logger.info(f"Total nodes: {len(nodes)}")
        self.logger.info(f"Relationships: {self.rel_names}")
        return nodes

    def _process_property(self, node: NodeData, attr_name: str, attr_val: str):
        if not attr_name in self.attributes_map and not attr_name in self.relationships_map:
            return
        if attr_name == 'property_value':
            prop_identifier, value, _ = attr_val.split(' ')
            name_tokens = prop_identifier.rsplit('/', 1)
            name = name_tokens[1]
            value = value.replace('"', '')
            if name in self.attributes_map:
                attr_type = self.attributes_map[name]
                node.add_attribute(attr_type[0], value.strip(), attr_type[1])
        elif attr_name == 'synonym':
            match = re.search(r'".+"', attr_val)
            if match:
                value = match.group(0).replace('"', '').strip()
                if value != node.get_attribute(PROP_NAME):
                    node.add_attribute(PROP_SYNONYMS, value, 'str')
        elif attr_name in self.attributes_map:
            attr_type = self.attributes_map[attr_name]
            if '"' in attr_val:
                match = re.search(r'".+"', attr_val)
                if match:
                    attr_val = match.group(0).replace('"', '')
            attr_val = self._clean_attr_val(attr_val)
            node.add_attribute(attr_type[0], attr_val, attr_type[1])
        elif attr_name == 'relationship':
            vals = attr_val.split(' ')
            rel_name = vals[0].upper()
            rel_val = vals[1]
            rel_val = self._clean_attr_val(rel_val)
            rel_node = NodeData(self.node_label, self.node_id_name)
            rel_node.update_attribute(self.node_id_name, rel_val)
            node.add_edge(node, rel_node, rel_name)
            self.rel_names.add(rel_name)
        elif attr_name in self.relationships_map:
            vals = attr_val.split(' ')
            rel_val = self._clean_attr_val(vals[0])
            node.add_edge_type(self.relationships_map[attr_name], rel_val)

    def _clean_attr_val(self, attr_val):
        if self.id_prefix != '' and attr_val.startswith(self.id_prefix):
            attr_val = attr_val.replace(self.id_prefix, '')
        return attr_val.strip()

    def get_node_out_file(self):
        return self.data_source.lower() + '.tsv'

    def get_node_synonym_file(self):
        return f"{self.data_source.lower()}-synonyms.tsv"

    def get_node_rel_file(self):
        return f"{self.data_source.lower()}-rels.tsv"

    def get_zip_out_file(self):
        return f"{self.data_source.lower()}-data.zip"

    def parse_and_write_data_files(self, output_zip_file):
        gzfile = False
        if self.data_file.endswith(".gz"):
            gzfile = True
        nodes = self.parse_obo_file(self.data_file, gzfile)
        outfiles = list()
        outfiles.append(self.write_node_file(nodes, self.attrs, self.get_node_out_file()))
        synfile = self.write_synonyms_file(nodes, self.get_node_synonym_file())
        if synfile:
            outfiles.append(synfile)
        relfile = self.write_internal_relationships_file(nodes, self.get_node_rel_file())
        if relfile:
            outfiles.append(relfile)
        self.zip_output_files(outfiles, output_zip_file)











