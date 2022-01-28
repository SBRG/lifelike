"""Add view table

Revision ID: 3a751148aa3b
Revises: 8f6d4eef042d
Create Date: 2021-11-12 20:20:47.130954

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '3a751148aa3b'
down_revision = 'e89de4f6cd7f'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('views',
                    sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
                    sa.Column('params', sa.JSON(), nullable=False),
                    sa.Column('checksum_sha256', sa.Binary(32), nullable=False, index=True,
                              unique=True),
                    sa.Column('modification_date', sa.DateTime, nullable=False,
                              default=sa.func.now(), onupdate=sa.func.current_timestamp())
                    )


def downgrade():
    op.drop_table('views')
