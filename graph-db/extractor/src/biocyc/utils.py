from common.graph_models import *
import re

BIOCYC_ATTR_NAMES = {'ABBREV-NAME': (),
                     'ABS-CENTER-POS': ('', 'number'),
                     'ABSOLUTE-PLUS-1-POS': ('', 'int'),
                     'ABSTRACT': (),
                     'ACCESSION-1': (PROP_ACCESSION, 'str'),
                     'ACCESSION-2': (),
                     'ALTERNATE-SEQUENCE': (),
                     'ANTI-ANTITERM-END-POS': ('', 'int'),
                     'ANTI-ANTITERM-START-POS': ('', 'int'),
                     'ANTICODON': (),
                     'ANTITERMINATOR-END-POS': ('', 'int'),
                     'ANTITERMINATOR-START-POS': ('', 'int'),
                     'ATOM-CHARGES': (),
                     'ATOM-MAPPINGS': (),
                     'ATTACHED-GROUP': (),
                     'AUTHORS': (),
                     'CATALYTIC-ACTIVITY': (),
                     # 'CENTISOME-POSITION': ('', 'number'),
                     'CHARGE': (),
                     'CHEMICAL-FORMULA': (),
                     'CODING-SEGMENTS': (),
                     'COMMENT': (),
                     'COMMON-NAME': (),
                     'COMPONENT-COEFFICIENTS': (),
                     'CONSENSUS-SEQUENCE': (),
                     'COPY-NUMBER': (),
                     'CREDITS': (),
                     'DATA-SOURCE': (),
                     'DELTAG0': (),
                     'DIAGRAM-INFO': (),
                     'DNA-FOOTPRINT-SIZE': (),
                     'EC-NUMBER': (PROP_EC_NUMBER, 'str'),
                     # 'ENGINEERED?': (),
                     'INCHI': (),
                     'INCHI-KEY': (),
                     'LEFT-END-POSITION': (PROP_POS_LEFT, 'int'),
                     'LOCATIONS': (),
                     'MECHANISM': (),
                     'MEDLINE-UID': (),
                     'MODE': (),
                     'NCBI-TAXONOMY-ID': (),
                     'RATE-LIMITING-STEP': (),
                     'REACTION-DIRECTION': (),
                     'REACTION-LAYOUT': (),
                     'RIGHT-END-POSITION': (PROP_POS_RIGHT, 'int'),
                     'RXN-LOCATIONS': (),
                     'SEQUENCE-SOURCE': (),
                     'SIGNAL': (),
                     'SITE-LENGTH': ('', 'int'),
                     'SMILES': (),
                     'SOURCE': (),
                     'SPECIFIC-ACTIVITY': (),
                     'SPLICE-FORM-INTRONS': (),
                     'SPONTANEOUS?': ('spontaneous', None),
                     'STRAIN-NAME': (),
                     'SYMMETRY': (),
                     'SYNONYMS': (PROP_SYNONYMS, 'str'),
                     'SYSTEMATIC-NAME': (),
                     'TITLE': (),
                     'TYPES': (),
                     'TRANSCRIPTION-DIRECTION': (),
                     'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
                     'URL': (),
                     'YEAR': ('', 'int'), }


def get_attr_name_from_line(line: str)->str:
    if not line.startswith('/'):
        tokens = line.split(' - ')
        if len(tokens) > 1:
            return tokens[0]
    return None


def get_attr_val_from_line(line: str) ->():
    tokens = line.split(' - ')
    if len(tokens) > 1:
        attr = tokens[0]
        value = tokens[1].strip()
        return attr, value
    else:
        return None, None


def get_property_name_type(attr_name: str, attr_name_map=None):
    if not attr_name_map:
        attr_name_map = BIOCYC_ATTR_NAMES
    if attr_name in attr_name_map:
        name_type = attr_name_map[attr_name]
        if not name_type:
            return attr_name.lower().replace('-', '_'), None
        else:
            name = name_type[0]
            type = name_type[1]
            if not name:
                name = attr_name.lower().replace('-', '_')
            return name, type
    return None, None

def cleanhtml(raw_html):
    cleanr = re.compile('<.*?>')
    cleantext = re.sub(cleanr, '', raw_html)
    return cleantext



