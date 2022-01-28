"""Add project version attribute columns and creation date to project.

Revision ID: 7fb303ae343b
Revises: ad845c5f4821
Create Date: 2020-08-10 19:08:24.679959

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
import sqlalchemy_utils

# revision identifiers, used by Alembic.
revision = '7fb303ae343b'
down_revision = 'ad845c5f4821'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('project_version',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('label', sa.String(length=250), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('date_modified', sa.DateTime(), nullable=True),
    sa.Column('graph', sa.JSON(), nullable=True),
    sa.Column('public', sa.Boolean(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('dir_id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('search_vector', sqlalchemy_utils.types.TSVectorType, nullable=True),
    sa.Column('creation_date', sa.DateTime(), nullable=True),
    sa.Column('hash_id', sa.String(length=50), nullable=True),
    sa.UniqueConstraint('hash_id', name=op.f('uq_project_version_hash_id')),
    sa.ForeignKeyConstraint(['dir_id'], ['directory.id'], name=op.f('fk_project_version_dir_id_directory')),
    sa.ForeignKeyConstraint(['project_id'], ['project.id'], name=op.f('fk_project_version_project_id_project')),
    sa.ForeignKeyConstraint(['user_id'], ['appuser.id'], name=op.f('fk_project_version_user_id_appuser')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_project_version'))
    )
    op.create_index('ix_project_version_search_vector', 'project_version', ['search_vector'], unique=False, postgresql_using='gin')
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index('ix_project_version_search_vector', table_name='project_version')
    op.drop_table('project_version')
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
