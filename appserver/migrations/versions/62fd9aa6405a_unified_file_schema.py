"""unified file schema

Revision ID: 62fd9aa6405a
Revises: 559b17bb1045
Create Date: 2020-09-22 22:23:44.017103

"""
import hashlib
import itertools
import json
import logging
import os
import random
from datetime import datetime

import sqlalchemy as sa
import timeflake
from alembic import op
# revision identifiers, used by Alembic.
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import NoResultFound

logger = logging.getLogger("alembic.runtime.migration." + __name__)

revision = '62fd9aa6405a'
down_revision = '559b17bb1045'
branch_labels = None
depends_on = None

# Customize these thresholds based on available memory to buffer query results
CONTENT_QUERY_BATCH_SIZE = 25
DEFAULT_QUERY_BATCH_SIZE = 200

t_app_user = sa.Table(
    'appuser',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('hash_id'),
    sa.Column('username'),
    sa.Column('email'),
    sa.Column('first_name'),
    sa.Column('last_name'),
)

t_project = sa.Table(
    'projects',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('hash_id'),
    sa.Column('name'),
    sa.Column('description'),
    sa.Column('root_id'),
    sa.Column('creation_date'),
    sa.Column('modified_date'),
)

t_map = sa.Table(
    'project',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('label'),
    sa.Column('description'),
    sa.Column('graph'),
    sa.Column('public'),
    sa.Column('user_id'),
    sa.Column('dir_id'),
    sa.Column('hash_id'),
    sa.Column('creation_date'),
    sa.Column('modified_date'),
)

t_map_version = sa.Table(
    'project_version',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('label'),
    sa.Column('description'),
    sa.Column('graph'),
    sa.Column('public'),
    sa.Column('user_id'),
    sa.Column('dir_id'),
    sa.Column('project_id'),
    sa.Column('creation_date'),
    sa.Column('modified_date'),
)

t_map_backup = sa.Table(
    'project_backup',
    sa.MetaData(),
    sa.Column('project_id', sa.Integer(), primary_key=True),
    sa.Column('label'),
    sa.Column('description'),
    sa.Column('graph'),
    sa.Column('public'),
    sa.Column('user_id'),
    sa.Column('hash_id'),
    sa.Column('creation_date'),
    sa.Column('modified_date'),
)

t_file = sa.Table(
    'files',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('hash_id'),
    sa.Column('parent_id'),
    sa.Column('mime_type'),
    sa.Column('filename'),
    sa.Column('description'),
    sa.Column('content_id'),
    sa.Column('dir_id'),
    sa.Column('user_id'),
    sa.Column('public', default=False),
    sa.Column('creation_date'),
    sa.Column('modified_date'),
)

t_file_content = sa.Table(
    'files_content',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('raw_file'),
    sa.Column('checksum_sha256', sa.Binary(32)),
    sa.Column('creation_date'),
)

t_file_version = sa.Table(
    'file_version',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('hash_id'),
    sa.Column('file_id'),
    sa.Column('message'),
    sa.Column('content_id'),
    sa.Column('user_id'),
    sa.Column('message'),
    sa.Column('creation_date'),
    sa.Column('modified_date'),
)

t_file_backup = sa.Table(
    'file_backup',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('hash_id'),
    sa.Column('file_id'),
    sa.Column('raw_value', sa.LargeBinary()),
    sa.Column('user_id'),
    sa.Column('message'),
    sa.Column('creation_date'),
    sa.Column('modified_date'),
)

t_directory = sa.Table(
    'directory',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('name'),
    sa.Column('directory_parent_id'),
    sa.Column('projects_id'),
    sa.Column('user_id'),
    sa.Column('creation_date'),
    sa.Column('modified_date'),
)

t_app_role = sa.Table(
    'app_role',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('name'),
)


def create_hash_id():
    return timeflake.random().base62


def iter_query(query, *, batch_size):
    """
    Fetch query in batches to reduce memory usage.
    """
    results = iter(query.yield_per(batch_size))

    while True:
        batch = list(itertools.islice(results, batch_size))

        if not batch:
            return

        for row in batch:
            yield row


def get_or_create_content_id(session, data, creation_date):
    """
    Creates a row in the file_content table if there isn't a row for the given
    data yet, otherwise return the existing row ID.
    """
    checksum_sha256 = hashlib.sha256(data).digest()

    try:
        return session.query(t_file_content.c.id) \
            .filter(t_file_content.c.checksum_sha256 == checksum_sha256) \
            .one()[0]
    except NoResultFound:
        return session.execute(t_file_content.insert().values(
            raw_file=data,
            checksum_sha256=checksum_sha256,
            creation_date=creation_date,
        )).inserted_primary_key[0]


def upgrade():
    session = Session(op.get_bind())

    if os.environ.get('USE_UNIFIED_FILE_SCHEMA_MIGRATION_SAMPLE'):
        logger.info("Inserting sample data for testing the migration "
                    "(due to USE_UNIFIED_FILE_SCHEMA_MIGRATION_SAMPLE flag)...")
        insert_sample_data(session)

    # ========================================
    # Initial column changes
    # ========================================

    logger.info("Applying initial column changes...")

    # Map descriptions are a text field
    op.alter_column('files', 'description',
                    existing_type=sa.VARCHAR(length=2048),
                    type_=sa.Text(),
                    existing_nullable=True)

    # Directories have no content
    op.alter_column('files', 'content_id', existing_type=sa.Integer(), nullable=True)

    # Drop the project column
    op.drop_index('ix_files_project', table_name='files')
    op.drop_constraint('fk_files_project_projects', 'files', type_='foreignkey')
    op.drop_column('files', 'project')

    # Add parent_id column
    op.add_column('files', sa.Column('parent_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_files_parent_id'), 'files', ['parent_id'], unique=False)
    op.create_foreign_key(op.f('fk_files_parent_id_files'), 'files', 'files', ['parent_id'], ['id'])

    # Add public column to the files table
    op.add_column('files', sa.Column('public', sa.Boolean(), nullable=False, server_default='False'))
    op.alter_column('files', 'public', existing_type=sa.Boolean(), nullable=False, server_default=None)

    # Add new date tracking fields
    op.add_column('files', sa.Column('deletion_date', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('files', sa.Column('recycling_date', sa.TIMESTAMP(timezone=True), nullable=True))

    # Add new user ID fields
    op.add_column('files', sa.Column('creator_id', sa.Integer(), nullable=True))
    op.add_column('files', sa.Column('modifier_id', sa.Integer(), nullable=True))
    op.add_column('files', sa.Column('deleter_id', sa.Integer(), nullable=True))
    op.add_column('files', sa.Column('recycler_id', sa.Integer(), nullable=True))

    op.create_foreign_key(op.f('fk_files_creator_id_appuser'), 'files', 'appuser', ['creator_id'], ['id'])
    op.create_foreign_key(op.f('fk_files_modifier_id_appuser'), 'files', 'appuser', ['modifier_id'], ['id'])
    op.create_foreign_key(op.f('fk_files_deleter_id_appuser'), 'files', 'appuser', ['deleter_id'], ['id'])
    op.create_foreign_key(op.f('fk_files_recycler_id_appuser'), 'files', 'appuser', ['recycler_id'], ['id'])

    # file_id is confusing when tables refer to this table via file_id
    op.drop_constraint('uq_files_file_id', 'files', type_='unique')
    op.alter_column('files', 'file_id', new_column_name='hash_id')
    op.create_unique_constraint(op.f('uq_files_hash_id'), 'files', ['hash_id'])

    # project_name -> name
    op.drop_constraint('uq_projects_project_name', 'projects', type_='unique')
    op.alter_column('projects', 'project_name', new_column_name='name')
    op.create_unique_constraint(op.f('uq_projects_name'), 'projects', ['name'])

    # Remove useless 'users' column on projects
    op.drop_column('projects', 'users')

    # Add root_id column to the projects table
    op.add_column('projects', sa.Column('root_id', sa.Integer(), nullable=True))  # Remove nullable later
    op.create_index(op.f('ix_projects_root_id'), 'projects', ['root_id'], unique=False)
    op.create_foreign_key(op.f('fk_projects_root_id_files'), 'projects', 'files', ['root_id'], ['id'])

    # Add soft deletes and lifecycle columns to the projects table
    op.add_column('projects', sa.Column('creator_id', sa.Integer(), nullable=True))
    op.add_column('projects', sa.Column('deleter_id', sa.Integer(), nullable=True))
    op.add_column('projects', sa.Column('deletion_date', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('projects', sa.Column('modifier_id', sa.Integer(), nullable=True))
    op.create_foreign_key(op.f('fk_projects_modifier_id_appuser'), 'projects', 'appuser', ['modifier_id'], ['id'])
    op.create_foreign_key(op.f('fk_projects_creator_id_appuser'), 'projects', 'appuser', ['creator_id'], ['id'])
    op.create_foreign_key(op.f('fk_projects_deleter_id_appuser'), 'projects', 'appuser', ['deleter_id'], ['id'])

    # ========================================
    # Add hash IDs to users
    # ========================================

    logger.info("Adding hash IDs to users...")

    op.add_column('appuser', sa.Column('hash_id', sa.String(length=36), nullable=True))
    op.create_unique_constraint(op.f('uq_appuser_hash_id'), 'appuser', ['hash_id'])

    for user in iter_query(session.query(t_app_user), batch_size=DEFAULT_QUERY_BATCH_SIZE):
        user = user._asdict()
        session.execute(t_app_user.update().values(
            hash_id=create_hash_id()
        ).where(t_app_user.c.id == user['id']))

    # Make nullable=False
    op.alter_column('appuser', 'hash_id', existing_type=sa.String(length=36), nullable=False)

    # ========================================
    # Add hash IDs to projects
    # ========================================

    logger.info("Adding hash IDs to projects...")

    op.add_column('projects', sa.Column('hash_id', sa.String(length=36), nullable=True))
    op.create_unique_constraint(op.f('uq_projects_hash_id'), 'projects', ['hash_id'])

    for project in iter_query(session.query(t_project), batch_size=DEFAULT_QUERY_BATCH_SIZE):
        project = project._asdict()
        session.execute(t_project.update().values(
            hash_id=create_hash_id()
        ).where(t_project.c.id == project['id']))

    # Make nullable=False
    op.alter_column('projects', 'hash_id', existing_type=sa.String(length=36), nullable=False)

    # ========================================
    # Add mime type column
    # ========================================

    logger.info("Adding mime_type column to the files table...")
    op.add_column('files', sa.Column('mime_type', sa.String(length=127), nullable=True,
                                     server_default='application/pdf'))
    op.alter_column('files', 'mime_type', existing_type=sa.String(length=127), nullable=False,
                    server_default=None)

    # Make enrichment tables the enrichment table type
    session.execute(t_file.update().values(
        mime_type='vnd.lifelike.document/enrichment-table'
    ).where(t_file.c.filename.ilike('%.enrichment')))

    # ========================================
    # Copy over maps
    # ========================================

    old_map_to_new_map_id = {}

    logger.info("Copying maps to the files table...")
    for map in iter_query(session.query(t_map, t_directory.c.projects_id) \
                                  .join(t_directory, t_directory.c.id == t_map.c.dir_id),
                          batch_size=CONTENT_QUERY_BATCH_SIZE):
        map = map._asdict()

        content_id = get_or_create_content_id(session,
                                              json.dumps(map['graph']).encode('utf-8'),
                                              map['creation_date'])

        new_id = session.execute(t_file.insert().values(
            hash_id=map['hash_id'],
            parent_id=None,
            mime_type='vnd.lifelike.document/map',
            filename=map['label'],
            description=map['description'],
            content_id=content_id,
            user_id=map['user_id'],
            dir_id=map['dir_id'],
            public=map['public'],
            creation_date=map['creation_date'],
            modified_date=map['modified_date'],
        )).inserted_primary_key[0]

        old_map_to_new_map_id[map['id']] = new_id

        logger.debug("-> Project(id=%s) copied to File(id=%s)", map['id'], new_id)

    # ========================================
    # Copy directories to the file table and update project root_dir
    # ========================================

    # New rows won't have this column and we are going to remove it at the end
    op.alter_column('files', 'dir_id', existing_type=sa.Integer(), nullable=True)

    old_dir_to_new_dir_id = {}

    logger.info("Migrating directories to the files table...")
    for dir in iter_query(session.query(t_directory), batch_size=DEFAULT_QUERY_BATCH_SIZE):
        dir = dir._asdict()

        new_id = session.execute(t_file.insert().values(
            hash_id=create_hash_id(),
            parent_id=None,
            mime_type='vnd.lifelike.filesystem/directory',
            filename=dir['name'],
            user_id=dir['user_id'],
            dir_id=dir['directory_parent_id'],
            creation_date=dir['creation_date'],
            modified_date=dir['modified_date'],
        )).inserted_primary_key[0]
        old_dir_to_new_dir_id[dir['id']] = new_id

        # Update the associated project
        if dir['directory_parent_id'] is None and dir['projects_id'] is not None:
            session.execute(t_project.update().values(
                root_id=new_id,
            ).where(t_project.c.id == dir['projects_id']))

        logger.debug("-> Directory(id=%s) copied to File(id=%s)", dir['id'], new_id)

    dummy_dir_owner_id = None  # The user ID to 'own' directories for projects without a root dir

    logger.info("Making sure all projects have a root directory...")
    for project in iter_query(session.query(t_project).filter(t_project.c.root_id.is_(None)),
                              batch_size=DEFAULT_QUERY_BATCH_SIZE):
        project = project._asdict()

        # Create dummy user
        if not dummy_dir_owner_id:
            dummy_dir_owner_id = session.execute(t_app_user.insert().values(
                hash_id=create_hash_id(),
                username='_migration_root_dir',
                email='migration_root_dir@migration.lifelike.bio',
                first_name='System',
                last_name='Lifelike'
            )).inserted_primary_key[0]
            logger.info("Created a dummy user (_migration_root_dir, #%s) to own the directories "
                        "of projects without a root directory", dummy_dir_owner_id)

        # Create the root directory
        dir_id = session.execute(t_file.insert().values(
            hash_id=create_hash_id(),
            parent_id=None,
            mime_type='vnd.lifelike.filesystem/directory',
            filename='/',
            user_id=dummy_dir_owner_id,
            dir_id=None,  # We can make it null now
            creation_date=project['creation_date'],
            modified_date=project['modified_date'],
        )).inserted_primary_key[0]

        # Update the associated project
        session.execute(t_project.update().values(
            root_id=dir_id,
        ).where(t_project.c.id == project['id']))

    # Make root ID non-nullable
    logger.info("Making the root_id column non-nullable...")
    op.alter_column('projects', 'root_id', existing_type=sa.Integer(), nullable=False)

    # ========================================
    # Set the file parent_id columns based on the to-be-removed (parent_)dir_id column
    # ========================================

    logger.info("Linking files to their parent directory..")
    for file in iter_query(session.query(t_file).filter(t_file.c.dir_id.isnot(None)),
                           batch_size=DEFAULT_QUERY_BATCH_SIZE):
        file = file._asdict()

        new_parent_id = old_dir_to_new_dir_id[file['dir_id']]

        session.execute(t_file.update().values(
            parent_id=new_parent_id
        ).where(t_file.c.id == file['id']))

        logger.debug("-> File(id=%s, dir_id=%s) updated with parent_id=%s", file['id'],
                     file['dir_id'], new_parent_id)

    op.drop_index('ix_files_dir_id', table_name='files')
    op.drop_constraint('fk_files_dir_id_directory', 'files', type_='foreignkey')
    op.drop_column('files', 'dir_id')

    # ========================================
    # Create file collaborator table
    # ========================================

    logger.info("Creating table 'file_collaborator_role'...")
    op.create_table('file_collaborator_role',
                    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
                    sa.Column('file_id', sa.Integer(), nullable=False),
                    sa.Column('collaborator_id', sa.Integer(), nullable=True),
                    sa.Column('collaborator_email', sa.String(length=254), nullable=True),
                    sa.Column('role_id', sa.Integer(), nullable=False),
                    sa.Column('owner_id', sa.Integer(), nullable=False),
                    sa.Column('creation_date', sa.TIMESTAMP(timezone=True), nullable=False),
                    sa.Column('modified_date', sa.TIMESTAMP(timezone=True), nullable=False),
                    sa.Column('deletion_date', sa.TIMESTAMP(timezone=True), nullable=True),
                    sa.Column('creator_id', sa.Integer(), nullable=True),
                    sa.Column('modifier_id', sa.Integer(), nullable=True),
                    sa.Column('deleter_id', sa.Integer(), nullable=True),
                    sa.ForeignKeyConstraint(['collaborator_id'], ['appuser.id'],
                                            name=op.f('fk_file_collaborator_role_collaborator_id_appuser')),
                    sa.ForeignKeyConstraint(['creator_id'], ['appuser.id'],
                                            name=op.f('fk_file_collaborator_role_creator_id_appuser')),
                    sa.ForeignKeyConstraint(['deleter_id'], ['appuser.id'],
                                            name=op.f('fk_file_collaborator_role_deleter_id_appuser')),
                    sa.ForeignKeyConstraint(['file_id'], ['files.id'],
                                            name=op.f('fk_file_collaborator_role_file_id_files')),
                    sa.ForeignKeyConstraint(['modifier_id'], ['appuser.id'],
                                            name=op.f('fk_file_collaborator_role_modifier_id_appuser')),
                    sa.ForeignKeyConstraint(['owner_id'], ['appuser.id'],
                                            name=op.f('fk_file_collaborator_role_owner_id_appuser')),
                    sa.ForeignKeyConstraint(['role_id'], ['app_role.id'],
                                            name=op.f('fk_file_collaborator_role_role_id_app_role')),
                    sa.PrimaryKeyConstraint('id', name=op.f('pk_file_collaborator_role')),
                    )
    op.create_index('uq_file_collaborator_role', 'file_collaborator_role',
                    ['file_id', 'collaborator_id', 'collaborator_email', 'role_id', 'owner_id'], unique=True,
                    postgresql_where=sa.text('deletion_date IS NULL'))
    op.create_index(op.f('ix_file_collaborator_role_collaborator_email'), 'file_collaborator_role',
                    ['collaborator_email'], unique=False)
    op.create_index(op.f('ix_file_collaborator_role_collaborator_id'), 'file_collaborator_role', ['collaborator_id'],
                    unique=False)
    op.create_index(op.f('ix_file_collaborator_role_file_id'), 'file_collaborator_role', ['file_id'], unique=False)
    op.create_index(op.f('ix_file_collaborator_role_role_id'), 'file_collaborator_role', ['role_id'], unique=False)

    # ========================================
    # Create new roles
    # ========================================

    logger.info("Creating new roles for files...")
    for name in ('file-read', 'file-write', 'file-comment'):
        logger.debug('-> %s', name)
        session.execute(t_app_role.insert().values(name=name))

    # ========================================
    # Create file version table
    # ========================================

    logger.info("Creating table 'file_version'...")
    op.create_table('file_version',
                    sa.Column('creation_date', sa.TIMESTAMP(timezone=True), nullable=False),
                    sa.Column('modified_date', sa.TIMESTAMP(timezone=True), nullable=False),
                    sa.Column('deletion_date', sa.TIMESTAMP(timezone=True), nullable=True),
                    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
                    sa.Column('hash_id', sa.String(length=36), nullable=True),
                    sa.Column('message', sa.Text(), nullable=True),
                    sa.Column('file_id', sa.Integer(), nullable=False),
                    sa.Column('content_id', sa.Integer(), nullable=False),
                    sa.Column('user_id', sa.Integer(), nullable=False),
                    sa.Column('creator_id', sa.Integer(), nullable=True),
                    sa.Column('modifier_id', sa.Integer(), nullable=True),
                    sa.Column('deleter_id', sa.Integer(), nullable=True),
                    sa.ForeignKeyConstraint(['file_id'], ['files.id'],
                                            name=op.f('fk_file_version_file_id_files')),
                    sa.ForeignKeyConstraint(['content_id'], ['files_content.id'],
                                            name=op.f('fk_file_version_content_id_files_content')),
                    sa.ForeignKeyConstraint(['creator_id'], ['appuser.id'],
                                            name=op.f('fk_file_version_creator_id_appuser')),
                    sa.ForeignKeyConstraint(['deleter_id'], ['appuser.id'],
                                            name=op.f('fk_file_version_deleter_id_appuser')),
                    sa.ForeignKeyConstraint(['modifier_id'], ['appuser.id'],
                                            name=op.f('fk_file_version_modifier_id_appuser')),
                    sa.ForeignKeyConstraint(['user_id'], ['appuser.id'], name=op.f('fk_file_version_user_id_appuser'),
                                            ondelete='CASCADE'),
                    sa.PrimaryKeyConstraint('id', name=op.f('pk_file_version'))
                    )
    op.create_index(op.f('ix_file_version_file_id'), 'file_version', ['file_id'], unique=False)
    op.create_index(op.f('ix_file_version_content_id'), 'file_version', ['content_id'], unique=False)
    op.create_index(op.f('ix_file_version_user_id'), 'file_version', ['user_id'], unique=False)
    op.create_unique_constraint(op.f('uq_file_version_hash_id'), 'file_version', ['hash_id'])

    # ========================================
    # Migrate map version table to the new file version table
    # ========================================

    logger.info("Migrating map versions to the new file version table...")
    for backup in iter_query(session.query(t_map_version), batch_size=CONTENT_QUERY_BATCH_SIZE):
        backup = backup._asdict()

        try:
            new_file_id = old_map_to_new_map_id[backup['project_id']]
        except KeyError:
            # Map was deleted
            continue

        content_id = get_or_create_content_id(session,
                                              json.dumps(backup['graph']).encode('utf-8'),
                                              backup['creation_date'])

        new_id = session.execute(t_file_version.insert().values(
            file_id=new_file_id,
            content_id=content_id,
            user_id=backup['user_id'],
            creation_date=backup['creation_date'],
            modified_date=backup['modified_date'],
        )).inserted_primary_key[0]

        logger.debug("-> ProjectVersion(id=%s, project_id=%s) copied "
                     "to FileVersion(id=%s, file_id=%s)",
                     backup['id'], backup['project_id'],
                     new_id, new_file_id)

    # ========================================
    # Create file backup table
    # ========================================

    op.create_table('file_backup',
                    sa.Column('creation_date', sa.TIMESTAMP(timezone=True), nullable=False),
                    sa.Column('modified_date', sa.TIMESTAMP(timezone=True), nullable=False),
                    sa.Column('deletion_date', sa.TIMESTAMP(timezone=True), nullable=True),
                    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
                    sa.Column('hash_id', sa.String(length=36), nullable=True),
                    sa.Column('file_id', sa.Integer(), nullable=False),
                    sa.Column('raw_value', sa.LargeBinary(), nullable=False),
                    sa.Column('user_id', sa.Integer(), nullable=False),
                    sa.Column('creator_id', sa.Integer(), nullable=True),
                    sa.Column('modifier_id', sa.Integer(), nullable=True),
                    sa.Column('deleter_id', sa.Integer(), nullable=True),
                    sa.ForeignKeyConstraint(['creator_id'], ['appuser.id'],
                                            name=op.f('fk_file_backup_creator_id_appuser')),
                    sa.ForeignKeyConstraint(['deleter_id'], ['appuser.id'],
                                            name=op.f('fk_file_backup_deleter_id_appuser')),
                    sa.ForeignKeyConstraint(['file_id'], ['files.id'], name=op.f('fk_file_backup_file_id_files')),
                    sa.ForeignKeyConstraint(['modifier_id'], ['appuser.id'],
                                            name=op.f('fk_file_backup_modifier_id_appuser')),
                    sa.ForeignKeyConstraint(['user_id'], ['appuser.id'], name=op.f('fk_file_backup_user_id_appuser'),
                                            ondelete='CASCADE'),
                    sa.PrimaryKeyConstraint('id', name=op.f('pk_file_backup'))
                    )
    op.create_index(op.f('ix_file_backup_file_id'), 'file_backup', ['file_id'], unique=False)
    op.create_index(op.f('ix_file_backup_user_id'), 'file_backup', ['user_id'], unique=False)
    op.create_unique_constraint(op.f('uq_file_backup_hash_id'), 'file_backup', ['hash_id'])

    # ========================================
    # Migrate map backup table to the new file backup table
    # ========================================

    logger.info("Migrating map backups to the new file backup table...")
    for backup in iter_query(session.query(t_map_backup), batch_size=CONTENT_QUERY_BATCH_SIZE):
        backup = backup._asdict()

        try:
            new_file_id = old_map_to_new_map_id[backup['project_id']]
        except KeyError:
            # Map was deleted
            continue

        new_id = session.execute(t_file_backup.insert().values(
            file_id=new_file_id,
            raw_value=json.dumps(backup['graph']).encode('utf-8'),
            user_id=backup['user_id'],
            creation_date=backup['creation_date'],
            modified_date=backup['modified_date'],
        )).inserted_primary_key[0]

        logger.debug("-> ProjectBackup(project_id=%s) copied "
                     "to FileBackup(id=%s, file_id=%s)",
                     backup['project_id'],
                     new_id, new_file_id)

    # ========================================
    # Remove tables
    # ========================================

    logger.info("Removing old tables...")
    op.drop_table('project_version')
    op.drop_table('project_backup')

    op.drop_index('ix_project_dir_id', table_name='project')
    op.drop_index('ix_project_search_vector', table_name='project')
    op.drop_index('ix_project_user_id', table_name='project')
    op.drop_table('project')

    op.drop_index('ix_directory_directory_parent_id', table_name='directory')
    op.drop_index('ix_directory_projects_id', table_name='directory')
    op.drop_index('ix_directory_user_id', table_name='directory')
    op.drop_table('directory')

    # ========================================
    # Make filenames unique
    # ========================================

    logger.info("Fixing duplicate filenames within the same folder...")

    # The purpose of the code below is to find duplicate filenames within the same
    # folder and then apply a filename suffix (like (1) or (2)) to the duplicate files.
    # The code below runs completely in the database so we don't need to buffer
    # the results like we did above.

    # This first subquery is to group together filenames that might be duplicated
    # within the same folder. We also add a 'count' column so we can exclude the
    # groups that don't contain any actual duplicates (this query ends up pulling
    # ALL filenames)
    duplicate_sq1 = session.query(
        t_file.c.id,
        t_file.c.filename,
        sa.func.count().over(
            partition_by=[t_file.c.filename,
                          t_file.c.parent_id],
        ).label('count'),
        sa.func.rank().over(
            partition_by=[t_file.c.filename,
                          t_file.c.parent_id],
        ).label('group')
    ) \
        .filter(t_file.c.parent_id.isnot(None)) \
        .subquery()

    # Now we exclude non-duplicate groups
    duplicate_sq2 = session.query(
        duplicate_sq1,
        sa.func.rank().over(
            partition_by=duplicate_sq1.c.group,
            order_by=duplicate_sq1.c.id,
        ).label('index')
    ) \
        .filter(duplicate_sq1.c.count > 1) \
        .subquery()

    # Finally for the actual duplicates, we generate a new filename
    duplicate_sq3 = session.query(
        duplicate_sq2.c.id,
        duplicate_sq2.c.filename,
        sa.case([(duplicate_sq2.c.index == 1, duplicate_sq2.c.filename)],
                else_=sa.func.concat(duplicate_sq2.c.filename,
                                     ' (', duplicate_sq2.c.index, ')'
                                     )).label('new_filename')
    ) \
        .subquery()

    # Then we apply the new filenames
    session.execute(t_file.update()
                    .values(filename=duplicate_sq3.c.new_filename)
                    .where(t_file.c.id == duplicate_sq3.c.id))

    # NOTE: The above code could still fail if there's already files with (2), (3), etc. suffixes
    # But because we don't have a big userbase yet and there isn't any existing behavior
    # that would cause the addition of those suffixes, we'll hope for the best

    # Now apply the constraint
    logger.info("Applying database constraint to prevent duplicate filenames...")
    op.create_index('uq_files_unique_filename', 'files', ['filename', 'parent_id'], unique=True,
                    postgresql_where=sa.text(
                        'deletion_date IS NULL AND recycling_date IS NULL AND parent_id IS NOT NULL'))

    logger.info("File schema unified")


def downgrade():
    raise Exception("downgrade not supported")


def insert_sample_data(session):
    """
    Insert test data for testing this migration.
    """
    t_projects = sa.Table(
        'projects',
        sa.MetaData(),
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_name'),
        sa.Column('description'),
        sa.Column('users'),
        sa.Column('creation_date'),
        sa.Column('modified_date'),
    )

    t_map = sa.Table(
        'project',
        sa.MetaData(),
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('label'),
        sa.Column('description'),
        sa.Column('graph'),
        sa.Column('public'),
        sa.Column('author'),
        sa.Column('user_id'),
        sa.Column('dir_id'),
        sa.Column('hash_id'),
        sa.Column('creation_date'),
        sa.Column('modified_date'),
    )

    t_map_version = sa.Table(
        'project_version',
        sa.MetaData(),
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('label'),
        sa.Column('description'),
        sa.Column('graph'),
        sa.Column('public'),
        sa.Column('user_id'),
        sa.Column('dir_id'),
        sa.Column('project_id'),
        sa.Column('creation_date'),
        sa.Column('modified_date'),
    )

    t_map_backup = sa.Table(
        'project_backup',
        sa.MetaData(),
        sa.Column('project_id', sa.Integer(), primary_key=True),
        sa.Column('label'),
        sa.Column('description'),
        sa.Column('graph'),
        sa.Column('public'),
        sa.Column('author'),
        sa.Column('user_id'),
        sa.Column('hash_id'),
        sa.Column('creation_date'),
        sa.Column('modified_date'),
    )

    t_file_content = sa.Table(
        'files_content',
        sa.MetaData(),
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('raw_file'),
        sa.Column('checksum_sha256'),
        sa.Column('creation_date'),
    )

    t_files = sa.Table(
        'files',
        sa.MetaData(),
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('file_id'),
        sa.Column('project'),
        sa.Column('dir_id'),
        sa.Column('filename'),
        sa.Column('description'),
        sa.Column('content_id'),
        sa.Column('user_id'),
        sa.Column('creation_date'),
        sa.Column('modified_date'),
    )

    t_directory = sa.Table(
        'directory',
        sa.MetaData(),
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name'),
        sa.Column('directory_parent_id'),
        sa.Column('projects_id'),
        sa.Column('user_id'),
        sa.Column('creation_date'),
        sa.Column('modified_date'),
    )

    session.execute(t_app_user.insert().values(
        username='joe',
        first_name='Joe',
        last_name='Taylor',
    ))

    session.execute(t_projects.insert().values(
        project_name='Test',
        users=[],
        creation_date=datetime.now()
    ))

    # No root DIR
    session.execute(t_projects.insert().values(
        project_name='No Root Dir',
        users=[],
        creation_date=datetime.now()
    ))

    session.execute(t_directory.insert().values(
        name='test',
        projects_id=1,
        user_id=1,
    ))

    session.execute(t_directory.insert().values(
        name='some other folder',
        projects_id=1,
        user_id=1,
    ))

    session.execute(t_directory.insert().values(
        name='test subfolder',
        projects_id=1,
        directory_parent_id=1,
        user_id=1,
    ))

    session.execute(t_map.insert().values(
        label='Test Map',
        description='Blah',
        graph='{"nodes": [], "edges": []}',
        public=True,
        user_id=1,
        author='test',
        dir_id=1,
        hash_id='maphash',
        creation_date=datetime.now(),
        modified_date=datetime.now(),
    ))

    session.execute(t_map.insert().values(
        label='Test Map',
        description='Blah',
        graph='{"nodes": [], "edges": []}',
        public=True,
        user_id=1,
        author='test',
        dir_id=1,
        hash_id='maphash2',
        creation_date=datetime.now(),
        modified_date=datetime.now(),
    ))

    session.execute(t_map_version.insert().values(
        label='Test Map',
        description='Blah',
        graph='{"nodes": [], "edges": []}',
        public=True,
        user_id=1,
        dir_id=1,
        project_id=1,
        creation_date=datetime.now(),
        modified_date=datetime.now(),
    ))

    session.execute(t_map_backup.insert().values(
        label='Test Map',
        description='Blah',
        graph='{"nodes": [], "edges": []}',
        public=True,
        user_id=1,
        author='test',
        project_id=1,
        hash_id='dummy',
        creation_date=datetime.now(),
        modified_date=datetime.now(),
    ))

    session.execute(t_file_content.insert().values(
        raw_file='test',
        checksum_sha256='test',
        creation_date=datetime.now(),
    ))

    session.execute(t_files.insert().values(
        file_id='test',
        project=1,
        filename='test.txt',
        content_id=1,
        dir_id=2,
        user_id=1,
        creation_date=datetime.now(),
    ))

    session.execute(t_files.insert().values(
        file_id='enrichment',
        project=1,
        filename='table.enrichment',
        content_id=1,
        dir_id=2,
        user_id=1,
        creation_date=datetime.now(),
    ))
