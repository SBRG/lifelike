import attr

from typing import Dict, List, Tuple


@attr.s(frozen=True)
class EnrichmentCellTextMapping():
    text: str = attr.ib()
    text_index_map: List[Tuple[int, dict]] = attr.ib()
    cell_texts: List[dict] = attr.ib()
