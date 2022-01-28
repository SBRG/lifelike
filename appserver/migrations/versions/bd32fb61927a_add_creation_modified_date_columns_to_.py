"""Add creation/modified date columns to tables

Revision ID: bd32fb61927a
Revises: a6f4dec3a2d6
Create Date: 2020-08-26 22:42:37.828585

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column
from sqlalchemy.types import TIMESTAMP

from neo4japp.database import db


# revision identifiers, used by Alembic.
revision = 'bd32fb61927a'
down_revision = 'a6f4dec3a2d6'
branch_labels = None
depends_on = None


t_appuser = table(
    'appuser',
    column('creation_date', TIMESTAMP(timezone=True)),
    column('modified_date', TIMESTAMP(timezone=True)),
)

t_directory = table(
    'directory',
    column('creation_date', TIMESTAMP(timezone=True)),
    column('modified_date', TIMESTAMP(timezone=True)),
)

t_files = table(
    'files',
    column('modified_date', TIMESTAMP(timezone=True)),
)

t_global_list = table(
    'global_list',
    column('creation_date', TIMESTAMP(timezone=True)),
    column('modified_date', TIMESTAMP(timezone=True)),
)

t_project = table(
    'project',
    column('creation_date', TIMESTAMP(timezone=True)),
    column('date_modified', TIMESTAMP(timezone=True)),
)

t_project_backup = table(
    'project_backup',
    column('creation_date', TIMESTAMP(timezone=True)),
    column('date_modified', TIMESTAMP(timezone=True)),
)

t_projects = table(
    'projects',
    column('modified_date', TIMESTAMP(timezone=True)),
)

t_worksheets = table(
    'worksheets',
    column('modified_date', TIMESTAMP(timezone=True)),
)


def upgrade():
    # Create columns with nullable constraint, otherwise postgres will throw an error for existing data
    op.add_column('appuser', sa.Column('creation_date', TIMESTAMP(timezone=True), default=db.func.now(), server_default=db.func.now(), nullable=True))
    op.add_column('appuser', sa.Column('modified_date', TIMESTAMP(timezone=True),  default=db.func.now(), server_default=db.func.now(), nullable=True))
    op.add_column('directory', sa.Column('creation_date', TIMESTAMP(timezone=True),  default=db.func.now(), server_default=db.func.now(), nullable=True))
    op.add_column('directory', sa.Column('modified_date', TIMESTAMP(timezone=True),  default=db.func.now(), server_default=db.func.now(), nullable=True))
    op.add_column('files', sa.Column('modified_date', TIMESTAMP(timezone=True),  default=db.func.now(), server_default=db.func.now(), nullable=True))
    op.add_column('global_list', sa.Column('creation_date', TIMESTAMP(timezone=True),  default=db.func.now(), server_default=db.func.now(), nullable=True))
    op.add_column('global_list', sa.Column('modified_date', TIMESTAMP(timezone=True),  default=db.func.now(), server_default=db.func.now(), nullable=True))
    op.add_column('project', sa.Column('creation_date', TIMESTAMP(timezone=True),  default=db.func.now(), server_default=db.func.now(), nullable=True))
    op.add_column('project_backup', sa.Column('creation_date', TIMESTAMP(timezone=True),  default=db.func.now(), server_default=db.func.now(), nullable=True))
    op.add_column('projects', sa.Column('modified_date', TIMESTAMP(timezone=True),  default=db.func.now(), server_default=db.func.now(), nullable=True))
    op.add_column('worksheets', sa.Column('modified_date', TIMESTAMP(timezone=True),  default=db.func.now(), server_default=db.func.now(), nullable=True))

    # After columns are created and seeded, set not null constraint
    op.alter_column('appuser', 'creation_date', nullable=False)
    op.alter_column('appuser', 'modified_date', nullable=False)
    op.alter_column('directory', 'creation_date', nullable=False)
    op.alter_column('directory', 'modified_date', nullable=False)
    op.alter_column('files', 'modified_date', nullable=False)
    op.alter_column('files', 'creation_date', nullable=False, type_=TIMESTAMP(timezone=True))
    op.alter_column('global_list', 'creation_date', nullable=False)
    op.alter_column('global_list', 'modified_date', nullable=False)
    op.alter_column('project', 'creation_date', nullable=False)
    op.alter_column('project', 'date_modified', nullable=False, type_=TIMESTAMP(timezone=True))
    op.alter_column('project_backup', 'creation_date', nullable=False)
    op.alter_column('project_backup', 'date_modified', nullable=False, type_=TIMESTAMP(timezone=True))
    op.alter_column('projects', 'modified_date', nullable=False)
    op.alter_column('projects', 'creation_date', nullable=False, type_=TIMESTAMP(timezone=True))
    op.alter_column('worksheets', 'modified_date', nullable=False)
    op.alter_column('worksheets', 'creation_date', nullable=False, type_=TIMESTAMP(timezone=True))


def downgrade():
    op.drop_column('worksheets', 'modified_date')
    op.drop_column('projects', 'modified_date')
    op.drop_column('project_backup', 'creation_date')
    op.drop_column('project', 'creation_date')
    op.drop_column('global_list', 'modified_date')
    op.drop_column('global_list', 'creation_date')
    op.drop_column('files', 'modified_date')
    op.drop_column('directory', 'modified_date')
    op.drop_column('directory', 'creation_date')
    op.drop_column('appuser', 'modified_date')
    op.drop_column('appuser', 'creation_date')

    op.alter_column('files', 'creation_date', nullable=True, type_=TIMESTAMP(timezone=False))
    op.alter_column('project', 'date_modified', nullable=True, type_=TIMESTAMP(timezone=False))
    op.alter_column('project_backup', 'date_modified', nullable=True, type_=TIMESTAMP(timezone=False))
    op.alter_column('projects', 'creation_date', nullable=True, type_=TIMESTAMP(timezone=False))
    op.alter_column('worksheets', 'creation_date', nullable=True, type_=TIMESTAMP(timezone=False))


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass

def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
