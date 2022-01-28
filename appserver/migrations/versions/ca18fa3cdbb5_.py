"""combine file upload dedupe and temp lookup table migrations

Revision ID: ca18fa3cdbb5
Revises: 782b6ba8b7eb, cd1cffdea0e8
Create Date: 2020-05-05 22:28:58.575669

"""
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ca18fa3cdbb5'
down_revision = ('782b6ba8b7eb', 'cd1cffdea0e8')
branch_labels = None
depends_on = None


def upgrade():
    pass
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
