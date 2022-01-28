"""Adds tables for entity resources (styles and uris)

Revision ID: b1ead1f6948a
Revises: 9fe3f348bf65
Create Date: 2020-06-30 14:37:18.017051

"""
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b1ead1f6948a'
down_revision = '9fe3f348bf65'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('annotation_style',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('label', sa.String(length=32), nullable=False),
    sa.Column('color', sa.String(length=9), nullable=False),
    sa.Column('icon_code', sa.String(length=32), nullable=True),
    sa.Column('font_color', sa.String(length=9), nullable=True),
    sa.Column('border_color', sa.String(length=9), nullable=True),
    sa.Column('background_color', sa.String(length=9), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_annotation_style'))
    )
    op.create_table('domain_urls_map',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('domain', sa.String(length=128), nullable=False),
    sa.Column('base_URL', sa.String(length=256), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_domain_urls_map'))
    )
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('domain_urls_map')
    op.drop_table('annotation_style')
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
