"""add file locks

Revision ID: a2131a8605c0
Revises: e4e01bc5ad23
Create Date: 2020-12-08 21:09:43.488344

"""
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a2131a8605c0'
down_revision = '72ca40805083'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('file_lock',
    sa.Column('creation_date', sa.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('modified_date', sa.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('hash_id', sa.String(length=50), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('acquire_date', sa.TIMESTAMP(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['appuser.id'], name=op.f('fk_file_lock_user_id_appuser'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_file_lock'))
    )
    op.create_index(op.f('ix_file_lock_hash_id'), 'file_lock', ['hash_id'], unique=True)
    op.create_index(op.f('ix_file_lock_user_id'), 'file_lock', ['user_id'], unique=False)
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_file_lock_user_id'), table_name='file_lock')
    op.drop_index(op.f('ix_file_lock_hash_id'), table_name='file_lock')
    op.drop_table('file_lock')
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
