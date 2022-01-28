"""Fix file_version hash_id

Revision ID: bc9d080502da
Revises: 819554a9fcf3
Create Date: 2021-03-29 18:08:35.564640

"""
import itertools

import sqlalchemy as sa
from alembic import op
# revision identifiers, used by Alembic.
from sqlalchemy.orm import Session

from neo4japp.models.common import generate_hash_id

revision = 'bc9d080502da'
down_revision = '819554a9fcf3'
branch_labels = None
depends_on = None

# Customize these thresholds based on available memory to buffer query results
CONTENT_QUERY_BATCH_SIZE = 25

t_file_version = sa.Table(
    'file_version',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('hash_id'),
)

t_file_backup = sa.Table(
    'file_backup',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('hash_id'),
)

affected_tables = [t_file_version, t_file_backup]


def iter_query(query, *, batch_size):
    """
    Fetch query in batches to reduce memory usage.
    """
    results = iter(query.yield_per(batch_size))

    while True:
        batch = list(itertools.islice(results, batch_size))

        if not batch:
            return

        for row in batch:
            yield row


def upgrade():
    session = Session(op.get_bind())

    for table in affected_tables:
        for row_id in iter_query(
                session.query(table.c.id).filter(table.c.hash_id.is_(None)),
                batch_size=CONTENT_QUERY_BATCH_SIZE):
            session.execute(table.update()
                            .where(table.c.id == row_id)
                            .values(hash_id=generate_hash_id()))

        op.alter_column(table.name, 'hash_id',
                        existing_type=sa.VARCHAR(length=36),
                        nullable=False)


def downgrade():
    for table in affected_tables:
        op.alter_column(table.name, 'hash_id',
                        existing_type=sa.VARCHAR(length=36),
                        nullable=True)
