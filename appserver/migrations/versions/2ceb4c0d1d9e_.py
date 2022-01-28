"""Drops the '.enrichment' suffix from old enrichment files.

Revision ID: 2ceb4c0d1d9e
Revises: 20a288c39ff2
Create Date: 2021-03-22 20:25:50.418793

"""
from alembic import context
from alembic import op
from sqlalchemy import and_
from sqlalchemy.orm import Session
import sqlalchemy as sa
import logging

# revision identifiers, used by Alembic.
revision = '2ceb4c0d1d9e'
down_revision = '20a288c39ff2'
branch_labels = None
depends_on = None

logger = logging.getLogger('alembic.runtime.migration.' + __name__)

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


def data_upgrades():
    """Add optional data upgrade migrations here"""
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

    session = Session(op.get_bind())

    query = sa.select([t_file.c.filename, t_file.c.id, t_file.c.parent_id])\
              .where(t_file.c.filename.ilike('%.enrichment'))

    files_to_change = session.execute(query)

    for file_name, fid, pid in files_to_change.fetchall():
        renamed_fi = file_name.replace('.enrichment', '')
        filename_dupe_count = 0

        while True:
            found = session.execute(sa.select(
                [t_file.c.filename]
            ).where(
                and_(
                    t_file.c.filename == renamed_fi,
                    t_file.c.parent_id == pid,
                )
            )).fetchone()
            logger.debug(f'Searching for file: {renamed_fi}. {found}')
            if found is None:
                logger.debug(f'Renaming file: <{file_name}> to <{renamed_fi}>')
                session.execute(t_file.update().values(
                    filename=renamed_fi
                ).where(t_file.c.id == fid))
                session.commit()
                break
            else:
                logger.debug(f'Found dupe for {file_name}')
                filename_dupe_count += 1
                renamed_fi = f'{renamed_fi} ({filename_dupe_count})'

    session.commit()

def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
