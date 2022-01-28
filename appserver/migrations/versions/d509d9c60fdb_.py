"""The isDatabase property was removed for links, so need to remove them from maps

Revision ID: d509d9c60fdb
Revises: fd1627b3a32e
Create Date: 2021-07-22 21:04:14.956129

"""
import hashlib
import json
from alembic import context
from alembic import op
import sqlalchemy as sa

from os import path
from sqlalchemy.sql import table, column, and_
from sqlalchemy.orm.session import Session

import fastjsonschema

from migrations.utils import window_chunk
from neo4japp.constants import FILE_MIME_TYPE_MAP
from neo4japp.models import FileContent

# revision identifiers, used by Alembic.
revision = 'd509d9c60fdb'
down_revision = 'fd1627b3a32e'
branch_labels = None
depends_on = None


directory = path.realpath(path.dirname(__file__))
schema_file = path.join(directory, '../..', 'neo4japp/schemas/formats/map_v2.json')


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    tableclause1 = table(
        'files',
        column('id', sa.Integer),
        column('content_id', sa.Integer),
        column('mime_type', sa.String))

    tableclause2 = table(
        'files_content',
        column('id', sa.Integer),
        column('raw_file', sa.LargeBinary))

    files = conn.execution_options(stream_results=True).execute(sa.select([
        tableclause2.c.id,
        tableclause2.c.raw_file
    ]).where(
        and_(
            tableclause1.c.mime_type == FILE_MIME_TYPE_MAP,
            tableclause1.c.content_id == tableclause2.c.id
        )
    ))

    with open(schema_file, 'rb') as f:
        validate_map = fastjsonschema.compile(json.load(f))

        for chunk in window_chunk(files, 25):
            need_to_update = []
            for fcid, raw in chunk:
                try:
                    graph = json.loads(raw)
                    validate_map(graph)
                except Exception as e:
                    if 'isDatabase' in str(e):
                        for node in graph['nodes']:
                            for link in node.get('data', {}).get('hyperlinks', []):
                                link.pop('isDatabase', None)

                        for edge in graph['edges']:
                            for link in edge.get('data', {}).get('hyperlinks', []):
                                link.pop('isDatabase', None)

                        byte_graph = json.dumps(graph, separators=(',', ':')).encode('utf-8')
                        new_hash = hashlib.sha256(byte_graph).digest()
                        validate_map(json.loads(byte_graph))
                        need_to_update.append({'id': fcid, 'raw_file': byte_graph, 'checksum_sha256': new_hash})  # noqa
            try:
                session.bulk_update_mappings(FileContent, need_to_update)
                session.commit()
            except Exception:
                raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
