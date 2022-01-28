"""Allow _view property in graph file schema

Revision ID: 8f6d4eef042d
Revises: a2316139e9a3
Create Date: 2021-10-20 10:04:21.668552

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
revision = '8f6d4eef042d'
down_revision = 'a2316139e9a3'
branch_labels = None
depends_on = None
# reference to this directory
directory = path.realpath(path.dirname(__file__))

with open(path.join(directory, '../upgrade_data/graph_v3.json'), 'r') as f:
    # Use this method to validate the content of an enrichment table
    validate_graph = fastjsonschema.compile(json.load(f))


def drop_view_property():
    """
    We start using _view property in graph files. By design it should not exist (file
    format documentation prohibits properties starting with _). However, our schema do not used
    to validate this constrain. Just to be sure this migration runs check to delete _view
    property from existing files (new uploads with this property will not pass schema validation).
    """
    conn = op.get_bind()
    session = Session(conn)

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
        for id, content in chunk:
            graph = json.loads(content)
            if '_views' in graph:
                del graph['_views']
                validate_graph(graph)
                raw_file = json.dumps(graph).encode('utf-8')
                checksum_sha256 = hashlib.sha256(raw_file).digest()
                session.execute(
                        t_files_content.update().where(
                                t_files_content.c.id == id
                        ).values(
                                raw_file=raw_file,
                                checksum_sha256=checksum_sha256
                        )
                )
                session.flush()
    session.commit()


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def data_upgrades():
    drop_view_property()


def data_downgrades():
    drop_view_property()
