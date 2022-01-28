"""migrate Sankey _views links ids
previously used <link_idx>_<trace_group> was not unique
start using <link_idx>_<trace_group>_<trace_idx> instead

Revision ID: e32ff16900a3
Revises: 3a751148aa3b
Create Date: 2021-12-02 16:42:30.673734

"""
import hashlib
import json
from os import path

import fastjsonschema
import sqlalchemy as sa
from alembic import context
from alembic import op
from sqlalchemy import table, column, and_
from sqlalchemy.orm import Session

from migrations.utils import window_chunk

# revision identifiers, used by Alembic.
revision = 'e32ff16900a3'
down_revision = '3a751148aa3b'
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
        column('mime_type', sa.String))

t_files_content = table(
        'files_content',
        column('id', sa.Integer),
        column('raw_file', sa.LargeBinary),
        column('checksum_sha256', sa.Binary)
)


def modify_files_with_views(modification_callback):
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
                    if view['state'].get('baseViewName') == 'sankey':
                        modification_callback(data, view)
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


def map_link_group_to_link_group_trace_idx(data, view):
    network_trace_idx = view['state']['networkTraceIdx']
    traces = data['graph']['trace_networks'][network_trace_idx]['traces']
    link_group_to_link_group_trace_idx = dict()
    for trace_idx, trace in enumerate(traces):
        for edge in trace['edges']:
            link_group_id = '_'.join(map(str, (edge, trace['group'])))
            link_group_trace_idx_id = '_'.join(map(str, (edge, trace['group'], trace_idx)))
            link_group_to_link_group_trace_idx[link_group_id] = link_group_trace_idx_id

    remapped_links = dict()
    for link_group_id, link_overwrites in view.get('links').items():
        if len(link_group_id.split('_')) == 2:
            remapped_links[link_group_to_link_group_trace_idx[link_group_id]] = link_overwrites
    view['links'] = remapped_links


def map_link_group_trace_idx_to_link_group(data, view):
    network_trace_idx = view['state']['networkTraceIdx']
    traces = data['graph']['trace_networks'][network_trace_idx]['traces']
    link_group_trace_idx_to_link_group = dict()
    for trace_idx, trace in enumerate(traces):
        for edge in trace['edges']:
            link_group_id = '_'.join(map(str, (edge, trace['group'])))
            link_group_trace_idx_id = '_'.join(map(str, (edge, trace['group'], trace_idx)))
            link_group_trace_idx_to_link_group[link_group_trace_idx_id] = link_group_id

    remapped_links = dict()
    for link_group_trace_idx_id, link_overwrites in view.get('links').items():
        if len(link_group_trace_idx_id.split('_')) == 3:
            remapped_links[
                link_group_trace_idx_to_link_group[link_group_trace_idx_id]
            ] = link_overwrites
    view['links'] = remapped_links


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_downgrades()


def data_upgrades():
    modify_files_with_views(map_link_group_to_link_group_trace_idx)


def data_downgrades():
    modify_files_with_views(map_link_group_trace_idx_to_link_group)
