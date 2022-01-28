""" Data migration from one column to another.
    Single hyperlink into multiple hyperlinks

Revision ID: cc345dcad75c
Revises: 101b9a60aa29
Create Date: 2020-07-07 15:13:38.895016
"""

from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy_utils.types import TSVectorType

# revision identifiers, used by Alembic.
revision = 'cc345dcad75c'
down_revision = '101b9a60aa29'
branch_labels = None
depends_on = None

t_app_user = sa.Table(
    'appuser',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('username', sa.String(64), index=True, unique=True),
    sa.Column('email', sa.String(120), index=True, unique=True),
    sa.Column('first_name', sa.String(120), nullable=False),
    sa.Column('last_name', sa.String(120), nullable=False),
)

t_project = sa.Table(
    'project',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('label', sa.String(250), nullable=False),
    sa.Column('description', sa.Text),
    sa.Column('date_modified', sa.DateTime),
    sa.Column('graph', sa.JSON),
  	sa.Column('author', sa.String(240), nullable=False),
  	sa.Column('public', sa.Boolean(), default=False),
    sa.Column('user_id', sa.Integer, sa.ForeignKey(t_app_user.c.id)),
    sa.Column('hash_id', sa.String(50), unique=True),
  	sa.Column('search_vector', TSVectorType('label'))
)


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
    conn = op.get_bind()

    # Pull in the entire collection of maps
    projs = conn.execute(sa.select([
        t_project.c.id,
        t_project.c.graph
    ])).fetchall()

    # Iterate through each project
    for (proj_id, graph) in projs:

        print(type(graph))

        # Iterate through each node
        def process_node(node):
            node_data = node.get("data", {})

            single_hyperlink = node_data.get("hyperlink", "")

            # Check if it has hyperlinks & and if not instantiate it
            if "hyperlinks" not in node_data:
                node_data["hyperlinks"] = []

            if len(single_hyperlink):
                node_data["hyperlinks"].append({
                    "url": single_hyperlink,
                    "domain": ""
                })

            node["data"] = node_data

            return node

        graph["nodes"] = list(
            map(
                process_node,
                graph.get("nodes", [])
            )
        )

        conn.execute(t_project
                    .update()
                    .where(t_project.c.id == proj_id)
                    .values(graph=graph))


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass