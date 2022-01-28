from common.graph_models import *
import logging
import gzip
import re
from typing import List


class OboParser:
    """
    Base parser to parse obo format files.
    """
    def __init__(self, attributes_map: dict, relationships_map: dict, node_labels, node_id_attr_name: str):
        self.attributes_map = attributes_map
        self.relationships_map = relationships_map
        self.node_labels = node_labels
        self.node_id_name = node_id_attr_name
        self.rel_names = set()
        self.id_prefix = ''

    def parse_file(self, file_path) -> List[NodeData]:
        with open(file_path, 'r', encoding="ISO-8859-1") as file_data:
            return self._map_nodes(file_data)

    def parse_zip_file(self, zip_file_path) -> List[NodeData]:
        with gzip.open(zip_file_path, 'rt') as file_data:
            return self._map_nodes(file_data)

    def _map_nodes(self, file_data) -> List[NodeData]:
        nodes = list()
        for line in file_data:
            if line.strip().startswith('[Term]'):
                node = NodeData(self.node_labels, self.node_id_name)
                for line in file_data:
                    # End processing of a single record
                    if line == '\n':
                        nodes.append(node)
                        break
                    # Processing single records
                    else:
                        attr_name, attr_val = line.split(': ', 1)
                        self._process_property(node, attr_name, attr_val)
        logging.info(f"Total nodes: {len(nodes)}")
        logging.info(f"Relationships: {self.rel_names}")
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
            rel_node = NodeData(self.node_labels, self.node_id_name)
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
