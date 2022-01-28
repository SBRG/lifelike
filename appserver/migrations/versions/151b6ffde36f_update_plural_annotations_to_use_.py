"""Update plural annotations to use singular

Revision ID: 151b6ffde36f
Revises: 1c3ac93bf8e7
Create Date: 2020-10-12 22:55:47.642319

"""
from alembic import context
from alembic import op
import sqlalchemy as sa

from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '151b6ffde36f'
down_revision = '1c3ac93bf8e7'
branch_labels = None
depends_on = None


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


def get_updated_entity_type(entity_type):
    if entity_type == 'Chemicals':
        return 'Chemical',
    elif entity_type == 'Companies':
        return 'Company'
    elif entity_type == 'Compounds':
        return 'Compound'
    elif entity_type == 'Diseases':
        return 'Disease'
    elif entity_type == 'Entities':
        return 'Entity'
    elif entity_type == 'Genes':
        return 'Gene'
    elif entity_type == 'Mutations':
        return 'Mutation'
    elif entity_type == 'Pathways':
        return 'Pathway'
    elif entity_type == 'Phenotypes':
        return 'Phenotype'
    elif entity_type == 'Proteins':
        return 'Protein'


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

    types_to_update = [
        'Chemicals',
        'Companies',
        'Compounds',
        'Diseases',
        'Entities',
        'Genes',
        'Mutations',
        'Pathways',
        'Phenotypes',
        'Proteins'
    ]

    for f in files:
        if f.annotations:
            annotations_list = f.annotations['documents'][0]['passages'][0]['annotations']

            updated_annotations = []
            for annotation in annotations_list:
                entity_type = annotation['meta']['type']

                if entity_type in types_to_update:
                    annotation['meta']['type'] = get_updated_entity_type(entity_type)

                updated_annotations.append(annotation)

            f.annotations['documents'][0]['passages'][0]['annotations'] = updated_annotations
            session.execute(
                files_table.update().where(
                    files_table.c.id == f.id).values(annotations=f.annotations))

        if f.custom_annotations:
            custom_annotations_list = f.custom_annotations

            updated_custom_annotations = []
            for custom_annotation in custom_annotations_list:
                entity_type = custom_annotation['meta']['type']

                if entity_type in types_to_update:
                    custom_annotation['meta']['type'] = get_updated_entity_type(entity_type)

                updated_custom_annotations.append(custom_annotation)

            session.execute(
                files_table.update().where(
                    files_table.c.id == f.id).values(custom_annotations=updated_custom_annotations))

    session.commit()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
