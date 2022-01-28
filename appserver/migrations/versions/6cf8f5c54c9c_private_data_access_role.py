"""add private-data-access role

Revision ID: 6cf8f5c54c9c
Revises: 151b6ffde36f
Create Date: 2020-10-16 10:23:43.588102

"""
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
from sqlalchemy.orm import Session

revision = '6cf8f5c54c9c'
down_revision = '151b6ffde36f'
branch_labels = None
depends_on = None

t_app_role = sa.Table(
    'app_role',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('name'),
)

def upgrade():
    session = Session(op.get_bind())
    session.execute(t_app_role.insert().values(name="private-data-access"))


def downgrade():
    raise Exception("downgrade not supported")


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
