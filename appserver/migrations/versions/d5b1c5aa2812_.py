"""Converts any project names
that do not adhere to the naming
standards of using dashes for non-alphanumeric
characters

Revision ID: d5b1c5aa2812
Revises: 10c15d47e7c6
Create Date: 2020-08-10 20:44:31.097454

"""
import re
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd5b1c5aa2812'
down_revision = '10c15d47e7c6'
branch_labels = None
depends_on = None


t_projects = sa.Table(
    'projects',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
    sa.Column('project_name', sa.String(250), unique=True, nullable=False),
    sa.Column('description', sa.Text),
    sa.Column('creation_date', sa.DateTime, nullable=False, default=sa.func.now()),
    sa.Column('users', sa.ARRAY(sa.Integer), nullable=False)
)

def upgrade():
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
    """Convert projects name to use correct standards"""
    conn = op.get_bind()
    projects = conn.execute(sa.select([
        t_projects.c.id,
        t_projects.c.project_name,
    ])).fetchall()

    pat = re.compile(r'[^A-Za-z0-9-]')
    for pid, name in projects:
        conn.execute(t_projects.update().where(t_projects.c.id == pid).values(project_name=re.sub(pat, '-', name)))

def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
