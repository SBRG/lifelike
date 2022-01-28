"""Fix broken map links on production

Revision ID: 65d827e55b5b
Revises: 1e48a5fadb23
Create Date: 2021-12-07 00:35:15.548428

"""
from alembic import context, op
import hashlib
import io
import json
import logging
import os
import re
import sqlalchemy as sa
from sqlalchemy import table, column, and_
from sqlalchemy.orm import Session
import zipfile

from neo4japp.models.files import FileContent
from neo4japp.schemas.formats.drawing_tool import validate_map

# revision identifiers, used by Alembic.
revision = '65d827e55b5b'
down_revision = '1e48a5fadb23'
branch_labels = None
depends_on = None

logger = logging.getLogger('alembic.runtime.migration.' + __name__)


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        # This migration may have unintended side effects on environments other than production.
        if os.getenv('FLASK_APP_CONFIG') == 'Production':
            data_upgrades()
        else:
            logger.info(
                'Detected non-prouction environment, skipping data upgrades for this' +
                'migration'
            )

def downgrade():
    return


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    t_files = table(
            'files',
            column('id', sa.Integer),
            column('content_id', sa.Integer),
            column('mime_type', sa.String))

    t_files_content = table(
            'files_content',
            column('id', sa.Integer),
            column('raw_file', sa.LargeBinary),
            column('checksum_sha256', sa.Binary)
    )

    HASH_CONVERSION_MAP = {
        'de68d1e1-3994-4c7a-af7a-3789716e79ff': '6a843f71-b695-47ac-a6f9-9b8472952949',
        '3fff7f88-75ee-441a-819b-ba2366a1ac62': '986bf4e8-8a20-4626-b48b-b0be2b6b2e06',
        '38c5cfca-fb32-4d57-8496-2d24ac708be7': 'b77a485a-1fd6-4c07-a971-981adea6ad49',
        'fd606a22-22f6-48e4-ba64-f281b341f546': 'd0f409a8-2a2c-408e-9909-f9e5a68b795c',
        '4ab69dea-0d8a-4dd2-b53d-aad4fb1bb535': '91b6203a-b6b2-4cfd-8979-d3960a12ead8',
        'a09f3468-9e34-45b1-a2dc-f8ce827461f6': 'd3151e07-4c9c-4938-81a9-88affd12eed9',
        'fd610276-17df-4e0e-9781-5bff764054f6': '480a8477-aab1-48ca-84f7-149d77707ac8',
        '6d34ad38-487d-4fca-b8a0-9e1ecefb226c': '94f2f4bc-25d3-477a-a6d0-daa00422da21',
        '4fcf4be9-2d23-40ce-ae94-7d183a31fc98': '09123f7e-04d3-451f-833b-551c32e21494',
        '5ed1e56c-2c90-4135-a0ad-5c4c2c4474ea': '5b504203-8dda-4e1b-a678-6e4086cc57f5',
        '365afbea-26f6-46cc-9c66-b5abeb2a9d7a': '4b2a7d5d-34e3-4028-afa5-b4ee3a492ec9',
        'cb380810-8c11-47d4-9092-4f91870c2f5e': '92367577-ec4c-43cd-9d19-94bf6f0592ec',
        'a6c9ba6b-4e5b-4747-9646-960e8482612c': '0a526733-3f74-44c9-9b0f-3df989459a50',
    }
    FILE_IDS = [
        1117,
        1222,
        1350,
        1367,
        2010,
        1128,
        1228,
        2007,
        1353,
        1366,
        1634,
        1555
    ]

    raw_maps_to_fix = conn.execution_options(stream_results=True).execute(sa.select([
        t_files_content.c.id,
        t_files_content.c.raw_file
    ]).where(
        and_(
            t_files.c.mime_type == 'vnd.lifelike.document/map',
            t_files.c.content_id == t_files_content.c.id,
            t_files.c.id.in_(FILE_IDS)
        )
    ))

    new_link_re = r'^\/projects\/(?:[^\/]+)\/[^\/]+\/([a-zA-Z0-9-]+)'
    need_to_update = []
    for fcid, raw_file in raw_maps_to_fix:
        logger.info(f'Replacing links in file #{fcid}')
        zip_file = zipfile.ZipFile(io.BytesIO(raw_file))
        map_json = json.loads(zip_file.read('graph.json'))

        for node in map_json['nodes']:
            for source in node['data'].get('sources', []):
                link_search = re.search(new_link_re, source['url'])
                if link_search is not None:
                    hash_id = link_search.group(1)
                    if hash_id in HASH_CONVERSION_MAP:
                        logger.info(
                            f'\tFound hash_id {hash_id} in file #{fcid}, replacing with ' +
                            f'{HASH_CONVERSION_MAP[hash_id]}'
                        )
                        source['url'] = source['url'].replace(
                            hash_id,
                            HASH_CONVERSION_MAP[hash_id]
                        )

        for edge in map_json['edges']:
            if 'data' in edge:
                for source in edge['data'].get('sources', []):
                    link_search = re.search(new_link_re, source['url'])
                    if link_search is not None:
                        hash_id = link_search.group(1)
                        if hash_id in HASH_CONVERSION_MAP:
                            logger.info(
                                f'\tFound hash_id {hash_id} in file #{fcid}, replacing with ' +
                                f'{HASH_CONVERSION_MAP[hash_id]}'
                            )
                            source['url'] = source['url'].replace(
                                hash_id,
                                HASH_CONVERSION_MAP[hash_id]
                            )

        byte_graph = json.dumps(map_json, separators=(',', ':')).encode('utf-8')
        validate_map(json.loads(byte_graph))

        # Zip the file back up before saving to the DB
        zip_bytes2 = io.BytesIO()
        with zipfile.ZipFile(zip_bytes2, 'x') as zip_file:
            zip_file.writestr('graph.json', byte_graph)
        new_bytes = zip_bytes2.getvalue()
        new_hash = hashlib.sha256(new_bytes).digest()
        need_to_update.append({'id': fcid, 'raw_file': new_bytes, 'checksum_sha256': new_hash})  # noqa

    try:
        session.bulk_update_mappings(FileContent, need_to_update)
        session.commit()
    except Exception:
        session.rollback()
        raise
