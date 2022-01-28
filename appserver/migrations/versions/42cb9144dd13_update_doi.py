"""update DOI

Revision ID: 42cb9144dd13
Revises: bc9d080502da
Create Date: 2021-04-27 13:50:40.622862

"""
import io

from alembic import context
from alembic import op
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm.session import Session

# revision identifiers, used by Alembic.
from neo4japp.services.file_types.providers import PDFTypeProvider

revision = '42cb9144dd13'
down_revision = 'bc9d080502da'
branch_labels = None
depends_on = None

db = SQLAlchemy()

class Files(db.Model):
    __tablename__ = 'files'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    mime_type = db.Column(db.String(127), nullable=False)
    content_id = db.Column(db.Integer, db.ForeignKey('files_content.id', ondelete='CASCADE'),
                           index=True, nullable=True)
    content = db.relationship('FileContent', foreign_keys=content_id)
    doi = db.Column(db.String(1024), nullable=True)


class FileContent(db.Model):
    __tablename__ = 'files_content'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    raw_file = db.Column(db.LargeBinary, nullable=False)


def recalculate_doi_based_on_current_algorithm():
    session = Session(op.get_bind())
    pdf_type_provider = PDFTypeProvider()

    for file in session.query(Files) \
            .filter(Files.mime_type == 'application/pdf') \
            .join(Files.content) \
            .with_entities(Files.id, Files.doi, FileContent.raw_file):

        buffer = io.BytesIO(file.raw_file)
        extracted_doi = pdf_type_provider.extract_doi(buffer)

        session.query(Files)\
            .filter(Files.id == file.id)\
            .update(dict(doi=extracted_doi))


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_downgrades()
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    recalculate_doi_based_on_current_algorithm()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    recalculate_doi_based_on_current_algorithm()
