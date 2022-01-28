"""Delete worksheets table

Revision ID: cf9f210458c8
Revises: 85062d2a244a
Create Date: 2022-01-14 01:11:32.889812

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'cf9f210458c8'
down_revision = '85062d2a244a'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index('ix_worksheets_content_id', table_name='worksheets')
    op.drop_table('worksheets')


def downgrade():
    pass