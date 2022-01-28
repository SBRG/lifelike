from sqlalchemy.dialects import postgresql
from sqlalchemy.types import TIMESTAMP

from neo4japp.database import db
from neo4japp.models.common import RDBMSBase, TimestampMixin


class GlobalList(RDBMSBase, TimestampMixin):
    __tablename__ = 'global_list'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    annotation = db.Column(postgresql.JSON, nullable=False)
    type = db.Column(db.String(12), nullable=False)
    file_content_id = db.Column(db.Integer, db.ForeignKey('files_content.id'), nullable=False, index=True)  # noqa
    # nullable to work with existing data because due to previous bad migration,
    # we're not going to migrate values into this new column
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=True, index=True)
    reviewed = db.Column(db.Boolean, default=False)
    approved = db.Column(db.Boolean, default=False)


class AnnotationStopWords(RDBMSBase):
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    word = db.Column(db.String(80), nullable=False)


class LMDB(RDBMSBase):
    __tablename__ = 'lmdb'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(64), nullable=False)
    modified_date = db.Column(TIMESTAMP(timezone=True), default=db.func.now(), nullable=False)
    # azure file storage uses md5
    checksum_md5 = db.Column(db.String(32), nullable=False, index=True, unique=True)
