"""Add isCaseInsensitive flag to all
inclusions and exclusions

Revision ID: 2105594e7b33
Revises: f40355507984
Create Date: 2020-11-04 13:11:14.540418

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column


# revision identifiers, used by Alembic.
revision = '2105594e7b33'
down_revision = 'f40355507984'
branch_labels = None
depends_on = None


def upgrade():
    data_upgrades()


def downgrade():
    pass
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
        column('custom_annotations', postgresql.JSONB),
        column('excluded_annotations', postgresql.JSONB)
    )

    files = session.execute(sa.select([
        files_table.c.id,
        files_table.c.custom_annotations,
        files_table.c.excluded_annotations
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

    try:
        case_sensitive_types = ['Gene', 'Protein']
        for f in files:
            updated_inclusions = []
            for inclusion in f.custom_annotations:
                is_case_insensitive = True
                if inclusion['meta']['type'] in case_sensitive_types:
                    is_case_insensitive = False
                updated_inclusion = {**inclusion}
                updated_inclusion['meta']['isCaseInsensitive'] = is_case_insensitive
                updated_inclusions.append(updated_inclusion)

            updated_exclusions = []
            for exclusion in f.excluded_annotations:
                is_case_insensitive = True
                if exclusion['type'] in case_sensitive_types:
                    is_case_insensitive = False
                updated_exclusions.append({
                    **exclusion,
                    'isCaseInsensitive': is_case_insensitive
                })

            session.execute(
                files_table.update().where(
                    files_table.c.id == f.id).values(
                        custom_annotations=updated_inclusions,
                        excluded_annotations=updated_exclusions
                    )
            )

        for global_annotation in global_list:
            if global_annotation.type == 'inclusion':
                is_case_insensitive = True
                if global_annotation['annotation']['meta']['type'] in case_sensitive_types:
                    is_case_insensitive = False
                updated_annotation = {**global_annotation['annotation']}
                updated_annotation['meta']['isCaseInsensitive'] = is_case_insensitive
                
            else:
                is_case_insensitive = True
                if global_annotation['annotation']['type'] in case_sensitive_types:
                    is_case_insensitive = False
                updated_annotation = {
                    **global_annotation['annotation'],
                    'isCaseInsensitive': is_case_insensitive
                }

            session.execute(
                    global_list_table.update().where(
                        global_list_table.c.id == global_annotation.id).values(annotation=updated_annotation)
                )

        session.commit()

    except Exception as exc:
        session.rollback()
        session.close()
        raise Exception(exc)


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
