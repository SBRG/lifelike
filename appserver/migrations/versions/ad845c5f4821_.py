"""Truncate annotation_stop_words table.
Keep table, do not delete.

See migration 0d8dc6eed4c1 if need to
re-seed.

Revision ID: ad845c5f4821
Revises: 25ba0ec4eb17
Create Date: 2020-09-01 16:57:14.492628

"""
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ad845c5f4821'
down_revision = '25ba0ec4eb17'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('TRUNCATE TABLE annotation_stop_words')
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass
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
