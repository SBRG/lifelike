from common.graph_models import *
from common.constants import *
import json

EDGE_DIRECTION_TO = 'to'
EDGE_DIRECTION_FROM = 'from'


class RelationshipType(object):
    """
    define relationship type for creating edge
    """
    def __init__(self, edge_label, direction: str, match_node: str, match_attr: str=None, match_attr_data_type='str'):
        self.label = edge_label
        self.direction = direction
        self.node_label = match_node
        self.match_attr = match_attr
        self.match_attr_data_type = match_attr_data_type


class Item(object):
    def __init__(self, label=None, id_attr: str = None):
        self.attributes = dict()
        self.label = label
        self.id_attr = id_attr

    def add_attribute(self, key, value, value_type=None):
        if key in self.attributes and (not value_type or value_type == 'str'):
            if key == PROP_COMMENT:
                separator = ' '
            else:
                separator = '|'
            self.attributes[key] = separator.join([self.attributes[key], value])
        else:
            self.update_attribute(key, value, value_type)

    def update_attribute(self, key: str, value, value_type=None):
        """
        :param key: attribute name
        :param value: attribute value
        :param value_type: value type, str, int or number
        :return:
        """
        if not value:
            self.attributes[key] = ''
        if type(value) is str:
            value = value.strip()
        if not value_type or value_type == 'str':
            self.attributes[key] = value
        elif value_type == 'int':
            if value.isdigit():
                self.attributes[key] = int(value)
        elif value_type == 'number' and value != 'NIL':
            try:
                f = float(value)
                if f:
                    self.attributes[key] = f
            except ValueError:
                return

    def get_attribute(self, key):
        if key in self.attributes:
            return self.attributes.get(key)
        return ''

    def get_id_attribute(self):
        return self.attributes.get(self.id_attr)

    def get_label(self):
        if self.label:
            return self.label
        return self.get_attribute('type')

    def get_label_str(self):
        if type(self.label) is str:
            return self.label
        elif type(self.label) is list:
            return ':'.join(self.label)

    def to_json(self):
        return json.dump(self.attributes)

    def get_es_index_attributes(self):
        index_attrs = dict()
        for key in self.attributes:
            if key in INDEXED_FIELDS:
                index_attrs.update({key: self.get_attribute(key)})
        return index_attrs

    def get_create_node_query(self):
        return 'CREATE (%s {%s})' % (self.get_label_str(), ','.join(self.get_parameters()))

    def to_dict(self):
        return self.attributes


class NodeData(Item):
    def __init__(self, node_label=None, id_attr: str = None):
        """
        :param node_id: only used for graphml data parser
        :param node_label: mostly str, but could be list of stringdb []
        """
        Item.__init__(self, node_label, id_attr)
        self.index_label = ''  # label name for id index, e.g. db_BioCyc for biocyc_id, db_RegulonDB for regulondb_id
        self.edges = []

    def add_label(self, new_labels:[]):
        self.label = self.get_label_list() + new_labels

    def get_label_list(self):
        if type(self.label) is str:
            return [self.label]
        return self.label

    def add_edge(self, source, dest, edge_label: str):
        self.edges.append(EdgeData(source, dest, edge_label))

    def add_edge_type(self, relationship_type: RelationshipType, related_attr_val):
        match_attr = relationship_type.match_attr
        if not match_attr:
            match_attr = self.id_attr
        related_node = NodeData(relationship_type.node_label, match_attr)
        related_node.update_attribute(match_attr, related_attr_val, relationship_type.match_attr_data_type)
        if relationship_type.direction == EDGE_DIRECTION_FROM:
            self.add_edge(related_node, self, relationship_type.label)
        else:
            self.add_edge(self, related_node, relationship_type.label)

    def get_index_label(self):
        if not self.index_label:
            if type(self.label) is str:
                self.index_label = self.label
            else:
                for l in self.label:
                    if not l.startswith('db_'):
                        self.index_label = l
                if not self.index_label:
                    self.index_label = self.label[0]
        return self.index_label

    def get_synonym_set(self, additional_properties=[]):
        val = self.get_attribute(PROP_SYNONYMS)
        synonyms = []
        name = self.get_attribute(PROP_NAME)
        if name:
            synonyms.append(name)
        name = self.get_attribute(PROP_OTHER_NAME)
        if additional_properties:
            for prop in additional_properties:
                val = self.get_attribute(prop)
                if val:
                    synonyms.append(val)
        if name:
            synonyms.append(name)
        if val:
            synonyms = synonyms + val.split('|')
        return set(synonyms)

    def get_entity2synonym_rows(self, additional_syn_properties=[]):
        """
        output rows for [entity_id, synonym_name], tab delimited
        :param additional_syn_properties:
        :return: rows of strings for entity-synonym
        """
        rows = []
        synonyms = self.get_synonym_set(additional_syn_properties)
        for syn in synonyms:
            rows.append(f'{self.get_attribute(self.id_attr)}\t{syn}\n')
        return rows

    def get_rel_rows(self):
        """
        output rows for relationships, in format [start_id, end_id, rel_type], tab delimited
        :return: list of string
        """
        rows = [f"{edge.source.get_attribute(PROP_ID)}\t{edge.dest.get_attribute(PROP_ID)}\t{edge.label}\n" for
                edge in self.edges]
        return rows

    def get_attr_values(self, attr_names:[]):
        return [self.get_attribute(attr) for attr in attr_names]

    @classmethod
    def get_entity_data_rows(cls, nodes: [], node_attributes: [], show_label_col=False):
        """
        Format nodes data as tab delimited file format
        :param nodes: list of NodeData
        :param node_attributes:
        :param show_label_col: if data file contains column for node label
        :return: list of string ending with '\n' that can write directly to file
        """
        rows = []
        for node in nodes:
            values = node.get_attr_values(node_attributes)
            if show_label_col:
                values.append(';'.join(node.get_label_list()))
            rows.append('\t'.join(values) + '\n')
        return rows

    @classmethod
    def get_entity_header_row(cls, node_attributes: [], id_prop: str, index_name, show_label_col=False):
        """
        Get header for neo4j-admin import
        :param node_attributes:
        :param id_prop: id property name
        :param index_name: index used for the id column
        :param show_label_col: if the data would contain node label column
        :return: string for the data header
        """
        headers = []
        for attr in node_attributes:
            if attr == id_prop:
                headers.append(f"{id_prop}:ID({index_name})")
            else:
                headers.append(attr)
        if show_label_col:
            headers.append(':LABEL')
        return '\t'.join(headers) + '\n'


class EdgeData(Item):
    def __init__(self, source: NodeData, dest: NodeData, edge_label: str = None):
        Item.__init__(self, edge_label)
        self.source: NodeData = source
        self.dest: NodeData = dest

    def get_create_edge_query(self, node_id_attr: str = None)->str:
        source_id_attr = node_id_attr
        dest_id_attr = node_id_attr
        if not node_id_attr:
            source_id_attr = self.source.id_attr
            dest_id_attr = self.dest.id_attr
        if self.attributes:
            query = """
            MATCH (n1),(n2) WHERE n1.%s = "%s" AND n2.%s = "%s"
            CREATE (n1)-[%s {%s}]->(n2)
            """ % (source_id_attr, self.source.get_attribute(source_id_attr),
                   dest_id_attr, self.dest.get_attribute(dest_id_attr),
                   self.get_label_str(), ','.join(self.get_parameters()))
        else:
            query = """
            MATCH (n1),(n2) WHERE n1.%s = "%s" AND n2.%s = "%s"
            CREATE (n1)-[:%s]->(n2)
            """ % (source_id_attr, self.source.get_attribute(source_id_attr),
                   dest_id_attr, self.dest.get_attribute(dest_id_attr), self.label)
        return query



