""" Adds the 'user' role to all users who do not currently have this role.
The user role is now added by default when a user is created through the application.

Revision ID: 3965afb2ae35
Revises: d1d929f5d30e
Create Date: 2021-02-25 01:14:56.674576

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import aliased
from sqlalchemy.orm.session import Session


# revision identifiers, used by Alembic.
revision = '3965afb2ae35'
down_revision = 'd1d929f5d30e'
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


def data_upgrades():
    """Add optional data upgrade migrations here"""
    session = Session(op.get_bind())

    t_app_user = sa.Table(
        'appuser',
        sa.MetaData(),
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('username', sa.String(64), index=True, unique=True),
        sa.Column('email', sa.String(120), index=True, unique=True),
        sa.Column('first_name', sa.String(120), nullable=False),
        sa.Column('last_name', sa.String(120), nullable=False),
    )

    t_app_role = sa.Table(
        'app_role',
        sa.MetaData(),
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name'),
    )

    t_app_user_role = sa.Table(
        'app_user_role',
        sa.MetaData(),
        sa.Column('appuser_id', sa.Integer(), primary_key=True, index=True),
        sa.Column('app_role_id', sa.Integer(), primary_key=True, index=True)
    )

    t_appuser = aliased(t_app_user)
    t_approle = aliased(t_app_role)
    subquery = sa.select([t_appuser.c.id]).select_from(
        t_appuser.join(t_app_user_role, t_app_user_role.c.appuser_id == t_appuser.c.id)
        .join(t_approle, t_app_user_role.c.app_role_id == t_approle.c.id)).where(t_approle.c.name == 'user').alias('subquery')
    query = sa.select([t_appuser.c.id]).select_from(t_appuser).where(~t_appuser.c.id.in_(subquery))

    app_role_query = sa.select([t_approle.c.id]).where(t_approle.c.name == 'user')
    app_role_id = session.execute(app_role_query).fetchone()

    if app_role_id is None:
        user_role_query = session.execute(t_app_role.insert().values(name='user'))
        app_role_id = user_role_query.inserted_primary_key[0]
    else:
        # Unpack the tuple
        app_role_id = app_role_id[0]

    uids = [u for u, in session.execute(query).fetchall()]
    prepared_inserts = [{'app_role_id': app_role_id, 'appuser_id': uid} for uid in uids]

    if prepared_inserts:
        session.execute(t_app_user_role.insert(), prepared_inserts)

def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
