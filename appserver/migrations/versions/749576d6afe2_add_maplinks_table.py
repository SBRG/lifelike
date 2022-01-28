"""Add MapLinks table

Revision ID: 749576d6afe2
Revises: 8f6d4eef042d
Create Date: 2021-10-30 14:21:27.076408

"""
import json
import re
import zipfile
from io import BytesIO

from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column, and_
from sqlalchemy.orm import Session

from neo4japp.constants import FILE_MIME_TYPE_MAP
from migrations.utils import window_chunk
from neo4japp.models.files import MapLinks, Files

# revision identifiers, used by Alembic.
revision = '749576d6afe2'
down_revision = '8f6d4eef042d'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('map_links',
                    sa.Column('entry_id', sa.Integer(), nullable=False, autoincrement=True),
                    sa.Column('map_id', sa.Integer(), nullable=False),
                    sa.Column('linked_id', sa.Integer(), nullable=False),
                    sa.ForeignKeyConstraint(['linked_id'], ['files.id'],
                                            name=op.f('fk_map_links_linked_id_files')),
                    sa.ForeignKeyConstraint(['map_id'], ['files.id'],
                                            name=op.f('fk_map_links_map_id_files')),
                    sa.PrimaryKeyConstraint('entry_id', name=op.f('pk_map_links'))
                    )
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    op.drop_table('map_links')


def data_upgrades():
    regex = re.compile(r'^ */projects/.+/(files|enrichment-table)/.+$')
    conn = op.get_bind()
    session = Session(conn)

    t_files = table(
        'files',
        column('id', sa.Integer),
        column('content_id', sa.Integer),
        column('mime_type', sa.String)
    )

    t_files_content = table(
        'files_content',
        column('id', sa.Integer),
        column('raw_file', sa.LargeBinary)
    )

    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_files.c.id,
        t_files_content.c.raw_file
    ]).where(
        and_(
            t_files.c.mime_type == FILE_MIME_TYPE_MAP,
            t_files.c.content_id == t_files_content.c.id
        )
    ))
    # For some reason this gives me an error
    # for chunk in window_chunk(files, 25):
    entries_to_add = []
    for map_id, content in files:
        try:
            with zipfile.ZipFile(BytesIO(content), 'r') as zip_file:
                json_graph = json.loads(zip_file.read('graph.json'))
                entities = json_graph.get('nodes', []) + json_graph.get('edges', [])
                for entity in entities:
                    links = (entity.get('data', {}).get('sources') or []) + \
                            (entity.get('data', {}).get('hyperlinks') or [])
                    for link in links:
                        if regex.match(link.get('url', "")):
                            hash_id = link['url'].split('/')[-1]
                            file = session.query(Files).filter(
                                Files.hash_id == hash_id).one_or_none()
                            if file:
                                if file.id:
                                    entries_to_add.append(MapLinks(map_id=map_id,
                                                                   linked_id=file.id))
        except (KeyError, zipfile.BadZipfile):
            pass

    try:
        session.bulk_save_objects(entries_to_add)
        session.commit()
    except Exception:
        pass


def data_downgrades():
    pass
