import math
from typing import Sequence

import attr

from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class PaginatedRequest(CamelDictMixin):
    page: int = attr.ib()
    limit: int = attr.ib()

    def get_page(self):
        return max(1, self.page)

    def get_limit(self, minimum=1, maximum=100):
        return max(min(self.limit, maximum), minimum)


@attr.s(frozen=True)
class ResultQuery(CamelDictMixin):
    phrases: Sequence[str] = attr.ib()


@attr.s(frozen=True)
class ResultList(CamelDictMixin):
    total: int = attr.ib()
    results: Sequence = attr.ib()
    query = attr.ib()
