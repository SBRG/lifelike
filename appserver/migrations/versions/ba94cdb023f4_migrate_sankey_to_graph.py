"""migrate .sankey to .graph

Revision ID: ba94cdb023f4
Revises: 0e90858dd367
Create Date: 2021-08-09 11:34:14.879612

"""
import sqlalchemy as sa
from alembic import context
from alembic import op
from sqlalchemy.sql import table, column

# revision identifiers, used by Alembic.
revision = 'ba94cdb023f4'
down_revision = '0e90858dd367'
branch_labels = None
depends_on = None

files_table = table(
        'files',
        column('mime_type', sa.String)
)


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_downgrades()


def change_mime_type(from_, to_):
    conn = op.get_bind()
    query = files_table.update().where(files_table.c.mime_type == from_).values(mime_type=to_)
    return conn.execute(query)


def data_upgrades():
    return change_mime_type('vnd.lifelike.document/sankey', 'vnd.lifelike.document/graph')


def data_downgrades():
    return change_mime_type('vnd.lifelike.document/graph', 'vnd.lifelike.document/sankey')
