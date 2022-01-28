"""Fix unmigrated model changes

Revision ID: 25ba0ec4eb17
Revises: bd32fb61927a
Create Date: 2020-08-26 23:40:32.903864

"""
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '25ba0ec4eb17'
down_revision = 'bd32fb61927a'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('directory', 'user_id',
               existing_type=sa.INTEGER(),
               nullable=True)

    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    op.alter_column('directory', 'user_id',
               existing_type=sa.INTEGER(),
               nullable=False)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
