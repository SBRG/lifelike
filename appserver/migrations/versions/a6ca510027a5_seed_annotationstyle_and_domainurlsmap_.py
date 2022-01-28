"""Seed AnnotationStyle and DomainURLsMap tables

Revision ID: a6ca510027a5
Revises: fb1654973fbd
Create Date: 2020-08-19 23:27:53.132930

"""
import json

from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column

from neo4japp.models import AnnotationStyle, DomainURLsMap


# revision identifiers, used by Alembic.
revision = 'a6ca510027a5'
down_revision = 'fb1654973fbd'
branch_labels = None
depends_on = None

t_annotation_style = table(
    'annotation_style',
    column('id', sa.Integer),
    column('label', sa.String),
    column('color', sa.String),
    column('icon_code', sa.String),
    column('font_color', sa.String),
    column('border_color', sa.String),
    column('background_color', sa.String),
)

t_domain_urls_map = table(
    'domain_urls_map',
    column('id', sa.Integer),
    column('domain', sa.String),
    column('base_URL', sa.String),
)


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
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
    """Add optional data upgrade migrations here"""
    session = Session(op.get_bind())

    domain_urls_map_json = {}
    annotation_style_json = {}
    with open("fixtures/seed.json", "r") as f:
        data = json.load(f)

        for model in data:
            if model['model'] == 'neo4japp.models.DomainURLsMap':
                domain_urls_map_json = model['records']
                continue

            if model['model'] == 'neo4japp.models.AnnotationStyle':
                annotation_style_json = model['records']
                continue

    domain_urls_map_data = []
    for row in domain_urls_map_json:
        domain_urls_map_data.append(
            {
                'domain': row['domain'],
                'base_URL': row['base_URL']
            }
        )
    session.execute(t_domain_urls_map.insert(), domain_urls_map_data)

    annotation_style_data = []
    for row in annotation_style_json:
        annotation_style_data.append(
            {
                'label': row['label'],
                'color': row['color'],
                'border_color': row.get('border_color', None),
                'background_color': row.get('background_color', None),
                'font_color': row.get('font_color', None),
                'icon_code': row.get('icon_code', None),
            }
        )
    session.execute(t_annotation_style.insert(), annotation_style_data)

    session.commit()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
