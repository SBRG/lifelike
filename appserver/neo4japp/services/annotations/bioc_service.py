import json
import string

from typing import List

from bioc import (
    biocjson,
    BioCCollection,
    BioCDocument,
    BioCPassage,
)

from neo4japp.services.annotations.data_transfer_objects import Annotation


class BiocDocumentService:
    def __init__(self) -> None:
        pass

    def printable(self, sentence, escape_character=None):
        out = ''
        for character in sentence:
            if character in string.printable:
                out += character
            elif escape_character is not None:
                out += escape_character(character)
        return out

    def text2document(
        self,
        file_uri: str,
        text: str,
    ):
        document = BioCDocument()
        document.id = file_uri
        # this was stripping out characters like apostrophe, etc
        # which created a discrepancies in the index offset
        # of the final text
        # text = self.printable(text).replace('\r\n', '\n')
        passage = BioCPassage()
        passage.offset = 0
        passage.text = text
        document.add_passage(passage)
        return document

    def text2collection(
        self,
        text: str,
        file_uri: str,
    ):
        collection = BioCCollection()
        document = self.text2document(file_uri=file_uri, text=text)
        collection.add_document(document)
        return collection

    def read(
        self,
        text: str,
        file_uri: str,
    ) -> BioCCollection:
        bioc_collection = self.text2collection(text=text, file_uri=file_uri)
        return bioc_collection

    def generate_bioc_json(
        self,
        annotations: List[Annotation],
        bioc: BioCCollection,
    ) -> dict:
        bioc_dump = biocjson.dumps(bioc, indent=2)
        bioc = json.loads(bioc_dump)
        bioc['documents'][0]['passages'][0]['annotations'] = [
            anno.to_dict() for anno in annotations]
        return bioc
