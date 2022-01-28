"""Update incorrect colors for company, mutation and pathway
types which are stored in custom annotations and global list

Revision ID: 5b17cf4f72b0
Revises: 2105594e7b33
Create Date: 2020-11-09 10:38:04.249132

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column


# revision identifiers, used by Alembic.
revision = '5b17cf4f72b0'
down_revision = '2105594e7b33'
branch_labels = None
depends_on = None


def upgrade():
    data_upgrades()


def downgrade():
    pass
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    session = Session(op.get_bind())

    files_table = table(
        'files',
        column('id', sa.Integer),
        column('custom_annotations', postgresql.JSONB)
    )

    files = session.execute(sa.select([
        files_table.c.id,
        files_table.c.custom_annotations
    ])).fetchall()

    global_list_table = table(
        'global_list',
        column('id', sa.Integer),
        column('type', sa.String),
        column('annotation', postgresql.JSONB)
    )

    global_list = session.execute(sa.select([
        global_list_table.c.id,
        global_list_table.c.type,
        global_list_table.c.annotation
    ])).fetchall()

    colors = {
        "#ff7f7f": "#d62728",
        "#8b5d2e": "#5d4037",
        "#90eebf": "#e377c2"
    }

    try:
        for f in files:
            updated_inclusions = []
            for inclusion in f.custom_annotations:
                stored_color = inclusion['meta']['color']
                if stored_color in colors:
                    inclusion['meta']['color'] = colors[stored_color]
                updated_inclusions.append(inclusion)

            session.execute(
                files_table.update().where(
                    files_table.c.id == f.id).values(
                        custom_annotations=updated_inclusions
                    )
            )

        for global_annotation in global_list:
            if global_annotation.type != 'inclusion':
                continue
            updated_global_inclusions = []
            stored_color = global_annotation['annotation']['meta']['color']
            if stored_color in colors:
                global_annotation['annotation']['meta']['color'] = colors[stored_color]

            session.execute(
                    global_list_table.update().where(
                        global_list_table.c.id == global_annotation.id).values(annotation=global_annotation['annotation'])
                )

        session.commit()

    except Exception as exc:
        session.rollback()
        session.close()
        raise Exception(exc)


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
