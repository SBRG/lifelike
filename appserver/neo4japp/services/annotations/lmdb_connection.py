import os
import lmdb

from typing import Any, Dict
from flask import current_app
from lmdb import Environment

from ..common import DatabaseConnection, TransactionContext

from neo4japp.constants import LogEventType
from neo4japp.utils.logger import EventLog
from neo4japp.exceptions import LMDBError


class LMDBConnection(DatabaseConnection):
    def __init__(self, dirpath: str, **kwargs):
        self.dirpath = dirpath
        self.dbs: Dict[str, Any] = {}
        self.configs = kwargs

    class _context(TransactionContext):
        def __init__(self, env, db):
            self.db = db
            self.env: Environment = env

        def __enter__(self):
            self.session = self.env.begin(self.db)
            return self.session

        def __exit__(self, exc_type, exc_val, exc_traceback):
            self.env.close()

    def begin(self, **kwargs):
        dbname = kwargs.get('dbname', '')
        create = kwargs.get('create', True)
        readonly = kwargs.get('readonly', False)

        if not dbname:
            current_app.logger.error(
                f'LMDB database name is invalid, cannot connect to {dbname}.',
                extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            )
            raise LMDBError(
                title='Cannot Connect to LMDB',
                message='Unable to connect to LMDB, database name is invalid.')

        dbpath = os.path.join(self.dirpath, self.configs[dbname])
        try:
            env: Environment = lmdb.open(path=dbpath, create=create, readonly=readonly, max_dbs=2)
        except Exception:
            current_app.logger.error(
                f'Failed to open LMDB environment in path {dbpath}.',
                extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            )
            raise LMDBError(
                title='Cannot Connect to LMDB',
                message=f'Encountered unexpected error connecting to LMDB.')

        try:
            """
            !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            IMPORTANT NOTE: As of lmdb 0.98
            !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            In order for `dupsort` to work, need to provide a database name to
            `open_db()`, e.g open_db(b'db2', dupsort=True).

            If no database name is passed in, it will open the default database,
            and the transaction and cursor will point to the wrong address in
            memory and retrieve whatever is there.
            """
            if dbname not in self.dbs:
                db = env.open_db(key=dbname.encode('utf-8'), create=create, dupsort=True)
                self.dbs[dbname] = db
            else:
                db = self.dbs[dbname]
            return self._context(env, db)
        except Exception:
            current_app.logger.error(
                f'Failed to open LMDB database named {dbname}.',
                extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            )
            raise LMDBError(
                title='Cannot Connect to LMDB',
                message=f'Encountered unexpected error connecting to LMDB.')
