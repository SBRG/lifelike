"""Initial migration

Revision ID: 2afbf962ec75
Revises: b032b46c803b
Create Date: 2020-03-06 19:54:32.359988

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b032b46c803b'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        'appuser',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=64), nullable=True),
        sa.Column('email', sa.String(length=120), nullable=True),
        sa.Column('password_hash', sa.String(length=256), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_appuser_email'), 'appuser', ['email'], unique=True)
    op.create_index(op.f('ix_appuser_username'), 'appuser', ['username'], unique=True)
    op.create_table(
        'project',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(length=250), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('date_modified', sa.DateTime(), nullable=True),
        sa.Column('graph', sa.JSON(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['appuser.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('project')
    op.drop_index(op.f('ix_appuser_username'), table_name='appuser')
    op.drop_index(op.f('ix_appuser_email'), table_name='appuser')
    op.drop_table('appuser')
    # ### end Alembic commands ###
