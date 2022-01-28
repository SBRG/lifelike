"""Fixes the data structure to adhere to the following data structure

export interface UniversalEntityData {
  references?: Reference[];
  hyperlinks?: Hyperlink[];
  detail?: string;
  search?: Hyperlink[];
  subtype?: string;
  sources?: Source[];
}

Revision ID: 77f77a070e03
Revises: ad845c5f4821
Create Date: 2020-09-01 21:25:11.024223

"""
from alembic import context
from alembic import op
import copy
import sqlalchemy as sa
from sqlalchemy.orm.session import Session
from sqlalchemy_utils.types import TSVectorType


# revision identifiers, used by Alembic.
revision = '77f77a070e03'
down_revision = 'ad845c5f4821'
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
    projs = conn.execute(sa.select([
        t_project.c.id,
        t_project.c.graph
    ])).fetchall()

    def process_node(n):
        """ Reformat node data structure
        (1) Adds the hyperlinks key
        (2) Adds the sources key
        """
        node_data = n['data']
        # Add the hyperlinks key and transfer any existing hyperlink over if it exists
        if 'hyperlinks' not in node_data:
            # Reformat existing hyperlink if it exists
            if node_data.get('hyperlink'):
                node_data['hyperlinks'] = [dict(domain='', url=node_data['hyperlink'])]
            else:
                node_data['hyperlinks'] = []

        # Add the sources key and transfer any existing source over if it exists
        if 'sources' not in node_data:
            # Reformat existing source if it exists
            if node_data.get('source'):
                node_data['sources'] = [dict(type='', domain='', url=node_data['source'])]
            else:
                node_data['sources'] = []
        return n

    def process_edge(e):
        """ Reformat edge data structure
        (1) Adds the hyperlinks key
        (2) Adds the sources key
        """
        if 'data' in e:
            edge_data = e['data']
            if 'hyperlinks' not in e['data']:
                if edge_data.get('hyperlink'):
                    edge_data['hyperlinks'] = [dict(domain='', url=edge_data['hyperlink'])]
                else:
                    edge_data['hyperlinks'] = []

            if 'sources' not in e['data']:
                if edge_data.get('source'):
                    edge_data['sources'] = [dict(type='', domain='', url=edge_data['source'])]
                else:
                    edge_data['sources'] = []
        else:
            # If no data attribute, add one
            e['data'] = dict(hyperlinks=[], sources=[])
        return e

    for proj_id, graph in projs:
        nodes_copy = copy.deepcopy(graph['nodes'])
        edges_copy = copy.deepcopy(graph['edges'])
        graph['nodes'] = [process_node(n) for n in nodes_copy]
        graph['edges'] = [process_edge(e) for e in edges_copy]
        conn.execute(t_project.update().where(t_project.c.id == proj_id).values(graph=graph))



def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
