"""Update enum name for file_annotation_version cause column

Revision ID: 85062d2a244a
Revises: 06e737103f71
Create Date: 2022-01-13 22:06:37.957121

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '85062d2a244a'
down_revision = '06e737103f71'
branch_labels = None
depends_on = None


def upgrade():
    actions = postgresql.ENUM('USER', 'USER_REANNOTATION', 'SYSTEM_REANNOTATION',
                              name='annotationchangecause')
    actions.create(op.get_bind(), checkfirst=True)
    op.alter_column(
        'file_annotations_version', 'cause',
        existing_type=postgresql.ENUM('USER', 'USER_REANNOTATION', 'SYSTEM_REANNOTATION',
                                      name='annotationcause'),
        type_=sa.Enum('USER', 'USER_REANNOTATION', 'SYSTEM_REANNOTATION',
                      name='annotationchangecause'),
        existing_nullable=False,
        # Cast cause column as text, then as the new Enum
        postgresql_using='cause::text::annotationchangecause')
    op.execute("DROP TYPE annotationcause")

    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    actions = postgresql.ENUM('USER', 'USER_REANNOTATION', 'SYSTEM_REANNOTATION',
                              name='annotationcause')
    actions.create(op.get_bind(), checkfirst=True)
    op.alter_column(
        'file_annotations_version', 'cause',
        existing_type=sa.Enum('USER', 'USER_REANNOTATION', 'SYSTEM_REANNOTATION',
                              name='annotationchangecause'),
        type_=postgresql.ENUM('USER', 'USER_REANNOTATION', 'SYSTEM_REANNOTATION',
                              name='annotationcause'),
        existing_nullable=False,
        postgresql_using='cause::text::annotationcause')
    op.execute("DROP TYPE annotationchangecause")


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
