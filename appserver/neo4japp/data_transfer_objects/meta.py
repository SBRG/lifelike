import attr
from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class BuildInformation(CamelDictMixin):
    """ Contains the timestamp and build information """
    build_timestamp: str = attr.ib()
    git_hash: str = attr.ib()
    app_build_number: int = attr.ib()
    app_version: str = attr.ib()
