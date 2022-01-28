"""update incorrect annotation colors

Revision ID: f40355507984
Revises: 64838825541f
Create Date: 2020-10-26 23:37:59.053698

"""
from alembic import context
from alembic import op
import sqlalchemy as sa

from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f40355507984'
down_revision = '64838825541f'
branch_labels = None
depends_on = None


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    return
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    session = Session(op.get_bind())

    files_table = table(
        'files',
        column('id', sa.Integer),
        column('annotations', postgresql.JSONB),
        column('custom_annotations', postgresql.JSONB))

    files = session.execute(sa.select([
        files_table.c.id,
        files_table.c.annotations,
        files_table.c.custom_annotations
    ])).fetchall()

    color_swap = {
        '#fae0b8': '#ff9800',
        '#cee5cb': '#4caf50'
    }

    for f in files:
        if f.annotations:
            annotations_list = f.annotations['documents'][0]['passages'][0]['annotations']

            updated_annotations = []

            for annotation in annotations_list:
                try:
                    if annotation['meta']['color'] in color_swap:
                        annotation['meta']['color'] = color_swap.get(annotation['meta']['color'])
                except KeyError:
                    pass

                updated_annotations.append(annotation)

            f.annotations['documents'][0]['passages'][0]['annotations'] = updated_annotations

            try:
                session.execute(
                    files_table.update().where(
                        files_table.c.id == f.id).values(annotations=f.annotations))
            except Exception:
                session.rollback()
                session.close()
                raise

        if f.custom_annotations:
            custom_annotations_list = f.custom_annotations

            updated_custom_annotations = []
            for custom_annotation in custom_annotations_list:
                try:
                    if custom_annotation['meta']['color'] in color_swap:
                        custom_annotation['meta']['color'] = color_swap.get(custom_annotation['meta']['color'])
                except KeyError:
                    pass

                updated_custom_annotations.append(custom_annotation)

            try:
                session.execute(
                    files_table.update().where(
                        files_table.c.id == f.id).values(custom_annotations=updated_custom_annotations))
            except Exception:
                session.rollback()
                session.close()
                raise

    try:
        session.commit()
        session.close()
    except Exception:
        session.rollback()
        session.close()
        raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
