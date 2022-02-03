import io
import json
import math
import re
import typing
import zipfile
import tempfile
from urllib.parse import urljoin

from base64 import b64encode

from io import BufferedIOBase
from typing import Optional, List

import textwrap
import graphviz
import requests
import svg_stack
from graphviz import escape
from flask import current_app

from pdfminer import high_level
from bioc.biocjson import BioCJsonIterWriter, fromJSON as biocFromJSON, toJSON as biocToJSON
from jsonlines import Reader as BioCJsonIterReader, Writer as BioCJsonIterWriter
import os
import bioc
from marshmallow import ValidationError
from PyPDF4 import PdfFileWriter, PdfFileReader
from PIL import Image
from lxml import etree

from neo4japp.models import Files
from neo4japp.schemas.formats.drawing_tool import validate_map
from neo4japp.schemas.formats.enrichment_tables import validate_enrichment_table
from neo4japp.schemas.formats.graph import validate_graph
from neo4japp.services.file_types.exports import FileExport, ExportFormatError
from neo4japp.services.file_types.service import BaseFileTypeProvider
from neo4japp.utils.logger import EventLog
from neo4japp.constants import (
    ANNOTATION_STYLES_DICT,
    ARROW_STYLE_DICT,
    BORDER_STYLES_DICT,
    DEFAULT_BORDER_COLOR,
    DEFAULT_FONT_SIZE,
    DEFAULT_NODE_WIDTH,
    DEFAULT_NODE_HEIGHT,
    MAX_LINE_WIDTH,
    BASE_ICON_DISTANCE,
    IMAGE_HEIGHT_INCREMENT,
    FONT_SIZE_MULTIPLIER,
    SCALING_FACTOR,
    FILE_MIME_TYPE_DIRECTORY,
    FILE_MIME_TYPE_PDF,
    FILE_MIME_TYPE_BIOC,
    FILE_MIME_TYPE_MAP,
    FILE_MIME_TYPE_GRAPH,
    FILE_MIME_TYPE_ENRICHMENT_TABLE,
    ICON_SIZE,
    FRONTEND_URL,
    BYTE_ENCODING,
    DEFAULT_DPI,
    POINT_TO_PIXEL,
    HORIZONTAL_TEXT_PADDING,
    LABEL_OFFSET,
    MAP_ICON_OFFSET,
    PDF_MARGIN,
    NAME_NODE_OFFSET,
    TRANSPARENT_PIXEL,
    VERTICAL_NODE_PADDING,
    NAME_LABEL_FONT_AVERAGE_WIDTH,
    NAME_LABEL_PADDING_MULTIPLIER,
    FILENAME_LABEL_MARGIN,
    FILENAME_LABEL_FONT_SIZE,
    IMAGES_RE,
    ASSETS_PATH,
    ICON_NODES,
    RELATION_NODES,
    DETAIL_TEXT_LIMIT,
    DEFAULT_IMAGE_NODE_WIDTH,
    DEFAULT_IMAGE_NODE_HEIGHT,
    LogEventType,
    IMAGE_BORDER_SCALE,
    WATERMARK_DISTANCE,
    WATERMARK_WIDTH,
    WATERMARK_ICON_SIZE
)

# This file implements handlers for every file type that we have in Lifelike so file-related
# code can use these handlers to figure out how to handle different file types
from neo4japp.utils.string import extract_text

extension_mime_types = {
    '.pdf': 'application/pdf',
    '.llmap': 'vnd.lifelike.document/map',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    # TODO: Use a mime type library?
}


def is_valid_doi(doi):
    try:
        # not [bad request, not found] but yes to 403 - no access
        return requests.get(doi,
                            headers={
                                # sometimes request is filtered if there is no user-agent header
                                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) "
                                              "AppleWebKit/537.36 "
                                              "(KHTML, like Gecko) Chrome/51.0.2704.103 "
                                              "Safari/537.36"
                            }
                            ).status_code not in [400, 404]
    except Exception as e:
        return False


# ref: https://stackoverflow.com/a/10324802
# Has a good breakdown of the DOI specifications,
# in case need to play around with the regex in the future
doi_re = re.compile(
    # match label pointing that it is DOI
    rb'(doi[\W]*)?'
    # match url to doi.org
    # doi might contain subdomain or 'www' etc.
    rb'((?:https?:\/\/)(?:[-A-z0-9]*\.)*doi\.org\/)?'
    # match folder (10) and register name
    rb'(10\.[0-9]{3,}(?:[\.][0-9]+)*\/)'
    # try match commonly used DOI format
    rb'([-A-z0-9]*)'
    # match up to first space (values after # are ~ignored anyway)
    rb'([^ \n\f#]*)'
    # match up to 20 characters in the same line (values after # are ~ignored anyway)
    rb'([^\n\f#]{0,20})',
    flags=re.IGNORECASE
)  # noqa
protocol_re = re.compile(r'https?:\/\/')
unusual_characters_re = re.compile(r'([^-A-z0-9]+)')
characters_groups_re = re.compile(r'([a-z]+|[A-Z]+|[0-9]+|-+|[^-A-z0-9]+)')
common_escape_patterns_re = re.compile(rb'\\')
dash_types_re = re.compile(bytes("[‐᠆﹣－⁃−¬]+", BYTE_ENCODING))
# Used to match the links in maps during the export
SANKEY_RE = re.compile(r'^ */projects/.+/sankey/.+$')
MAIL_RE = re.compile(r'^ *mailto:.+$')
ENRICHMENT_TABLE_RE = re.compile(r'^ */projects/.+/enrichment-table/.+$')
DOCUMENT_RE = re.compile(r'^ */projects/.+/files/.+$')
BIOC_RE = re.compile(r'^ */projects/.+/bioc/.+$')
ANY_FILE_RE = re.compile(r'^ */files/.+$')
# As other links begin with "projects" as well, we are looking for those without additional slashes
# looking like /projects/Example or /projects/COVID-19
PROJECTS_RE = re.compile(r'^ */projects/(?!.*/.+).*')
ICON_DATA: dict = {}
PDF_PAD = 1.0


def _search_doi_in(content: bytes) -> Optional[str]:
    doi: Optional[str]
    try:
        for match in doi_re.finditer(content):
            label, url, folderRegistrant, likelyDOIName, tillSpace, DOISuffix = \
                [s.decode(BYTE_ENCODING, errors='ignore') if s else '' for s in match.groups()]
            certainly_doi = label + url
            url = 'https://doi.org/'
            # is whole match a DOI? (finished on \n, trimmed whitespaces)
            doi = ((url + folderRegistrant + likelyDOIName + tillSpace +
                    DOISuffix).strip())
            if is_valid_doi(doi):
                return doi
            # is match till space a DOI?
            doi = (url + folderRegistrant + likelyDOIName + tillSpace)
            if is_valid_doi(doi):
                return doi
            # make deep search only if there was clear indicator that it is a doi
            if certainly_doi:
                # if contains escape patterns try substitute them
                if common_escape_patterns_re.search(match.group()):
                    doi = _search_doi_in(
                        common_escape_patterns_re.sub(
                            b'', match.group()
                        )
                    )
                    if is_valid_doi(doi):
                        return doi
                # try substitute different dash types
                if dash_types_re.search(match.group()):
                    doi = _search_doi_in(
                        dash_types_re.sub(
                            b'-', match.group()
                        )
                    )
                    if is_valid_doi(doi):
                        return doi
                # we iteratively start cutting off suffix on each group of
                # unusual characters
                try:
                    reversedDOIEnding = (tillSpace + DOISuffix)[::-1]
                    while reversedDOIEnding:
                        _, _, reversedDOIEnding = characters_groups_re.split(
                            reversedDOIEnding, 1)
                        doi = (
                                url + folderRegistrant + likelyDOIName + reversedDOIEnding[::-1]
                        )
                        if is_valid_doi(doi):
                            return doi
                except Exception:
                    pass
                # we iteratively start cutting off suffix on each group of either
                # lowercase letters
                # uppercase letters
                # numbers
                try:
                    reversedDOIEnding = (likelyDOIName + tillSpace)[::-1]
                    while reversedDOIEnding:
                        _, _, reversedDOIEnding = characters_groups_re.split(
                            reversedDOIEnding, 1)
                        doi = (
                                url + folderRegistrant + reversedDOIEnding[::-1]
                        )
                        if is_valid_doi(doi):
                            return doi
                except Exception:
                    pass
                # yield 0 matches on test case
                # # is it a DOI in common format?
                # doi = (url + folderRegistrant + likelyDOIName)
                # if self._is_valid_doi(doi):
                #     print('match by common format xxx')
                #     return doi
                # in very rare cases there is \n in text containing doi
                try:
                    end_of_match_idx = match.end(0)
                    first_char_after_match = content[end_of_match_idx:end_of_match_idx + 1]
                    if first_char_after_match == b'\n':
                        doi = _search_doi_in(
                            # new input = match + 50 chars after new line
                            match.group() +
                            content[end_of_match_idx + 1:end_of_match_idx + 1 + 50]
                        )
                        if is_valid_doi(doi):
                            return doi
                except Exception as e:
                    pass
    except Exception as e:
        pass
    return None


class DirectoryTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_DIRECTORY
    SHORTHAND = 'directory'
    mime_types = (MIME_TYPE,)

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        # Figure out file size
        buffer.seek(0, io.SEEK_END)
        size = buffer.tell()

        if size > 0:
            raise ValueError("Directories can't have content")


class PDFTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_PDF
    SHORTHAND = 'pdf'
    mime_types = (MIME_TYPE,)

    def detect_mime_type(self, buffer: BufferedIOBase) -> List[typing.Tuple[float, str]]:
        return [(0, self.MIME_TYPE)] if buffer.read(5) == b'%PDF-' else []

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        # TODO: Actually validate PDF content
        pass

    def extract_doi(self, buffer: BufferedIOBase) -> Optional[str]:
        data = buffer.read()
        buffer.seek(0)

        # Attempt 1: search through the first N bytes (most probably containing only metadata)
        chunk = data[:2 ** 17]
        doi = _search_doi_in(chunk)
        if doi is not None:
            return doi

        # Attempt 2: search through the first two pages of text (no metadata)
        fp = io.BytesIO(data)
        text = high_level.extract_text(fp, page_numbers=[0, 1], caching=False)
        doi = _search_doi_in(bytes(text, encoding='utf8'))

        return doi

    def _is_valid_doi(self, doi):
        try:
            # not [bad request, not found] but yes to 403 - no access
            return requests.get(doi,
                                headers={
                                    # sometimes request is filtered if there is no user-agent header
                                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) "
                                                  "AppleWebKit/537.36 "
                                                  "(KHTML, like Gecko) Chrome/51.0.2704.103 "
                                                  "Safari/537.36"
                                }
                                ).status_code not in [400, 404]
        except Exception as e:
            return False

    # ref: https://stackoverflow.com/a/10324802
    # Has a good breakdown of the DOI specifications,
    # in case need to play around with the regex in the future
    doi_re = re.compile(
        # match label pointing that it is DOI
        rb'(doi[\W]*)?'
        # match url to doi.org
        # doi might contain subdomain or 'www' etc.
        rb'((?:https?:\/\/)(?:[-A-z0-9]*\.)*doi\.org\/)?'
        # match folder (10) and register name
        rb'(10\.[0-9]{3,}(?:[\.][0-9]+)*\/)'
        # try match commonly used DOI format
        rb'([-A-z0-9]*)'
        # match up to first space (values after # are ~ignored anyway)
        rb'([^ \n\f#]*)'
        # match up to 20 characters in the same line (values after # are ~ignored anyway)
        rb'([^\n\f#]{0,20})',
        flags=re.IGNORECASE
    )  # noqa
    protocol_re = re.compile(r'https?:\/\/')
    unusual_characters_re = re.compile(r'([^-A-z0-9]+)')
    characters_groups_re = re.compile(r'([a-z]+|[A-Z]+|[0-9]+|-+|[^-A-z0-9]+)')
    common_escape_patterns_re = re.compile(rb'\\')
    dash_types_re = re.compile(bytes("[‐᠆﹣－⁃−¬]+", BYTE_ENCODING))

    def to_indexable_content(self, buffer: BufferedIOBase):
        return buffer  # Elasticsearch can index PDF files directly

    def should_highlight_content_text_matches(self) -> bool:
        return True


class BiocTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_BIOC
    SHORTHAND = 'BioC'
    mime_types = (MIME_TYPE,)
    ALLOWED_TYPES = ['.xml', '.bioc']

    def detect_mime_type(self, buffer: BufferedIOBase) -> List[typing.Tuple[float, str]]:
        try:
            # If it is xml file and bioc
            self.check_xml_and_bioc(buffer)
            return [(0, self.MIME_TYPE)]
        except BaseException:
            return []
        finally:
            buffer.seek(0)

    def handles(self, file: Files) -> bool:
        ext = os.path.splitext(file.filename)[1].lower()
        return super().handles(file) and ext in self.ALLOWED_TYPES

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        with BioCJsonIterReader(buffer) as reader:
            for obj in reader:
                passage = biocFromJSON(obj, level=bioc.DOCUMENT)

    def extract_doi(self, buffer: BufferedIOBase) -> Optional[str]:
        data = buffer.read()
        buffer.seek(0)

        chunk = data[:2 ** 17]
        doi = _search_doi_in(chunk)
        return doi

    def convert(self, buffer):
        # assume it is xml
        collection = bioc.load(buffer)
        buffer.stream = io.BytesIO()
        with BioCJsonIterWriter(buffer) as writer:
            for doc in collection.documents:
                writer.write(biocToJSON(doc))
        buffer.seek(0)

    def check_xml_and_bioc(self, buffer: BufferedIOBase):
        tree = etree.parse(buffer)
        system_url: str = tree.docinfo.system_url
        result = system_url.lower().find('bioc')
        if result < 0:
            raise ValueError()


def substitute_svg_images(map_content: io.BytesIO, images: list, zip_file: zipfile.ZipFile,
                          folder_name: str):
    """ Match every link inside SVG file and replace it with raw PNG data of icons or images from
    zip file. This has to be done after the graphviz call, as base64 PNG data is often longer than
    graphviz max length limit (~16k chars)
    params:
    :param map_content: bytes of the exported map
    :param images: list containing names of the images to embed
    :param zip_file: zip containing images
    :param folder_name: uuid of a temporary folder containing the images
    :returns: a modified svg file containing embedded images
    """
    icon_data = get_icons_data()
    text_content = map_content.read().decode(BYTE_ENCODING)
    text_content = IMAGES_RE.sub(lambda match: icon_data[match.group(0)], text_content)
    for image in images:
        text_content = text_content.replace(
            folder_name + '/' + image, 'data:image/png;base64,' + b64encode(
                zip_file.read("".join(['images/', image]))).decode(BYTE_ENCODING))
    return io.BytesIO(bytes(text_content, BYTE_ENCODING))


def get_icons_data():
    """
    Lazy loading of the byte icon data from the PNG files
    """
    if ICON_DATA:
        return ICON_DATA
    else:
        for key in ['map', 'link', 'email', 'sankey', 'document', 'enrichment_table', 'note',
                    'ms-word', 'ms-excel', 'ms-powerpoint', 'cytoscape', 'lifelike']:
            icon_path = os.path.join(ASSETS_PATH, f'{key}.png')
            with open(icon_path, 'rb') as file:
                ICON_DATA[icon_path] = 'data:image/png;base64,' \
                                       + b64encode(file.read()) \
                                           .decode(BYTE_ENCODING)
        return ICON_DATA


def create_default_node(node):
    """
    Creates a param dict with all the parameters required to create a simple text node or
    saving a baseline for more complex node - like map/note/link nodes
    :params:
    :param node: a dictionary containing the information about currently rendered node
    :return: baseline dict with Graphviz paramaters
    """
    style = node.get('style', {})
    # Ensure that display name is of type string, as it can be None
    display_name = node['display_name'] or ""
    return {
        'name': node['hash'],
        # Graphviz offer no text break utility - it has to be done outside of it
        'label': escape('\n'.join(textwrap.TextWrapper(
            width=min(10 + len(display_name) // 4, MAX_LINE_WIDTH),
            replace_whitespace=False).wrap(display_name))),
        # We have to inverse the y axis, as Graphviz coordinate system origin is at the bottom
        'pos': (
            f"{node['data']['x'] / SCALING_FACTOR},"
            f"{-node['data']['y'] / SCALING_FACTOR}!"
        ),
        # Resize the node base on font size, as otherwise the margin would be smaller than
        # in the Lifelike map editor
        'width': f"{node['data'].get('width', DEFAULT_NODE_WIDTH) / SCALING_FACTOR}",
        'height': f"{node['data'].get('height', DEFAULT_NODE_HEIGHT) / SCALING_FACTOR}",
        'shape': 'box',
        'style': 'rounded,' + BORDER_STYLES_DICT.get(style.get('lineType'), ''),
        'color': style.get('strokeColor') or DEFAULT_BORDER_COLOR,
        'fontcolor': style.get('fillColor') or ANNOTATION_STYLES_DICT.get(
            node['label'], {'color': 'black'}).get('color'),
        'fontname': 'sans-serif',
        'margin': "0.2,0.0",
        'fontsize': f"{style.get('fontSizeScale', 1.0) * DEFAULT_FONT_SIZE}",
        # Setting penwidth to 0 removes the border
        'penwidth': f"{style.get('lineWidthScale', 1.0)}"
        if style.get('lineType') != 'none' else '0.0'
    }


def create_image_label(node):
    """
    Creates a node acting as a label for the image
    :params:
    :param node: dict containing the node data
    :returns: label params
    """
    style = node.get('style', {})
    height = node['data'].get('height', DEFAULT_IMAGE_NODE_HEIGHT)
    width = node['data'].get('width', DEFAULT_IMAGE_NODE_WIDTH)
    border_width = style.get('lineWidthScale', 1.0) if style.get('lineType') != 'none' else 0.0
    # Try to match the front-end max width by assuming that average font width is equal to 50%%
    # of the height - and adjusting the text to be roughly of the image width
    label_font_size = style.get('fontSizeScale', 1.0) * DEFAULT_FONT_SIZE
    label = escape('\n'.join(textwrap.TextWrapper(
        width=int(width / (label_font_size * 0.5)),
        replace_whitespace=False).wrap(node['display_name'] or "")))
    label_offset = -height / 2.0 - LABEL_OFFSET - (label_font_size / 2.0 *
                                                   (1 + label.count('\n'))) - border_width
    return {
        'label': label,
        'pos': (
            f"{node['data']['x'] / SCALING_FACTOR},"
            f"{(-node['data']['y'] + label_offset) / SCALING_FACTOR + FILENAME_LABEL_MARGIN}!"
        ),
        'fontsize': f"{label_font_size}",
        'penwidth': '0.0',
        'fontcolor': style.get('fillColor') or 'black',
        'fontname': 'sans-serif',
        'name': node['hash'] + '_label'
    }


def create_image_node(node, params):
    """
    Add parameters specific to the image label.
    :params:
    :param node: dict containing the node data
    :param params: dict containing baseline parameters
    :returns: modified params
    """
    style = node.get('style', {})
    # Remove the label generated in 'create_default_node' - we will add it as separate node
    params['label'] = ""
    height = node['data'].get('height', DEFAULT_IMAGE_NODE_HEIGHT)
    width = node['data'].get('width', DEFAULT_IMAGE_NODE_WIDTH)
    params['penwidth'] = f"{style.get('lineWidthScale', 1.0) * IMAGE_BORDER_SCALE}" \
        if style.get('lineType') != 'none' else '0.0'
    params['width'] = f"{width / SCALING_FACTOR}"
    params['height'] = f"{height / SCALING_FACTOR}"
    params['fixedsize'] = 'true'
    params['imagescale'] = 'both'
    params['shape'] = 'rect'
    params['style'] = 'bold,' + BORDER_STYLES_DICT.get(style.get('lineType'), '')
    params['color'] = style.get('strokeColor') or 'white'
    return params


def create_detail_node(node, params):
    """
    Add parameters specific to the nodes which has a 'show detail text instead of a label'
    property. Due to the copyright, we limit the text in detail nodes dragged from the pdfs to 250
    characters - see https://sbrgsoftware.atlassian.net/browse/LL-3387 for details on problems.
    Due to the fact, that new lines can be present in the detail text (and need to be replaced with
    slash + l (which cant be written here due to the pep8 check) to align the text to the left, we
    need to be careful while escaping the text
    :params:
    :param node: dict containing the node data
    :param params: dict containing baseline parameters that have to be altered
    :returns: modified params dict
    TODO: Mimic the text metric and text breaking from the drawing-tool
    """
    params['style'] += ',filled'
    detail_text = node['data'].get('detail', '')
    if detail_text:
        if node['data'].get('sources'):
            # Check if the node was dragged from the pdf - if so, it will have a source link
            if any(DOCUMENT_RE.match(src.get('url')) for src in node['data'].get('sources')):
                detail_text = detail_text[:DETAIL_TEXT_LIMIT]
                detail_text = detail_text.rstrip('\\')
        # Split lines to inspect their length and replace them with '\l' later
        # Use regex to split, otherwise \n (text, not new lines) are matched as well
        lines = re.split("\n", detail_text)
        # Escape the characters and break lines longer than max line width
        lines = map(lambda x: r' \l '.join(textwrap.TextWrapper(width=MAX_LINE_WIDTH
                                                                ).wrap(escape(x))), lines)
        # '\l' is graphviz special new line, which placed at the end of the line will align it
        # to the left - we use that instead of \n (and add one at the end to align last line)
        detail_text = r"\l".join(lines) + r'\l'

    params['label'] = detail_text
    params['fillcolor'] = ANNOTATION_STYLES_DICT.get(node['label'],
                                                     {'bgcolor': 'black'}
                                                     ).get('bgcolor')
    if not node.get('style', {}).get('strokeColor'):
        # No border by default
        params['penwidth'] = '0.0'
    return params


def get_link_icon_type(node):
    """
    Evaluate the icon that link node should have (document, sankey, ET, mail or link)
    If the link is valid, save it and use it later when setting the node href
    Otherwise return None.
    :params:
    :param node: dict containing the node data
    :returns: the correct label for the icon and a corresponding URL - if valid
    """
    data = node['data'].get('sources', []) + node['data'].get('hyperlinks', [])
    for link in data:
        # TODO: This is getting bigger and bigger - refactor this for some clarity
        if ENRICHMENT_TABLE_RE.match(link['url']):
            return 'enrichment_table', link['url']
        elif SANKEY_RE.match(link['url']):
            return 'sankey', link['url']
        elif DOCUMENT_RE.match(link['url']):
            doi_src = next(
                (src for src in node['data'].get('sources') if src.get(
                    'domain') == "DOI"), None)
            # If there is a valid doi, link to DOI
            if doi_src and is_valid_doi(doi_src['url']):
                return 'document', doi_src['url']
            # If the links point to internal document, remove it from the node data so it would
            # not became exported as node url - as that might violate copyrights
            if link in node['data'].get('sources', []):
                node['data']['sources'].remove(link)
            else:
                node['data']['hyperlinks'].remove(link)
            return 'document', None
        elif PROJECTS_RE.match(link['url']):
            return 'project', link['url']
        elif BIOC_RE.match(link['url']):
            return 'bioc', link['url']
        elif MAIL_RE.match(link['url']):
            return 'email', link['url']
        elif ANY_FILE_RE.match(link['url']):
            domain = link.get('domain', "").strip()
            if domain:
                # Do not return url, as we are not creating links to files that we not create on LL
                if domain.endswith('.docx') or domain.endswith('.doc'):
                    return 'ms-word', None
                elif domain.endswith('.pptx') or domain.endswith('.ppt'):
                    return 'ms-powerpoint', None
                elif domain.endswith('.xlsx') or domain.endswith('.xls'):
                    return 'ms-excel', None
                elif domain.endswith('.cys'):
                    return 'cytoscape', None
    return 'link', None


def create_icon_node(node, params):
    """
    Alters the params dict with the values suitable for creation of the nodes with icons and
    creates additional parameters dict storing the information about the icon node
    :params:
    :param node: dict containing the node data
    :param params: dict containing baseline parameters that have to be altered
    :returns: modified params dict descriping icon label and a new dict describing the icon
              itself. Additionally, returns computed height of icon + label to set it
              to a proper value
    """
    style = node.get('style', {})
    label = escape(node['label'])
    # remove border around icon label
    params['penwidth'] = '0.0'
    # Calculate the distance between icon and the label center
    distance_from_the_label = BASE_ICON_DISTANCE + params['label'].count('\n') \
        * IMAGE_HEIGHT_INCREMENT + FONT_SIZE_MULTIPLIER * (style.get('fontSizeScale', 1.0) - 1.0)

    node_height = distance_from_the_label * 2 + float(ICON_SIZE)
    node_height *= SCALING_FACTOR
    # Move the label below to make space for the icon node
    params['pos'] = (
        f"{node['data']['x'] / SCALING_FACTOR},"
        f"{-node['data']['y'] / SCALING_FACTOR - distance_from_the_label}!"
    )

    # Create a separate node which will hold the image
    icon_params = {
        'name': "icon_" + node['hash'],
        'pos': (
            f"{node['data']['x'] / SCALING_FACTOR},"
            f"{-node['data']['y'] / SCALING_FACTOR}!"
        ),
        'label': ""
    }
    default_icon_color = ANNOTATION_STYLES_DICT.get(node['label'],
                                                    {'defaultimagecolor': 'black'}
                                                    )['defaultimagecolor']
    custom_icons = ANNOTATION_STYLES_DICT.get('custom_icons', {})
    if label == 'link':
        label, link = get_link_icon_type(node)
        # Save the link for later usage
        node['link'] = link
        custom_icons = ANNOTATION_STYLES_DICT.get('custom_icons', {})
        # If label is microsoft icon, we set default text color to its color for consistent look
        if label in custom_icons.keys():
            default_icon_color = custom_icons.get(label, default_icon_color)

    icon_params['image'] = (
        os.path.join(ASSETS_PATH, f'{label}.png')
    )
    if label not in custom_icons.keys():
        # We are setting the icon color by using 'inverse' icon images and colorful background
        # But not for microsoft icons, as those are always in the same color
        icon_params['fillcolor'] = style.get("fillColor") or default_icon_color
        icon_params['style'] = 'filled'
    icon_params['shape'] = 'box'
    icon_params['height'] = ICON_SIZE
    icon_params['width'] = ICON_SIZE
    icon_params['fixedsize'] = 'true'
    icon_params['imagescale'] = 'true'
    icon_params['penwidth'] = '0.0'
    params['fontcolor'] = style.get("fillColor") or default_icon_color
    return params, icon_params, node_height


def create_relation_node(node, params):
    """
    Adjusts the node into the relation node (purple ones)
    :params:
    :param node: dict containing the node data
    :param params: dict containing Graphviz parameters that will be altered
    :returns: altered params dict
    """
    style = node.get('style', {})
    default_color = ANNOTATION_STYLES_DICT.get(
        node['label'],
        {'color': 'black'})['color']
    params['color'] = style.get('strokeColor') or default_color
    if style.get('fillColor'):
        params['color'] = style.get('strokeColor') or DEFAULT_BORDER_COLOR
    # Changing font color changes background to white
    params['fillcolor'] = 'white' if style.get('fillColor') else default_color
    params['fontcolor'] = style.get('fillColor') or 'black'
    params['style'] += ',filled'
    return params


def set_node_href(node):
    """
    Evaluates and sets the href for the node. If link parameter was not set previously, we are
    dealing with entity node (or icon node without any sources) - so we prioritize the
    hyperlinks here
    :params:
    :param node: dict containing the node data
    :returns: string with URL to which node should point - or empty string
    """
    href = ''
    if node.get('link'):
        href = node['link']
    elif node['data'].get('hyperlinks'):
        href = node['data']['hyperlinks'][0].get('url')
    elif node['data'].get('sources'):
        href = node['data']['sources'][0].get('url')

    # Whitespaces will break the link if we prepend the domain
    current_link = href.strip()
    # If url points to internal file, prepend it with the domain address
    if current_link.startswith('/'):
        # Remove Lifelike links to files that we do not create - due to the possible copyrights
        if ANY_FILE_RE.match(current_link):
            # Remove the link from the dictionary
            if node.get('link'):
                del node['link']
            elif node['data'].get('hyperlinks'):
                del node['data']['hyperlinks'][0]
            else:
                del node['data']['sources'][0]
            # And search again
            href = set_node_href(node)
        else:
            href = urljoin(FRONTEND_URL, current_link)
    return href


def create_map_name_node():
    """
    Creates the baseline dict for map name node
    :retuns: dict describing the name node with Graphviz parameters
    """
    return {
        'fontcolor': ANNOTATION_STYLES_DICT.get('map', {'defaultimagecolor': 'black'}
                                                )['defaultimagecolor'],
        'fontsize': str(FILENAME_LABEL_FONT_SIZE),
        'shape': 'box',
        'style': 'rounded',
        'margin': f'{FILENAME_LABEL_MARGIN * 2},{FILENAME_LABEL_MARGIN}'
    }


def create_edge(edge, node_hash_type_dict):
    """
    Creates a dict with parameters required to render an edge
    :params:
    :param edge: dict containing the edge information
    :param node_hash_type_dict: lookup dict allowing to quickly check whether either head or
    tail is pointing to link or note (as this changes the default edge style)
    :returns: dict describing the edge with Graphviz parameters
    """
    style = edge.get('style', {})
    default_line_style = 'solid'
    default_arrow_head = 'arrow'
    edge_data = edge.get('data', {})
    url_data = edge_data.get('hyperlinks', []) + edge_data.get('sources', [])
    url = url_data[-1]['url'] if len(url_data) else ''
    if any(item in [node_hash_type_dict[edge['from']], node_hash_type_dict[edge['to']]] for
           item in ['link', 'note']):
        default_line_style = 'dashed'
        default_arrow_head = 'none'
    return {
        'tail_name': edge['from'],
        'head_name': edge['to'],
        # Pristine edges have 'label: null' - so we have to check them as escaping None type gives
        # error. Do not use .get() with default, as the key exist - it's the content that is missing
        'label': escape(edge['label']) if edge['label'] else "",
        'dir': 'both',
        'color': style.get('strokeColor') or DEFAULT_BORDER_COLOR,
        'arrowtail': ARROW_STYLE_DICT.get(style.get('sourceHeadType') or 'none'),
        'arrowhead': ARROW_STYLE_DICT.get(
            style.get('targetHeadType') or default_arrow_head),
        'penwidth': str(style.get('lineWidthScale', 1.0)) if style.get(
            'lineType') != 'none'
        else '0.0',
        'fontsize': str(style.get('fontSizeScale', 1.0) * DEFAULT_FONT_SIZE),
        'style': BORDER_STYLES_DICT.get(style.get('lineType') or default_line_style),
        'URL': url
    }


def create_watermark(x_center, y):
    """
    Create a Lifelike watermark (icon, text, hyperlink) below the pdf.
    We need to ensure that the lowest node is not intersecting it - if so, we push it even lower.
    :params:
    :param x_center: middle of the pdf
    :param y: position of the lowest node bottom on the pdf
    :param lowest_node: details of the lowest node (used to get BBox)
    returns:
    3 dictionaries - each for one of the watermark elements
    """
    y += WATERMARK_DISTANCE
    label_params = {
        'name': 'watermark_node',
        'label': 'Created by Lifelike',
        'pos': (
            f"{x_center / SCALING_FACTOR},"
            f"{-y / SCALING_FACTOR}!"
        ),
        'width': f"{WATERMARK_WIDTH / SCALING_FACTOR}",
        'height': f"{DEFAULT_NODE_HEIGHT / SCALING_FACTOR}",
        'fontcolor': 'black',
        'fontname': 'sans-serif',
        'margin': "0.2,0.0",
        'fontsize': f"{DEFAULT_FONT_SIZE}",
        'penwidth': '0.0',

    }
    url_params = {
        'name': 'watermark_hyper',
        'label': 'lifelike.bio',
        'href': 'https://lifelike.bio',
        'pos': (
            f"{x_center / SCALING_FACTOR},"
            f"{-(y + DEFAULT_NODE_HEIGHT / 2.0) / SCALING_FACTOR}!"
        ),
        'width': f"{WATERMARK_WIDTH / SCALING_FACTOR}",
        'height': f"{DEFAULT_NODE_HEIGHT / SCALING_FACTOR}",
        'fontcolor': 'blue',
        'fontname': 'sans-serif',
        'margin': "0.2,0.0",
        'fontsize': f"{DEFAULT_FONT_SIZE - 2}",
        'penwidth': '0.0'
    }
    icon_params = {
        'name': 'watermark_icon',
        'label': '',
        'pos': (
            f"{(x_center - WATERMARK_WIDTH / 2.0 + WATERMARK_ICON_SIZE) / SCALING_FACTOR},"
            f"{-y / SCALING_FACTOR}!"
        ),
        'penhwidth': '0.0',
        'fixedsize': 'true',
        'imagescale': 'both',
        'shape': 'rect',
        'image': ASSETS_PATH + 'lifelike.png',
        'width': f"{WATERMARK_ICON_SIZE / SCALING_FACTOR}",
        'height': f"{WATERMARK_ICON_SIZE / SCALING_FACTOR}",
        'penwidth': '0.0'
    }
    return label_params, url_params, icon_params


class MapTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_MAP
    SHORTHAND = 'map'
    mime_types = (MIME_TYPE,)

    def detect_mime_type(self, buffer: BufferedIOBase) -> List[typing.Tuple[float, str]]:
        try:
            # If the data validates, I guess it's a map?
            self.validate_content(buffer)
            return [(0, self.MIME_TYPE)]
        except ValueError:
            return []
        finally:
            buffer.seek(0)

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        """
        Validates whether the uploaded file is a Lifelike map - a zip containing graph.json file
        describing the map and optionally, folder with the images. If there are any images specified
        in the json graph, their presence and accordance to the png standard is verified.
        :params:
        :param buffer: buffer containing the bytes of the file that has to be tested
        :raises ValueError: if the file is not a proper map file
        """
        zipped_map = buffer.read()
        try:
            with zipfile.ZipFile(io.BytesIO(zipped_map)) as zip_file:
                # Test zip returns the name of the first invalid file inside the archive; if any
                if zip_file.testzip():
                    raise ValueError
                json_graph = json.loads(zip_file.read('graph.json'))
                validate_map(json_graph)
                for node in json_graph['nodes']:
                    if node.get('image_id'):
                        zip_file.read("".join(['images/', node.get('image_id'), '.png']))
        except (zipfile.BadZipFile, KeyError):
            raise ValueError

    def to_indexable_content(self, buffer: BufferedIOBase):
        # Do not catch exceptions here - there are handled in elastic_service.py
        zip_file = zipfile.ZipFile(io.BytesIO(buffer.read()))
        content_json = json.loads(zip_file.read('graph.json'))

        content = io.StringIO()
        string_list = []

        for node in content_json.get('nodes', []):
            node_data = node.get('data', {})
            display_name = node.get('display_name', '')
            detail = node_data.get('detail', '') if node_data else ''
            string_list.append('' if display_name is None else display_name)
            string_list.append('' if detail is None else detail)

        for edge in content_json.get('edges', []):
            edge_data = edge.get('data', {})
            label = edge.get('label', '')
            detail = edge_data.get('detail', '') if edge_data else ''
            string_list.append('' if label is None else label)
            string_list.append('' if detail is None else detail)

        content.write(' '.join(string_list))
        return typing.cast(BufferedIOBase, io.BytesIO(content.getvalue().encode(BYTE_ENCODING)))

    def generate_export(self, file: Files, format: str, self_contained_export=False) -> FileExport:
        """
        Generates the map as a file in provided format. While working with this, remember that:
         - Most of the node parameters is optional (including width and height).
         - Graphviz y-axis is inverted (starts at the top)
         - SVG requires separate image embedding mechanism (get_icons_data)
        """
        if format not in ('png', 'svg', 'pdf'):
            raise ExportFormatError()

        # This should handle the naming and removal of the temporary directory
        folder = tempfile.TemporaryDirectory()

        try:
            zip_file = zipfile.ZipFile(io.BytesIO(file.content.raw_file))
            json_graph = json.loads(zip_file.read('graph.json'))
        except KeyError:
            current_app.logger.info(
                f'Invalid map file: {file.hash_id} Cannot find map graph inside the zip!',
                extra=EventLog(
                    event_type=LogEventType.MAP_EXPORT_FAILURE.value).to_dict()
            )
            raise ValidationError('Cannot retrieve contents of the file - it might be corrupted')
        except zipfile.BadZipFile:
            current_app.logger.info(
                f'Invalid map file: {file.hash_id} File is a bad zipfile.',
                extra=EventLog(
                    event_type=LogEventType.MAP_EXPORT_FAILURE.value).to_dict()
            )
            raise ValidationError('Cannot retrieve contents of the file - it might be corrupted')

        graph_attr = [('margin', f'{PDF_MARGIN}'), ('outputorder', 'nodesfirst'),
                      ('pad', f'{PDF_PAD}')]

        if format == 'png':
            graph_attr.append(('dpi', '100'))

        graph = graphviz.Digraph(
            escape(file.filename),
            # New lines are not permitted in the comment - they will crash the export.
            # Replace them with spaces until we find different solution
            comment=file.description.replace('\n', ' ') if file.description else None,
            engine='neato',
            graph_attr=graph_attr,
            format=format)

        node_hash_type_dict = {}
        x_values, y_values = [], []
        images = []

        nodes = json_graph['nodes']
        # Sort the images to the front of the list to ensure that they do not cover other nodes
        nodes.sort(key=lambda n: n.get('label', "") == 'image', reverse=True)

        for i, node in enumerate(nodes):
            # Store the coordinates of each node as map name node and watermark are based on them
            x_values.append(node['data']['x'])
            y_values.append(node['data']['y'])
            # Store node hash->label for faster edge default type evaluation
            node_hash_type_dict[node['hash']] = node['label']
            style = node.get('style', {})
            params = create_default_node(node)

            if node['label'] == 'image':
                try:
                    image_name = node.get('image_id') + '.png'
                    images.append(image_name)
                    im = zip_file.read("".join(['images/', image_name]))
                    file_path = os.path.sep.join([folder.name, image_name])
                    f = open(file_path, "wb")
                    f.write(im)
                    f.close()
                # Note: Add placeholder images instead?
                except KeyError:
                    name = node.get('image_id') + '.png'
                    current_app.logger.info(
                        f'Invalid map file: {file.hash_id} Cannot retrieve image {name}.',
                        extra=EventLog(
                            event_type=LogEventType.MAP_EXPORT_FAILURE.value).to_dict()
                    )
                    raise ValidationError(
                        f"Cannot retrieve image: {name} - file might be corrupted")
                params = create_image_node(node, params)
                if node['display_name']:
                    graph.node(**create_image_label(node))
                params['image'] = file_path

            if node['label'] in ICON_NODES:
                # map and note should point to the first source or hyperlink, if the are no sources
                link_data = node['data'].get('sources', []) + node['data'].get('hyperlinks', [])
                node['link'] = link_data[0].get('url') if link_data else None
                if style.get('showDetail'):
                    params = create_detail_node(node, params)
                else:
                    params, icon_params, node_height = create_icon_node(node, params)
                    # We need to set this to ensure that watermark is not intersect some edge cases
                    nodes[i]['data']['height'] = node_height
                    # Create separate node with the icon
                    graph.node(**icon_params)

            if node['label'] in RELATION_NODES:
                params = create_relation_node(node, params)

            params['href'] = set_node_href(node)
            graph.node(**params)

        min_x = min(x_values, default=0)
        min_y = min(y_values, default=0)
        if self_contained_export:
            # We add name of the map in left top corner to ease map recognition in linked export
            name_node_params = create_map_name_node()
            # Set outside of the function to avoid unnecessary copying of potentially big variables
            name_node_params['name'] = file.filename
            name_node_params['pos'] = (
                f"{(min_x - NAME_NODE_OFFSET) / SCALING_FACTOR},"
                f"{(-min_y - NAME_NODE_OFFSET) / SCALING_FACTOR}!"
            )

            graph.node(**name_node_params)

        lower_ys = list(map(lambda x: x['data']['y'] + x['data'].get(
            'height', DEFAULT_NODE_HEIGHT) / 2.0, nodes))
        max_x = max(x_values, default=0)
        x_center = min_x + (max_x - min_x) / 2.0
        for params in create_watermark(x_center, max(lower_ys, default=0)):
            graph.node(**params)

        for edge in json_graph['edges']:
            edge_params = create_edge(edge, node_hash_type_dict)
            graph.edge(**edge_params)

        ext = f".{format}"
        content = io.BytesIO(graph.pipe())

        if format == 'svg':
            content = substitute_svg_images(content, images, zip_file, folder.name)

        return FileExport(
            content=content,
            mime_type=extension_mime_types[ext],
            filename=f"{file.filename}{ext}"
        )

    def merge(self, files: list, requested_format: str, links=None):
        """ Export, merge and prepare as FileExport the list of files
        :param files: List of Files objects. The first entry is always the main map,
        :param requested_format: export format
        :param links: List of dict objects storing info about links that should be embedded:
            x: x pos; y: y pos;
            page_origin: which page contains icon;
            page_destination: where should it take you
        :return: an exportable file.
        :raises: ValidationError if provided format is invalid
        """
        if requested_format == 'png':
            merger = self.merge_pngs_vertically
        elif requested_format == 'pdf':
            merger = self.merge_pdfs
        elif requested_format == 'svg':
            merger = self.merge_svgs
        else:
            raise ValidationError("Unknown or invalid export format for the requested file.",
                                  requested_format)
        ext = f'.{requested_format}'
        if len(files) > 1:
            content = merger(files, links)
        else:
            content = self.get_file_export(files[0], requested_format)
        return FileExport(
            content=content,
            mime_type=extension_mime_types[ext],
            filename=f"{files[0].filename}{ext}"
        )

    def get_file_export(self, file, format):
        """ Get the exported version of the file in requested format
            wrapper around abstract method to add map specific params and catch exception
         params
         :param file: map file to export
         :param format: wanted format
         :raises ValidationError: When provided format is invalid
         :return: Exported map as BytesIO
         """
        try:
            return io.BytesIO(self.generate_export(file, format, self_contained_export=True)
                              .content.getvalue())
        except ExportFormatError:
            raise ValidationError("Unknown or invalid export "
                                  "format for the requested file.", format)

    def merge_pngs_vertically(self, files, _=None):
        """ Append pngs vertically.
        params:
        :param files: list of files to export
        :param _: links: omitted in case of png, added to match the merge_pdfs signature
        :returns: maps concatenated vertically
        :raises SystemError: when one of the images exceeds PILLOW decompression bomb size limits
        """
        final_bytes = io.BytesIO()
        try:
            images = [Image.open(self.get_file_export(file, 'png')) for file in files]
        except Image.DecompressionBombError as e:
            raise SystemError('One of the files exceeds the maximum size - it cannot be exported'
                              'as part of the linked export')
        cropped_images = [image.crop(image.getbbox()) for image in images]
        widths, heights = zip(*(i.size for i in cropped_images))

        max_width = max(widths)
        total_height = sum(heights)

        new_im = Image.new('RGBA', (max_width, total_height), TRANSPARENT_PIXEL)
        y_offset = 0

        for im in cropped_images:
            x_offset = int((max_width - im.size[0]) / 2)
            new_im.paste(im, (x_offset, y_offset))
            y_offset += im.size[1]
        new_im.save(final_bytes, format='PNG')
        return final_bytes

    def merge_pdfs(self, files: list, links=None):
        """ Merge pdfs and add links to map.
        params:
        :param files: list of files to export.
        :param links: list of dicts describing internal map links
        """
        links = links or []
        final_bytes = io.BytesIO()
        writer = PdfFileWriter()
        half_size = int(ICON_SIZE) * DEFAULT_DPI / 2.0
        for i, out_file in enumerate(files):
            out_file = self.get_file_export(out_file, 'pdf')
            reader = PdfFileReader(out_file, strict=False)
            writer.appendPagesFromReader(reader)
        for link in links:
            file_index = link['page_origin']
            coord_offset, pixel_offset = get_content_offsets(files[file_index])
            x_base = ((link['x'] - coord_offset[0]) / SCALING_FACTOR * POINT_TO_PIXEL) + \
                PDF_MARGIN * DEFAULT_DPI + pixel_offset[0]
            y_base = ((-1 * link['y'] - coord_offset[1]) / SCALING_FACTOR * POINT_TO_PIXEL) + \
                PDF_MARGIN * DEFAULT_DPI - pixel_offset[1]
            writer.addLink(file_index, link['page_destination'],
                           [x_base - half_size, y_base - half_size - LABEL_OFFSET,
                            x_base + half_size, y_base + half_size])
        writer.write(final_bytes)
        return final_bytes

    def merge_svgs(self, files: list, _=None):
        """ Merge svg files together with svg_stack
        params:
        :param files: list of files to be merged
        :param _: links: omitted in case of svg, added to match the merge_pdfs signature
        """
        doc = svg_stack.Document()
        layout2 = svg_stack.VBoxLayout()
        # String is used, since svg_stack cannot save to IOBytes - raises an error
        result_string = io.StringIO()
        for file in files:
            layout2.addSVG(self.get_file_export(file, 'svg'), alignment=svg_stack.AlignCenter)
        doc.setLayout(layout2)
        doc.save(result_string)
        return io.BytesIO(result_string.getvalue().encode(BYTE_ENCODING))


class GraphTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_GRAPH
    SHORTHAND = 'Graph'
    mime_types = (MIME_TYPE,)

    def detect_mime_type(self, buffer: BufferedIOBase) -> List[typing.Tuple[float, str]]:
        try:
            # If the data validates, I guess it's a map?
            if os.path.splitext(str(
                    # buffer in here is actually wrapper of BufferedIOBase and it contains
                    # filename even if type check fails
                    buffer.filename  # type: ignore[attr-defined]
            ))[1] == '.graph':
                return [(0, self.MIME_TYPE)]
            else:
                return []
        except (ValueError, AttributeError):
            return []
        finally:
            buffer.seek(0)

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        data = json.loads(buffer.read())
        validate_graph(data)

    def to_indexable_content(self, buffer: BufferedIOBase):
        content_json = json.load(buffer)
        content = io.StringIO()
        string_list = set(extract_text(content_json))

        content.write(' '.join(list(string_list)))
        return typing.cast(BufferedIOBase, io.BytesIO(content.getvalue().encode(BYTE_ENCODING)))

    def extract_metadata_from_content(self, file: Files, buffer: BufferedIOBase):
        if not file.description:
            data = json.loads(buffer.read())
            description = data['graph']['description']
            file.description = description


class EnrichmentTableTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_ENRICHMENT_TABLE
    SHORTHAND = 'enrichment-table'
    mime_types = (MIME_TYPE,)

    def detect_mime_type(self, buffer: BufferedIOBase) -> List[typing.Tuple[float, str]]:
        try:
            # If the data validates, I guess it's an enrichment table?
            # The enrichment table schema is very simple though so this is very simplistic
            # and will cause problems in the future
            self.validate_content(buffer)
            return [(0, self.MIME_TYPE)]
        except ValueError:
            return []
        finally:
            buffer.seek(0)

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        data = json.loads(buffer.read())
        validate_enrichment_table(data)

    def to_indexable_content(self, buffer: BufferedIOBase):
        data = json.load(buffer)
        content = io.StringIO()

        genes = data['data']['genes'].split(',')
        organism = data['data']['organism']
        content.write(', '.join(genes))
        content.write('\r\n\r\n')
        content.write(organism)
        content.write('\r\n\r\n')

        if 'result' in data:
            genes = data['result']['genes']
            for gene in genes:
                content.write('\u2022 ')
                content.write(gene['imported'])
                if 'matched' in gene:
                    content.write(': ')
                    content.write(gene['matched'])
                if 'fullName' in gene:
                    content.write(' (')
                    content.write(gene['fullName'])
                    content.write(')')
                if 'domains' in gene:
                    for gene_domain in gene['domains'].values():
                        for value in gene_domain.values():
                            if len(value['text']):
                                content.write('\n\u2192 ')
                                content.write(value['text'])
                content.write('.\r\n\r\n')

        return typing.cast(BufferedIOBase, io.BytesIO(content.getvalue().encode(BYTE_ENCODING)))

    def should_highlight_content_text_matches(self) -> bool:
        return True

    def handle_content_update(self, file: Files):
        file.enrichment_annotations = None


def get_content_offsets(file):
    """ Gets offset box of the map, allowing to translate the coordinates to the pixels of the
        pdf generated by graphviz.
        *params*
        file: A Files object of map that is supposed to be analyzed
        Return: two pairs of coordinates: x & y.
        First denotes the offset to the pdf origin (in the units used by front-end renderer)
        Second denotes the offset created by the map name node (from which the margin is
        calculated) in pixels.
    """
    x_values, y_values = [], []
    zip_file = zipfile.ZipFile(io.BytesIO(file.content.raw_file))
    try:
        json_graph = json.loads(zip_file.read('graph.json'))
    except KeyError:
        raise ValidationError
    for node in json_graph['nodes']:
        x_values.append(node['data']['x'])
        y_values.append(-node['data']['y'])
        if node['label'] in ICON_NODES:
            # If the node is icon node, we have to consider that the label is lower that pos
            # indicates due to the addition of the icon node
            y_values[-1] -= BASE_ICON_DISTANCE + math.ceil(len(node['display_name']) / min(15 + len(
                node['display_name']) // 3, MAX_LINE_WIDTH)) \
                            * IMAGE_HEIGHT_INCREMENT + FONT_SIZE_MULTIPLIER * \
                            (node.get('style', {}).get('fontSizeScale', 1.0) - 1.0)
    x_offset = max(len(file.filename), 0) * NAME_LABEL_FONT_AVERAGE_WIDTH / 2.0 - \
        MAP_ICON_OFFSET + HORIZONTAL_TEXT_PADDING * NAME_LABEL_PADDING_MULTIPLIER
    y_offset = VERTICAL_NODE_PADDING
    return (min(x_values), min(y_values)), (x_offset, y_offset)
