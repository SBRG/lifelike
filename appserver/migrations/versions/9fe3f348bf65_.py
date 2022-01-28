"""Add indexes to foreign key columns on every table

Revision ID: 9fe3f348bf65
Revises: 140e61179d07
Create Date: 2020-08-12 22:27:18.565424

"""
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9fe3f348bf65'
down_revision = '140e61179d07'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_index(op.f('ix_app_user_role_app_role_id'), 'app_user_role', ['app_role_id'], unique=False)
    op.create_index(op.f('ix_app_user_role_appuser_id'), 'app_user_role', ['appuser_id'], unique=False)
    op.create_index(op.f('ix_directory_directory_parent_id'), 'directory', ['directory_parent_id'], unique=False)
    op.create_index(op.f('ix_directory_projects_id'), 'directory', ['projects_id'], unique=False)
    op.create_index(op.f('ix_directory_user_id'), 'directory', ['user_id'], unique=False)
    op.create_index(op.f('ix_files_content_id'), 'files', ['content_id'], unique=False)
    op.create_index(op.f('ix_files_dir_id'), 'files', ['dir_id'], unique=False)
    op.create_index(op.f('ix_files_project'), 'files', ['project'], unique=False)
    op.create_index(op.f('ix_files_user_id'), 'files', ['user_id'], unique=False)
    op.create_index(op.f('ix_project_dir_id'), 'project', ['dir_id'], unique=False)
    op.create_index(op.f('ix_project_user_id'), 'project', ['user_id'], unique=False)
    op.create_index(op.f('ix_projects_collaborator_role_app_role_id'), 'projects_collaborator_role', ['app_role_id'], unique=False)
    op.create_index(op.f('ix_projects_collaborator_role_appuser_id'), 'projects_collaborator_role', ['appuser_id'], unique=False)
    op.create_index(op.f('ix_projects_collaborator_role_projects_id'), 'projects_collaborator_role', ['projects_id'], unique=False)
    op.create_index(op.f('ix_worksheets_content_id'), 'worksheets', ['content_id'], unique=False)
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_worksheets_content_id'), table_name='worksheets')
    op.drop_index(op.f('ix_projects_collaborator_role_projects_id'), table_name='projects_collaborator_role')
    op.drop_index(op.f('ix_projects_collaborator_role_appuser_id'), table_name='projects_collaborator_role')
    op.drop_index(op.f('ix_projects_collaborator_role_app_role_id'), table_name='projects_collaborator_role')
    op.drop_index(op.f('ix_project_user_id'), table_name='project')
    op.drop_index(op.f('ix_project_dir_id'), table_name='project')
    op.drop_index(op.f('ix_files_user_id'), table_name='files')
    op.drop_index(op.f('ix_files_project'), table_name='files')
    op.drop_index(op.f('ix_files_dir_id'), table_name='files')
    op.drop_index(op.f('ix_files_content_id'), table_name='files')
    op.drop_index(op.f('ix_directory_user_id'), table_name='directory')
    op.drop_index(op.f('ix_directory_projects_id'), table_name='directory')
    op.drop_index(op.f('ix_directory_directory_parent_id'), table_name='directory')
    op.drop_index(op.f('ix_app_user_role_appuser_id'), table_name='app_user_role')
    op.drop_index(op.f('ix_app_user_role_app_role_id'), table_name='app_user_role')
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
