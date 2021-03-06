"""Migrate enrichment table schemas to remove version property

Revision ID: c4a037faaf1a
Revises: e32ff16900a3
Create Date: 2021-12-15 23:25:29.713828

"""
import hashlib
import json
import fastjsonschema

from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import table, column, and_
from sqlalchemy.orm.session import Session
from os import path

from migrations.utils import window_chunk
from neo4japp.constants import FILE_MIME_TYPE_ENRICHMENT_TABLE
from neo4japp.models import Files, FileContent

# revision identifiers, used by Alembic.
revision = 'c4a037faaf1a'
down_revision = 'e32ff16900a3'
branch_labels = None
depends_on = None

directory = path.realpath(path.dirname(__file__))
schema_file = path.join(directory, '../..', 'neo4japp/schemas/formats/enrichment_tables_v5.json')


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)
    pass


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
        column('raw_file', sa.LargeBinary),
        column('checksum_sha256', sa.Binary))

    files = conn.execution_options(stream_results=True).execute(sa.select([
        tableclause1.c.id.label('file_id'),
        tableclause2.c.id.label('file_content_id'),
        tableclause2.c.raw_file
    ]).where(
        and_(
            tableclause1.c.mime_type == FILE_MIME_TYPE_ENRICHMENT_TABLE,
            tableclause1.c.content_id == tableclause2.c.id
        )
    ))

    # just in case the processing has not picked up a checksum
    # that exists in the db before trying to insert it
    existing_checksums = session.execute(sa.select([
        tableclause2.c.id.label('file_content_id'),
        tableclause2.c.checksum_sha256
    ]))

    with open(schema_file, 'rb') as f:
        validate_enrichment_table = fastjsonschema.compile(json.load(f))
        file_content_hashes = {
            content_hash: content_id for content_id, content_hash in existing_checksums}

        for chunk in window_chunk(files, 25):
            files_to_update = []
            raws_to_update = []
            for fid, fcid, raw in chunk:
                try:
                    current = json.loads(raw)
                except Exception:
                    # TODO: what to do with these?
                    # they're literal strings, e.g 'AK3,AK4/9606/Homo sapiens/...'
                    # only in STAGE db
                    continue
                else:
                    try:
                        validate_enrichment_table(current)
                    except Exception as e:
                        err = str(e)
                        if err == "data.result must not contain {'version'} properties":
                            file_obj = {'id': fid}
                            current['result'].pop('version')
                            current = json.dumps(current, separators=(',', ':')).encode('utf-8')
                            new_hash = hashlib.sha256(current).digest()

                            # because we are fixing JSONs, it is possible
                            # to have collision since fixing a JSON
                            # can potentially result in an existing JSON
                            if new_hash not in file_content_hashes:
                                file_content_hashes[new_hash] = fcid
                                raws_to_update.append({'id': fcid, 'raw_file': current, 'checksum_sha256': new_hash})  # noqa
                            else:
                                file_obj['content_id'] = file_content_hashes[new_hash]
                                files_to_update.append(file_obj)

            try:
                session.bulk_update_mappings(Files, files_to_update)
                session.bulk_update_mappings(FileContent, raws_to_update)
                session.commit()
            except Exception:
                raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
