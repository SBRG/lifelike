from .lmdb_connection import LMDBConnection


class LMDBService(LMDBConnection):
    def __init__(self, dirpath: str, **kwargs) -> None:
        super().__init__(dirpath, **kwargs)
