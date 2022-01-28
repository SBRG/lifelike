from typing import List
import click
import copy
import hashlib
import importlib
import io
import json
import logging
import math
import os
import re
import sentry_sdk
import uuid
import requests
import zipfile

from flask import g, request

from marshmallow.exceptions import ValidationError

from collections import namedtuple
from sqlalchemy import inspect, Table
from sqlalchemy.sql.expression import and_, text
from sqlalchemy.exc import IntegrityError

from neo4japp.constants import (
    ANNOTATION_STYLES_DICT,
    FILE_MIME_TYPE_ENRICHMENT_TABLE,
    FILE_MIME_TYPE_MAP,
    FILE_MIME_TYPE_PDF,
    LogEventType
)
from neo4japp.services.annotations.constants import LMDB_DATA_DIR
from neo4japp.database import db, get_account_service, get_elastic_service, get_file_type_service
from neo4japp.factory import create_app
from neo4japp.lmdb_manager import LMDBManager, AzureStorageProvider
from neo4japp.models import AppUser
from neo4japp.models.files import FileContent, Files
from neo4japp.schemas.formats.drawing_tool import validate_map
from neo4japp.utils.logger import EventLog

app = create_app(config='config.Config')
logger = logging.getLogger(__name__)


@app.before_request
def request_navigator_log():
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag(
            'transaction_id', request.headers.get('X-Transaction-Id'))
    app.logger.info(
        EventLog(event_type=LogEventType.SYSTEM.value).to_dict())


@app.cli.command("seed")
def seed():
    def find_existing_row(model, value):
        if isinstance(value, dict):
            f = value
        else:
            f = {
                model.primary_key[0].name: value,
            }
        return db.session.query(model).filter_by(**f).one()

    with open("fixtures/seed.json", "r") as f:
        fixtures = json.load(f)
        truncated_tables = []

        for fixture in fixtures:
            module_name, class_name = fixture['model'].rsplit('.', 1)
            module = importlib.import_module(module_name)
            model = getattr(module, class_name)

            if isinstance(model, Table):
                truncated_tables.append(model.name)
            else:
                model_meta = inspect(model)
                for table in model_meta.tables:
                    truncated_tables.append(table.name)

        logger.info("Clearing database of data...")
        conn = db.engine.connect()
        trans = conn.begin()
        for table in truncated_tables:
            logger.info(f"Truncating {table}...")
            conn.execute(f'ALTER TABLE "{table}" DISABLE TRIGGER ALL;')
            conn.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE;')
            conn.execute(f'ALTER TABLE "{table}" ENABLE TRIGGER ALL;')
        trans.commit()

        logger.info("Inserting fixtures...")
        for fixture in fixtures:
            module_name, class_name = fixture['model'].rsplit('.', 1)
            module = importlib.import_module(module_name)
            model = getattr(module, class_name)

            if isinstance(model, Table):
                logger.info(f"Creating fixtures for {class_name}...")
                db.session.execute(model.insert(), fixture['records'])
                table = model
            else:
                model_meta = inspect(model)
                table = model.__table__
                relationships = model_meta.relationships
                logger.info(f"Creating fixtures for {class_name}...")

                for record in fixture['records']:
                    instance = model()
                    for key in record:
                        if key in relationships:
                            fk_model = relationships[key].mapper
                            if isinstance(record[key], list):
                                for value in record[key]:
                                    getattr(instance, key).append(
                                        find_existing_row(fk_model, value)
                                    )
                            else:
                                setattr(instance, key, find_existing_row(fk_model, record[key]))
                        else:
                            setattr(instance, key, record[key])
                    db.session.add(instance)

            db.session.flush()
            db.session.commit()

            if 'id' in table.columns:
                logger.info(f"Updating sequence for {table.name}...")
                conn.execute(f'SELECT pg_catalog.setval('
                             f'pg_get_serial_sequence(\'{table.name}\', \'id\'), '
                             f'MAX(id) + 1) FROM {table.name};')
            else:
                logger.info(f"No ID column for {class_name}")

            db.session.flush()
            db.session.commit()

        logger.info("Fixtures imported")


@app.cli.command("drop_tables")
def drop_all_tables_and_enums():
    """
        Drop all tables and user enums from a postgres database
    """
    with app.app_context():

        # Get and drop all tables
        table_sql = (
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name NOT LIKE 'pg_%%'"
        )
        for table in [
            name for (name,) in db.engine.execute(text(table_sql))
        ]:
            db.engine.execute(text('DROP TABLE "%s" CASCADE' % table))

        # Get and drop all enums
        enum_sql = (
            "SELECT DISTINCT t.typname "
            "FROM pg_catalog.pg_type t "
            "JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid"
        )
        for enum in [
            name for (name,) in db.engine.execute(text(enum_sql))
        ]:
            db.engine.execute(text('DROP TYPE IF EXISTS "%s" CASCADE' % enum))


@app.cli.command("create-user")
@click.argument("name", nargs=1)
@click.argument("email", nargs=1)
def create_user(name, email):
    user = AppUser(
        username=name,
        first_name=name,
        last_name=name,
        email=email,
    )
    # set default role
    account_service = get_account_service()
    get_role = account_service.get_or_create_role('user')
    user.roles.extend([get_role])
    user.set_password('password')
    db.session.add(user)
    db.session.commit()


@app.cli.command("set-role")
@click.argument("email", nargs=1)
@click.argument("role", nargs=1)
def set_role(email, role):
    account_service = get_account_service()
    user = AppUser.query.filter_by(email=email).one()
    get_role = account_service.get_or_create_role(role)
    user.roles.extend([get_role])
    db.session.commit()


@app.cli.command('reset-elastic')
def reset_elastic():
    """Seeds Elastic with all pipelines and indices. Typically should be used when a new Elastic DB
    is first created, but will also update/re-index the entire database if run later."""
    elastic_service = get_elastic_service()
    elastic_service.recreate_indices_and_pipelines()


@app.cli.command('recreate-elastic-index')
@click.argument('index_id', nargs=1)
@click.argument('index_mapping_file', nargs=1)
def update_or_create_index(index_id, index_mapping_file):
    """Given an index id and mapping file, creates a new elastic index. If the index already exists,
    we recreate it and re-index all documents."""
    elastic_service = get_elastic_service()
    elastic_service.update_or_create_index(index_id, index_mapping_file)


@app.cli.command('load-lmdb')
def load_lmdb():
    """ Downloads LMDB files from Cloud to Local for application """
    manager = LMDBManager(AzureStorageProvider(), 'lmdb')
    manager.download_all(LMDB_DATA_DIR)
    manager.update_all_dates(LMDB_DATA_DIR)


@app.cli.command('upload-lmdb')
def upload_lmdb():
    """ Uploads LMDB files from local to Azure cloud storage.
    To upload LMDB files,
    1. Load the files into the proper directories under
    ../services/annotations/lmdb/<categories>/<data.mdb|lock.mdb>
    2. Update the 'lmdb_config.json' under the lmdb_manager directory
    to the correct versions
    """
    manager = LMDBManager(AzureStorageProvider(), 'lmdb')
    manager.upload_all(LMDB_DATA_DIR)


Fallback = namedtuple('Fallback', ['organism_name', 'organism_synonym', 'organism_id'])


@app.cli.command('reannotate')
@click.argument('user')  # the user email
@click.argument('password')
def reannotate_files(user, password):
    from neo4japp.models import FileContent, FallbackOrganism
    # from neo4japp.exceptions import AnnotationError
    from neo4japp.schemas.annotations import AnnotationConfigurations
    from multiprocessing import Process, Queue, cpu_count
    import time

    def get_token():
        req = requests.post(
            'http://localhost:5000/auth/login',
            data=json.dumps({'email': user, 'password': password}),
            headers={'Content-type': 'application/json'})
        return json.loads(req.text)['accessToken']['token']

    def do_work(token, hash_ids, configs, organism: Fallback):
        resp = requests.post(
            'http://localhost:5000/filesystem/annotations/generate',
            data=json.dumps({
                'hashIds': hash_ids,
                'organism': {
                    'organism_name': organism.organism_name,
                    'synonym': organism.organism_synonym,
                    'tax_id': organism.organism_id
                },
                'annotationConfigs': configs
            }),
            headers={'Content-type': 'application/json', 'Authorization': f'Bearer {token}'})
        print(f'Got response back for files {hash_ids}, status code is {resp.status_code}')
        # if resp.status_code != 200:
        #     raise AnnotationError(resp.text)
        resp.close()

    print('Running reannotate command')

    token = get_token()
    curr_time = time.time()

    # NUM_PROCESSES = 2
    task_queue = Queue()
    running = {}

    files = db.session.query(
        Files.id,
        Files.hash_id,
        Files.annotation_configs,
        FallbackOrganism.organism_name,
        FallbackOrganism.organism_synonym,
        FallbackOrganism.organism_taxonomy_id
    ).join(
        FileContent,
        FileContent.id == Files.content_id
    ).join(
        FallbackOrganism,
        FallbackOrganism.id == Files.fallback_organism_id
    ).filter(
        and_(
            Files.mime_type.in_([FILE_MIME_TYPE_PDF, FILE_MIME_TYPE_ENRICHMENT_TABLE]),
            Files.deletion_date.is_(None),
            and_(
                Files.annotations.isnot(None),
                Files.annotations != '[]'
            )
        )
    )

    print(f'Total files: {files.count()}')

    for fid, hash, configs, organism, organism_synonym, organism_id in files:
        task_queue.put((
            fid, hash,
            json.loads(AnnotationConfigurations().dumps(configs)),
            Fallback(organism, organism_synonym, organism_id)
        ))

    print(f'Total tasks to do: {task_queue.qsize()}')

    while task_queue.qsize() > 0:
        if time.time() - curr_time > 180:
            token = get_token()
            curr_time = time.time()

        file_id, hashes, configs, organism = task_queue.get()
        do_work(token, [hashes], configs, organism)

    # while True:
    #     if time.time() - curr_time > 180:
    #         token = get_token()
    #         curr_time = time.time()

    #     file_id, hashes, configs, organism = task_queue.get()
    #     # this is preferred over multiprocessing.pool(...)
    #     # because it is guaranteed to be in a different process
    #     p = Process(target=do_work, args=(token, [hashes], configs, organism,))
    #     p.daemon = True
    #     p.start()
    #     # print(f'Process {p.pid} started...')
    #     running[p.pid] = (hashes, p)

    #     if len(running) == 3:
    #         while True:
    #             for k in list(running):
    #                 v = running[k]
    #                 if not v[1].is_alive():
    #                     # if v[1].exitcode:
    #                     #     raise AnnotationError(f'File with hash_id {v[0]} failed to annotate.')  # noqa
    #                     running.pop(k)

    #             if len(running) == 0:
    #                 break

    #     if task_queue.qsize() == 0:
    #         break

    # while True:
    #     for k in list(running):
    #         v = running[k]
    #         if not v[1].is_alive():
    #             # if v[1].exitcode:
    #             #     raise AnnotationError(f'File with hash_id {v[0]} failed to annotate.')
    #             running.pop(k)

    #     if len(running) == 0:
    #         break


def add_file(filename: str, description: str, user_id: int, parent_id: int, file_bstr: bytes):
    """Helper for adding a generic file to the database."""
    user = db.session.query(AppUser).filter(AppUser.id == user_id).one()
    parent = db.session.query(Files).filter(Files.id == parent_id).one()

    file_type_service = get_file_type_service()

    file = Files()
    file.filename = filename
    file.description = description
    file.user = user
    file.creator = user
    file.modifier = user
    file.public = False
    file.parent = parent
    file.upload_url = None

    # Create operation
    buffer = io.BytesIO(file_bstr)

    # Detect the mime type of the file
    mime_type = file_type_service.detect_mime_type(buffer)
    buffer.seek(0)  # Must rewind
    file.mime_type = mime_type

    # Figure out file size
    buffer.seek(0, io.SEEK_END)
    size = buffer.tell()
    buffer.seek(0)

    # Check max file size
    if size > 1024 * 1024 * 300:
        raise ValidationError(
            'Your file could not be processed because it is too large.')

    # Get the provider based on what we know now
    provider = file_type_service.get(file)

    # Check if the user can even upload this type of file
    if not provider.can_create():
        raise ValidationError(f"The provided file type is not accepted.")

    # Validate the content
    try:
        provider.validate_content(buffer)
        buffer.seek(0)  # Must rewind
    except ValueError as e:
        raise ValidationError(f"The provided file may be corrupt: {str(e)}")

    # Get the DOI
    file.doi = provider.extract_doi(buffer)
    buffer.seek(0)  # Must rewind

    # Save the file content if there's any
    if size:
        file.content_id = FileContent.get_or_create(buffer)
        buffer.seek(0)  # Must rewind

    # ========================================
    # Commit and filename conflict resolution
    # ========================================

    # Filenames could conflict, so we may need to generate a new filename
    # Trial 1: First attempt
    # Trial 2: Try adding (N+1) to the filename and try again
    # Trial 3: Try adding (N+1) to the filename and try again (in case of a race condition)
    # Trial 4: Give up
    # Trial 3 only does something if the transaction mode is in READ COMMITTED or worse (!)
    for trial in range(4):
        if 1 <= trial <= 2:  # Try adding (N+1)
            try:
                file.filename = file.generate_non_conflicting_filename()
            except ValueError:
                raise ValidationError(
                    'Filename conflicts with an existing file in the same folder.',
                    "filename")
        elif trial == 3:  # Give up
            raise ValidationError(
                'Filename conflicts with an existing file in the same folder.',
                "filename")

        try:
            db.session.begin_nested()
            db.session.add(file)
            db.session.commit()
            break
        except IntegrityError as e:
            # Warning: this could catch some other integrity error
            db.session.rollback()

    db.session.commit()


@app.cli.command('merge-maps')
@click.option('--user-id', '-u', required=True, type=int)
@click.option('--parent-id', '-p', required=True, type=int)
@click.option('--maps', '-m', multiple=True, type=int)
@click.option('--filename', '-f', required=True, type=str)
@click.option('--description', '-d', required=False, type=str)
def merge_maps(user_id, filename, description, parent_id, maps):
    """
    Merges two or more existing drawing tool maps into a single map.

    Args:

        user-id -- ID of the user who will own the new map

        parent-id -- ID of the folder the new map should be added to

        maps -- IDs of two or more maps to merge (e.g. -m 1 -m 2 -m 3)

        filename -- Name of the new map

        description -- Description of the new map (Optional)
    """
    if maps is None or len(maps) < 2:
        raise ValueError('Should give at least 2 maps to merge.')

    # TODO: Should make sure the given user has access to each of the given maps, and to the given
    # project. This would involve getting the projects of each of the maps. Until this is done we
    # should be careful to make sure we aren't creating any maps in the wrong place, or giving the
    # wrong person access.

    def generate_node_detail_hash(node):
        # Treat notes/links/maps as unique for now
        if node['label'] == 'note' or node['label'] == 'link' or node['label'] == 'map':
            return hashlib.sha256(bytes(str(uuid.uuid4()), 'utf-8')).hexdigest()
        str_to_hash = (node['label'] + '_' + node['display_name']).lower()
        return hashlib.sha256(bytes(str_to_hash, 'utf-8')).hexdigest()

    def get_min_max_x_y_of_maps(maps):
        min_max_x_y_map = {}

        for m in maps:
            min_x = math.inf
            min_y = math.inf
            max_x = -1 * math.inf
            max_y = -1 * math.inf
            for node in m['nodes']:
                x = node['data']['x']
                y = node['data']['y']
                height = node['data'].get('height', 25)
                width = node['data'].get('width', 25)

                if x - (width / 2) < min_x:
                    min_x = x - (width / 2)
                if x + (width / 2) > max_x:
                    max_x = x + (width / 2)
                if y - (height / 2) < min_y:
                    min_y = y - (height / 2)
                if y + (height / 2) > max_y:
                    max_y = y + (height / 2)

            min_max_x_y_map[m['name']] = [[min_x, min_y], [max_x, max_y]]
        return min_max_x_y_map

    def get_max_width_and_height_of_maps(min_max_x_y_map):
        max_width = 0
        max_height = 0

        for min_max_x_y in min_max_x_y_map.values():
            min_x, min_y = min_max_x_y[0]
            max_x, max_y = min_max_x_y[1]

            if max_x - min_x > max_width:
                max_width = max_x - min_x
            if max_y - min_y > max_height:
                max_height = max_y - min_y

        return max_width, max_height

    def combine_maps(maps, sector_width, sector_height, min_max_x_y_map):
        combined_nodes = []
        combined_edges = []

        map_dict = {}

        for m in maps:
            map_dict[m['name']] = {
                'nodes': m['nodes'],
                'edges': m['edges']
            }

        map_origin_dict = {}

        y_multiplier = 0
        for i, m in enumerate(map_dict.keys()):
            # Alternate sides of the x-axis every map. E.g., first map is left of the "true" origin,
            # second map right, third left, etc...
            x_multiplier = 1 if (i + 1) % 2 == 0 else -1

            new_origin = [
                x_multiplier * math.ceil(sector_width / 2),
                y_multiplier * math.ceil(sector_height),
            ]
            map_origin_dict[m] = new_origin

            if (i + 1) % 2 == 0:
                # We want two columns of maps, so increase the y value every third map
                y_multiplier += 1

        for m in map_dict:
            new_origin = map_origin_dict[m]
            min_x, min_y = min_max_x_y_map[m][0]
            max_x, max_y = min_max_x_y_map[m][1]
            center_of_map = [(max_x - min_x) / 2, (max_y - min_y) / 2]
            for node in map_dict[m]['nodes']:
                # First, translate the node as if 0, 0 were the center of the map. This normalizes
                # the positions of all maps. Then, translate the node according to the new origin
                # we calculated earlier.
                node['data']['x'] = node['data']['x'] + (-1 * center_of_map[0]) + new_origin[0]
                node['data']['y'] = node['data']['y'] + (-1 * center_of_map[1]) + new_origin[1]
                combined_nodes.append(node)
            for edge in map_dict[m]['edges']:
                combined_edges.append(edge)

        return {
            'nodes': combined_nodes,
            'edges': combined_edges,
        }

    def merge_maps(maps):
        min_max_x_y_map = get_min_max_x_y_of_maps(maps)
        sector_width, sector_height = get_max_width_and_height_of_maps(min_max_x_y_map)

        # Add a slight horizontal/vertical margin between maps
        sector_width += 500
        sector_height += 1000

        combined_map = combine_maps(maps, sector_width, sector_height, min_max_x_y_map)

        # "node hash" here means the "hash" property of the node objects
        node_detail_hash_to_node_hash_map = {}
        old_hash_to_new_hash_map = {}
        merge_nodes = set()
        hash_to_node_map = {}
        for node in combined_map['nodes']:
            node_hash = node['hash']

            node_detail_hash = generate_node_detail_hash(node)
            hash_to_node_map[node_hash] = node
            # If this is the first time we've encountered this node detail hash,
            # treat the node as the "source of truth" for the merge
            if node_detail_hash not in node_detail_hash_to_node_hash_map:
                node_detail_hash_to_node_hash_map[node_detail_hash] = node_hash
            # If we have seen this node detail hash, map the duplicate node to the detail hash
            else:
                new_hash = node_detail_hash_to_node_hash_map[node_detail_hash]
                merge_nodes.add(new_hash)
                old_hash_to_new_hash_map[node_hash] = new_hash

        # Replace merged nodes locations with the center of the network. May uncomment this on a
        # case-by-case basis.
        # network_center_y = (
        #     ((math.floor((len(maps) - 1) / 2) + 1) * (sector_height / 2)) + (sector_height / 2)
        # ) / 2
        # for i, merge_node_hash in enumerate(merge_nodes):
        #     x_multiplier = 1 if (i + 1) % 2 == 0 else -1
        #     y_modifier = i * 50
        #     hash_to_node_map[merge_node_hash]['data']['x'] = 200 * x_multiplier
        #     hash_to_node_map[merge_node_hash]['data']['y'] = network_center_y + y_modifier

        edges = []
        for edge in combined_map['edges']:
            edge_copy = copy.deepcopy(edge)
            source = edge['from']
            target = edge['to']

            # If source is a duplicate node, replace it with the "true" node
            if source in old_hash_to_new_hash_map:
                edge_copy['from'] = old_hash_to_new_hash_map[source]
            # If target is a duplicate node, replace it with the "true" node
            if target in old_hash_to_new_hash_map:
                edge_copy['to'] = old_hash_to_new_hash_map[target]

            edges.append(edge_copy)

        nodes = []
        for node in combined_map['nodes']:
            if node['hash'] not in old_hash_to_new_hash_map:
                nodes.append(node)

        return {
            'nodes': nodes,
            'edges': edges
        }

    raw_map_data = [
        [json.loads(raw_data[0]), raw_data[1]]
        for raw_data in db.session.query(
            FileContent.raw_file,
            Files.filename
        ).join(
            Files,
            and_(
                Files.content_id == FileContent.id,
                Files.id.in_(maps)
            )
        ).all()
    ]
    map_data = [
        {
            'name': filename,
            'nodes': file_data['nodes'],
            'edges': file_data['edges']
        } for file_data, filename in raw_map_data
    ]

    add_file(
        filename,
        description,
        user_id,
        parent_id,
        json.dumps(merge_maps(map_data)).encode('utf-8')
    )


@app.cli.command('generate-plotly-sankey-from-lifelike')
@click.option('--sankey-file-id', '-s', required=True, type=int)
@click.option('--user-id', '-u', required=True, type=int)
@click.option('--parent-id', '-p', required=True, type=int)
def generate_plotly_from_lifelike_sankey(
    sankey_file_id,
    user_id,
    parent_id,
):
    """
    Generates a Plotly compatible JSON file from a Lifelike sankey file.

    Args:

        sankey-file-id -- ID of the user who will own the new map

        user-id -- ID of the user who will own the new map

        parent-id -- ID of the folder the new map should be added to
    """

    sankey_file = db.session.query(
        FileContent.raw_file,
    ).join(
        Files,
        and_(
            Files.content_id == FileContent.id,
            Files.id == sankey_file_id
        )
    ).one()

    sankey_data = json.loads(sankey_file[0].decode('utf-8'))

    traces = set()
    node_ids_in_traces = {}
    link_idx_in_traces = {}
    for tn in sankey_data['graph']['trace_networks']:
        tn_name = tn.get('description', tn.get('name', 'Unknown'))
        traces.add(tn_name)
        node_ids_in_traces[tn_name] = set()
        link_idx_in_traces[tn_name] = set()
        for trace in tn['traces']:
            for path in trace['node_paths']:
                node_ids_in_traces[tn_name].update(node_id for node_id in path)
            link_idx_in_traces[tn_name].update(trace['edges'])

    nodes_in_traces = {}
    for node in sankey_data['nodes']:
        db_label = node.get('type', 'Unknown')
        color = ANNOTATION_STYLES_DICT.get(db_label.lower(), '#000000')['color']
        plotly_node = {
            'id': node['id'],
            'label': node.get('label', node.get('displayName', 'Unknown')),
            'databaseLabel': db_label,
            'font': {
                'color': color,
            },
            'color': {
                'background': '#FFFFFF',
                'border': color,
                'hover': {
                    'background': '#FFFFFF',
                    'border': color,
                },
                'highlight': {
                    'background': '#FFFFFF',
                    'border': color,
                }
            }
        }
        for trace, nodes_in_trace in node_ids_in_traces.items():
            if node['id'] in nodes_in_trace:
                if trace in nodes_in_traces:
                    nodes_in_traces[trace].append(plotly_node)
                else:
                    nodes_in_traces[trace] = [plotly_node]

    links_in_traces = {}
    for trace, link_indexes in link_idx_in_traces.items():
        links_in_traces[trace] = []
        for idx in link_indexes:
            link = sankey_data['links'][idx]
            plotly_link = {
                'id': str(uuid.uuid4()),
                'from': link['source'],
                'to': link['target'],
                'label': link.get('label', link.get('description', 'Unknown')),
                'color': {
                    'color': '#0c8caa'
                },
                'arrows': 'to'
            }
            links_in_traces[trace].append(plotly_link)

    for trace in traces:
        nodes = nodes_in_traces[trace]
        links = links_in_traces[trace]

        add_file(
            f"{'_'.join(trace.replace('/', '').split(' '))}.json",
            '',
            user_id,
            parent_id,
            json.dumps({'nodes': nodes, 'edges': links}).encode('utf-8')
        )


@app.cli.command('find-broken-map-links')
def find_broken_map_links():
    print('Starting find_broken_map_links')
    all_maps = db.session.query(
        Files.id,
        FileContent.raw_file,
    ).join(
        Files,
        and_(
            Files.content_id == FileContent.id,
            Files.mime_type == FILE_MIME_TYPE_MAP
        )
    ).yield_per(100)

    print('Got all_maps results...')

    new_link_re = r'^\/projects\/(?:[^\/]+)\/[^\/]+\/([a-zA-Z0-9-]+)'
    hash_id_to_file_list_pairs = dict()

    def add_links(potential_links: List[str], files_id: int):
        for link in potential_links:
            link_search = re.search(new_link_re, link)
            if link_search is not None:
                hash_id = link_search.group(1)
                if hash_id in hash_id_to_file_list_pairs:
                    if files_id in hash_id_to_file_list_pairs[hash_id]:
                        hash_id_to_file_list_pairs[hash_id][files_id].append(link)
                    else:
                        hash_id_to_file_list_pairs[hash_id][files_id] = [link]
                else:
                    hash_id_to_file_list_pairs[hash_id] = {files_id: [link]}

    for files_id, raw_file in all_maps:
        zip_file = zipfile.ZipFile(io.BytesIO(raw_file))
        map_json = json.loads(zip_file.read('graph.json'))

        for node in map_json['nodes']:
            potential_links = [source['url'] for source in node['data'].get('sources', [])]
            add_links(potential_links, files_id)

        for edge in map_json['edges']:
            if 'data' in edge:
                potential_links = [source['url'] for source in edge['data'].get('sources', [])]
                add_links(potential_links, files_id)

    print('Added potential links...')

    files_that_exist = db.session.query(
        Files.hash_id,
    ).filter(
        Files.hash_id.in_([hash_id for hash_id in hash_id_to_file_list_pairs.keys()])
    ).yield_per(100)

    print('Got files_that_exist results...')

    for hash_id, in files_that_exist:
        hash_id_to_file_list_pairs.pop(hash_id)

    print('Removed files that exist from hash_id_to_file_list_pairs...')

    with open('hash_id_list.txt', 'w') as hash_id_list_outfile:
        for hash_id in hash_id_to_file_list_pairs.keys():
            hash_id_list_outfile.write(f'{hash_id}\n')

    with open('file_ids.csv', 'w') as file_id_outfile:
        file_id_outfile.write('link\thash_id\tfile_id')
        for hash_id, file_to_links_map in hash_id_to_file_list_pairs.items():
            for file_id, link_list in file_to_links_map.items():
                for link in link_list:
                    file_id_outfile.write(f'{link}\t{hash_id}\t{file_id}\n')

    print('Done.')


@app.cli.command('fix-broken-map-links')
def fix_broken_map_links():
    # NOTE: These collections will need to be changed if this issue ever happens again!

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

    raw_maps_to_fix = db.session.query(
        FileContent.id,
        FileContent.raw_file,
    ).join(
        Files,
        and_(
            Files.id.in_(FILE_IDS),
            Files.mime_type == FILE_MIME_TYPE_MAP,
            Files.content_id == FileContent.id,
        )
    ).yield_per(100)

    new_link_re = r'^\/projects\/(?:[^\/]+)\/[^\/]+\/([a-zA-Z0-9-]+)'
    need_to_update = []
    for fcid, raw_file in raw_maps_to_fix:
        print(f'Replacing links in file #{fcid}')
        zip_file = zipfile.ZipFile(io.BytesIO(raw_file))
        map_json = json.loads(zip_file.read('graph.json'))

        for node in map_json['nodes']:
            for source in node['data'].get('sources', []):
                link_search = re.search(new_link_re, source['url'])
                if link_search is not None:
                    hash_id = link_search.group(1)
                    if hash_id in HASH_CONVERSION_MAP:
                        print(
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
                            print(
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
        db.session.bulk_update_mappings(FileContent, need_to_update)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
