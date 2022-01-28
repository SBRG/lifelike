"""add view size to saved sankey views

Revision ID: edac65841141
Revises: 65d827e55b5b
Create Date: 2022-01-14 12:57:07.393146

"""
import json
from functools import reduce
from os import path

import fastjsonschema
import hashlib
import sqlalchemy as sa
from alembic import context
from alembic import op
from math import inf
from sqlalchemy import column, table, and_
from sqlalchemy.orm import Session

from migrations.utils import window_chunk

# revision identifiers, used by Alembic.
revision = 'edac65841141'
down_revision = '65d827e55b5b'
branch_labels = None
depends_on = None
# reference to this directory
directory = path.realpath(path.dirname(__file__))

with open(path.join(directory, '../upgrade_data/graph_v3.json'), 'r') as f:
    # Use this method to validate the content of an enrichment table
    validate_graph = fastjsonschema.compile(json.load(f))

t_files = table(
        'files',
        column('content_id', sa.Integer),
        column('mime_type', sa.String)
)

t_files_content = table(
        'files_content',
        column('id', sa.Integer),
        column('raw_file', sa.LargeBinary),
        column('checksum_sha256', sa.Binary)
)


def modify_sankey_views(modification_callback):
    conn = op.get_bind()
    session = Session(conn)
    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_files_content.c.id,
        t_files_content.c.raw_file
    ]).where(
            and_(
                    t_files.c.mime_type == 'vnd.lifelike.document/graph',
                    t_files.c.content_id == t_files_content.c.id
            )
    ))

    for chunk in window_chunk(files, 25):
        for id_, content in chunk:
            data = json.loads(content)

            if data.get('_views'):
                modified = None
                for view in data['_views'].values():
                    modification_callback(view)
                    modified = True

                if modified:
                    validate_graph(data)
                    raw_file = json.dumps(data).encode('utf-8')
                    checksum_sha256 = hashlib.sha256(raw_file).digest()
                    session.execute(
                            t_files_content.update().where(
                                    t_files_content.c.id == id_
                            ).values(
                                    raw_file=raw_file,
                                    checksum_sha256=checksum_sha256
                            )
                    )
        session.flush()
    session.commit()


def set_view_size_based_on_nodes_position(view):
    extend = reduce(
            lambda acc, node: dict(
                    x0=min(acc['x0'], node.get('_x0', inf)),
                    x1=max(acc['x1'], node.get('_x1', -inf)),
                    y0=min(acc['y0'], node.get('_y0', inf)),
                    y1=max(acc['y1'], node.get('_y1', -inf))
            ),
            view.get('nodes').values(),
            dict(x0=inf, x1=-inf, y0=inf, y1=-inf)
    )
    view['size'] = dict(width=extend['x1'] - extend['x0'], height=extend['y1'] - extend['y0'])


def delete_view_size(view):
    del view['size']


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_downgrades()


def data_upgrades():
    modify_sankey_views(set_view_size_based_on_nodes_position)


def data_downgrades():
    modify_sankey_views(delete_view_size)
