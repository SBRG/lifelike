"""Fix/Upgrade project data

Revision ID: 1c3ac93bf8e7
Revises: 290f9d53c7f2
Create Date: 2020-09-14 16:11:19.709898

"""
import copy
import json
import uuid
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy_utils.types import TSVectorType


# revision identifiers, used by Alembic.
revision = '1c3ac93bf8e7'
down_revision = '290f9d53c7f2'
branch_labels = None
depends_on = None

t_app_user = sa.Table(
    'appuser',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('username', sa.String(64), index=True, unique=True),
    sa.Column('email', sa.String(120), index=True, unique=True),
    sa.Column('first_name', sa.String(120), nullable=False),
    sa.Column('last_name', sa.String(120), nullable=False),
)

t_files_content = sa.Table(
    'files_content',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
    sa.Column('raw_file', sa.LargeBinary, nullable=True),
    sa.Column('checksum_sha256', sa.Binary(32), nullable=False, index=True, unique=True),
    sa.Column('creation_date', sa.DateTime, nullable=False, default=sa.func.now()),
)

t_directory = sa.Table(
    'directory',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
    sa.Column('name', sa.String(200), nullable=False),
    sa.Column('directory_parent_id', sa.Integer, sa.ForeignKey('directory.id'), nullable=True),
    sa.Column('projects_id', sa.Integer, sa.ForeignKey('projects.id'), nullable=False),
    sa.Column('user_id', sa.Integer, sa.ForeignKey('appuser.id'), nullable=False)
)

t_files = sa.Table(
    'files',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
    sa.Column('file_id', sa.String(36), unique=True, nullable=False),
    sa.Column('filename', sa.String(60)),
    sa.Column('description', sa.String(2048), nullable=True),
    sa.Column('content_id', sa.Integer, sa.ForeignKey(
        'files_content.id', ondelete='CASCADE'), nullable=False),
    sa.Column('user_id', sa.Integer, sa.ForeignKey('appuser.id'), nullable=False),
    sa.Column('creation_date', sa.TIMESTAMP(timezone=True)),
    sa.Column('modified_date', sa.TIMESTAMP(timezone=True)),
    sa.Column('annotations', postgresql.JSONB, nullable=False),
    sa.Column('annotations_date', sa.TIMESTAMP, nullable=True),
    sa.Column('project', sa.Integer, sa.ForeignKey('projects.id'), nullable=False),
    sa.Column('custom_annotations', postgresql.JSONB, nullable=False),
    sa.Column('dir_id', sa.Integer, sa.ForeignKey('directory.id'), nullable=False),
    sa.Column('doi', sa.String(1024), nullable=True),
    sa.Column('upload_url', sa.String(2048), nullable=True),
    sa.Column('excluded_annotations', postgresql.JSONB, nullable=False),
)

t_project = sa.Table(
    'project',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('label', sa.String(250), nullable=False),
    sa.Column('description', sa.Text),
    sa.Column('modified_date', sa.DateTime),
    sa.Column('graph', sa.JSON),
    sa.Column('author', sa.String(240), nullable=False),
    sa.Column('public', sa.Boolean(), default=False),
    sa.Column('user_id', sa.Integer, sa.ForeignKey(t_app_user.c.id)),
    sa.Column('dir_id', sa.Integer, sa.ForeignKey(t_directory.c.id)),
    sa.Column('hash_id', sa.String(50), unique=True),
    sa.Column('search_vector', TSVectorType('label'))
)

t_project_version = sa.Table(
    'project_version',
    sa.MetaData(),
    sa.Column('dir_id', sa.Integer, sa.ForeignKey(t_directory.c.id)),
)

t_projects = sa.Table(
    'projects',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
    sa.Column('project_name', sa.String(250), unique=True, nullable=False),
    sa.Column('description', sa.Text),
    sa.Column('creation_date', sa.DateTime, nullable=False, default=sa.func.now()),
    sa.Column('users', sa.ARRAY(sa.Integer), nullable=False)
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


def get_src_type(source):
    return source.split('/')[2]


def get_src_hash_id(source):
    return source.split('/')[3]


def get_projects(conn, dir_id):
    """ Return the `Projects name and id` to which
    the asset is located under """
    return conn.execute(
        sa.select(
            [t_projects.c.id, t_projects.c.project_name]
        ).select_from(sa.join(
            t_projects,
            t_directory,
            t_projects.c.id == t_directory.c.projects_id
        )).where(t_directory.c.id == dir_id)
    ).fetchone()


def is_new_format(source):
    """ Checks if node/edge data already contains new format """
    return source.find('/projects/') != -1 or source.find('doi') != 1


def map_source_conversion(source, projects_name):
    if is_new_format(source):
        return source
    hash_id = get_src_hash_id(source)
    link = f'/projects/{projects_name}/maps/{hash_id}/edit'
    return link


def map_sources_conversion(source, projects_name):
    source_url = source
    if type(source_url) is dict:
        source_url = source['url']
    if is_new_format(source_url):
        if source.get('domain'):
            return source
    hash_id = get_src_hash_id(source_url)
    link = f'/projects/{projects_name}/maps/{hash_id}/edit'
    return {'type': '', 'domain': 'File Source', 'url': link}


# already generated pdf copies
new_pdf_copies = {}


def pdf_source_conversion(conn, source, projects_id, projects_name, user_id, dir_id, new_structure=False):
    """
    Old Format
    /dt/pdf/16e703d8-fdb4-483e-93cf-b63b01a65d65/1/508.72679250633314/508.9869840578061/545.4304343746924/497.523753676678

    New Format
    /projects/Christine-Personal-Project/files/90d450a9-ac99-4c49-b074-badfcd161bc6#page=1&coords=49.5,603.7295,67.075,613.2295
    """
    source_url = source
    if type(source) is dict:
        source_url = source['url']

    if is_new_format(source_url) and type(source) is not dict:
        return source

    if is_new_format(source_url) and type(source) is dict:
        if source.get('domain'):
            return source

    hash_id = get_src_hash_id(source_url)
    files_query = conn.execute(
        sa.select(
            [t_files]
        ).where(
            t_files.c.file_id == hash_id
        )
    ).fetchone()
    if files_query is not None:
        query_user_id = files_query[5]
    else:
        query_user_id = None

    src_split = source_url.split('/')
    coordinates = f'coords={",".join(src_split[5:])}'
    try:
        page = src_split[4]
    except Exception:
        # This is a staging data edge case, so we just ignore it
        print(f'Failed for {source_url}')

    # Check if the map owner is the same as the PDF owner
    if user_id == query_user_id:
        new_source = f'/projects/{projects_name}/files/{hash_id}#page={page}&{coordinates}'
        if new_structure:
            return {'type': '', 'domain': 'File Source', 'url': new_source}
        else:
            return new_source
    elif query_user_id is None:
        # query_user_id can be none, which means no file exists so we just return the source
        return source
    else:
        # we make a copy of the PDF for the user and add it to their personal projects
        # store pdf copies made so we don't make more copies than we need
        unique_id = str(files_query[4]) + str(user_id)
        if new_pdf_copies.get(unique_id):
            if new_structure:
                formatted = {'type': '', 'domain': 'File Source', 'url': new_pdf_copies[unique_id]}
                return formatted
            else:
                return new_pdf_copies[unique_id]
        else:
            random_file_id = str(uuid.uuid4())
            conn.execute(t_files.insert().values(
                file_id=random_file_id,
                filename=files_query[2],
                description=files_query[3],
                content_id=files_query[4],
                user_id=user_id,
                creation_date=files_query[6],
                modified_date=files_query[7],
                annotations=files_query[8],
                annotations_date=files_query[9],
                project=projects_id,
                custom_annotations=files_query[11],
                dir_id=dir_id,
                doi=files_query[13],
                upload_url=files_query[14],
                excluded_annotations=files_query[15],
            ))
            new_source = f'/projects/{projects_name}/files/{random_file_id}#page={page}&{coordinates}'
            new_pdf_copies[unique_id] = new_source
            if new_structure:
                formatted = {'type': '', 'domain': 'File Source', 'url': new_source}
                return formatted
            else:
                return new_source


def convert_source(conn, component, projects_id, projects_name, user_id, dir_id):
    """ Perform conversions if a map source is found """
    component_copy = copy.deepcopy(component)
    data = component_copy.get('data')
    if data is None:
        return component
    source = data.get('source')
    sources = data.get('sources')

    if source:
        if get_src_type(source) == 'map':
            data['source'] = map_source_conversion(source, projects_name)
        else:
            pdf_source_conversion(conn, source, projects_id, projects_name, user_id, dir_id)
    if sources:
        data['sources'] = [
            map_sources_conversion(s, projects_name)
            if get_src_type(s['url']) == 'map'
            else pdf_source_conversion(conn, s, projects_id, projects_name, user_id, dir_id, True)
            for s in sources
        ]
    return component_copy


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    project = conn.execute(sa.select([t_project])).fetchall()
    for proj_id, _, _, _, graph, _, _, user_id, dir_id, _, _ in project:
        nodes = graph['nodes']
        edges = graph['edges']
        projects_id, projects_name = get_projects(conn, dir_id)
        nodes = [convert_source(conn, node, projects_id, projects_name, user_id, dir_id) for node in nodes]
        edges = [convert_source(conn, edge, projects_id, projects_name, user_id, dir_id) for edge in edges]
        graph['nodes'] = nodes
        graph['edges'] = edges
        query = t_project.update().where(t_project.c.id == proj_id).values(graph=graph)
        conn.execute(query)


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
