"""Addeds an access control policy scheme, similar
to unix to allow assigning specific permissions
to specific authorities

Revision ID: d9627f552779
Revises: b032b46c803b
Create Date: 2020-03-15 21:49:41.116433

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd9627f552779'
down_revision = 'b032b46c803b'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        'access_control_policy',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('asset_type', sa.String(length=200), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=True),
        sa.Column('principal_type', sa.String(length=50), nullable=False),
        sa.Column('principal_id', sa.Integer(), nullable=True),
        sa.Column('rule_type', sa.Enum('ALLOW', 'DENY', name='accessruletype'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_acp_asset_key', 'access_control_policy', ['asset_type', 'asset_id'], unique=False)  # noqa
    op.create_index('ix_acp_principal_key', 'access_control_policy', ['principal_type', 'principal_id'], unique=False)  # noqa
    op.create_table(
        'app_role',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_table(
        'app_user_role',
        sa.Column('appuser_id', sa.Integer(), nullable=False),
        sa.Column('app_role_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['app_role_id'], ['app_role.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['appuser_id'], ['appuser.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('appuser_id', 'app_role_id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('app_user_role')
    op.drop_table('app_role')
    op.drop_index('ix_acp_principal_key', table_name='access_control_policy')
    op.drop_index('ix_acp_asset_key', table_name='access_control_policy')
    op.drop_table('access_control_policy')
    # ### end Alembic commands ###
