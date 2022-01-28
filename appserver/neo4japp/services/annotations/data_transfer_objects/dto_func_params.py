import attr

from typing import List

from .dto import PDFWord


"""Data Transfer Objects related to consolidating multiple
function parameters into one object.
"""


@attr.s(frozen=True)
class CreateAnnotationObjParams():
    entity_synonym: str = attr.ib()
    entity_name: str = attr.ib()
    entity_category: str = attr.ib()
    entity_id: str = attr.ib()
    entity_datasource: str = attr.ib()
    entity_hyperlinks: List[str] = attr.ib()
    token: PDFWord = attr.ib()
    token_type: str = attr.ib()
