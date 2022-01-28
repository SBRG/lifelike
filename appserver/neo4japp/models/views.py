import hashlib
import json
from typing import Dict

from sqlalchemy.dialects.postgresql import insert

from neo4japp.database import db
from neo4japp.models.common import RDBMSBase, HashIdMixin


class View(RDBMSBase):
    __tablename__ = 'views'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    params = db.Column(db.JSON, nullable=False)
    checksum_sha256 = db.Column(db.Binary(32), nullable=False, index=True, unique=True)
    modification_date = db.Column(db.DateTime, nullable=False, default=db.func.now())

    @classmethod
    def get_checksum(cls, params) -> bytes:
        return hashlib.sha256(json.dumps(params).encode('utf-8')).digest()

    @classmethod
    def get_or_create(cls, params: Dict, checksum_sha256: bytes = None):
        """Get the existing view row for the given params or create a new row if needed.

        :param params: a json-like string
        :param checksum_sha256: the checksum of the params (computed if not provided)
        :return: the id of the db view row
        """
        if checksum_sha256 is None:
            checksum_sha256 = cls.get_checksum(params)

        return db.session.execute(
                insert(cls)
                .values(checksum_sha256=checksum_sha256, params=params)
                .on_conflict_do_update(
                    index_elements=[cls.checksum_sha256],
                    set_=dict(modification_date=db.func.now())
                )
                .returning(cls.id)
        ).fetchone()
