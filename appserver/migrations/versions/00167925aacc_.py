"""update old enrichment table files to use additional '/'

Revision ID: 00167925aacc
Revises: 5b17cf4f72b0
Create Date: 2020-11-18 20:25:26.343369

"""
import hashlib

from alembic import context
from alembic import op
import sqlalchemy as sa


from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '00167925aacc'
down_revision = '5b17cf4f72b0'
branch_labels = None
depends_on = None


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    return

def data_upgrades():
    """Add optional data upgrade migrations here"""
    session = Session(op.get_bind())

    files_table = table(
        'files',
        column('filename', sa.String),
        column('content_id', sa.Integer)
    )

    enrichment_files = session.execute(sa.select([
        files_table.c.content_id,
    ]).where(
        files_table.c.filename.like('%.enrichment')
    )).fetchall()

    files_content_table = table(
        'files_content',
        column('id', sa.Integer),
        column('raw_file', sa.String),
        column('checksum_sha256', sa.Binary)
    )

    enrichment_files_content = session.execute(sa.select([
        files_content_table.c.id,
        files_content_table.c.raw_file,
    ]).where(
        files_content_table.c.id.in_([f.content_id for f in enrichment_files])
    )).fetchall()

    # Regulon, UniProt, String, GO, Biocyc

    for e in enrichment_files_content:
        enrichment_data = e.raw_file.tobytes().decode('utf-8')
        data = enrichment_data.split('/')

        if len(data) == 2:
            enrichment_data += '//Regulon,UniProt,String,GO,Biocyc'
        elif len(data) == 3:
            enrichment_data += '/Regulon,UniProt,String,GO,Biocyc'

        enrichment_data = enrichment_data.encode('utf-8')
        checksum_sha256 = hashlib.sha256(enrichment_data).digest()

        try:
            session.execute(
                files_content_table.update().where(
                    files_content_table.c.id == e.id
                ).values(
                        raw_file=enrichment_data,
                        checksum_sha256=checksum_sha256
                    )
                )
        except Exception:
            session.rollback()
            session.close()
            raise

    try:
        session.commit()
        session.close()
    except Exception:
        session.rollback()
        session.close()
        raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    return
