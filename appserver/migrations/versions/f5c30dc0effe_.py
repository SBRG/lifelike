"""replace username field on files with user_id

Revision ID: f5c30dc0effe
Revises: a84e5653318c
Create Date: 2020-04-30 16:03:53.147120

"""
import sqlalchemy as db
from alembic import op

revision = 'f5c30dc0effe'
down_revision = 'a84e5653318c'
branch_labels = None
depends_on = None

t_user = db.Table(
    'appuser',
    db.MetaData(),
    db.Column('id', db.Integer, primary_key=True),
    db.Column('username', db.String(64), index=True, unique=True),
    db.Column('email', db.String(120), index=True, unique=True),
    db.Column('first_name', db.String(120), nullable=False),
    db.Column('last_name', db.String(120), nullable=False),
)

t_files = db.Table(
    'files',
    db.MetaData(),
    db.Column('id', db.Integer, primary_key=True, autoincrement=True),
    db.Column('user_id', db.Integer, db.ForeignKey('appuser.id', ondelete='CASCADE'), nullable=False),
    db.Column('username', db.String(64)),
)


def upgrade():
    op.add_column('files', db.Column('user_id', db.Integer, nullable=True))
    op.create_foreign_key(op.f('fk_files_user_id_appuser'), 'files', 'appuser', ['user_id'], ['id'], ondelete='CASCADE')

    conn = op.get_bind()

    files = conn.execute(db.select([
        t_files.c.id,
        t_user.c.id,
    ]).select_from(
        t_files.outerjoin(t_user, t_files.c.username == t_user.c.username)
    )).fetchall()

    migration_error_user_id = None

    for file_id, user_id in files:
        if user_id is None:
            # We can't find the user, so let's create a dummy one for this migration

            if not migration_error_user_id:
                migration_error_user_result = conn \
                    .execute(db
                             .select([t_user.c.id])
                             .where(t_user.c.username == '_unknown_uploader_')) \
                    .fetchone()

                if migration_error_user_result:
                    migration_error_user_id = migration_error_user_result[0]
                else:
                    migration_error_user_id = conn \
                        .execute(t_user.insert().values(username="_unknown_uploader_",
                                                        email="nobody@example.com",
                                                        first_name="Uploader",
                                                        last_name="Unknown")) \
                        .inserted_primary_key[0]

            user_id = migration_error_user_id

        conn.execute(t_files
                     .update()
                     .where(t_files.c.id == file_id)
                     .values(user_id=user_id))

    op.alter_column('files', 'user_id',
                    existing_type=db.INTEGER(),
                    nullable=False)
    op.drop_column('files', 'username')


def downgrade():
    op.add_column('files', db.Column('username', db.VARCHAR(length=30), autoincrement=False, nullable=True))
    op.drop_constraint(op.f('fk_files_user_id_appuser'), 'files', type_='foreignkey')

    conn = op.get_bind()

    files = conn.execute(db.select([
        t_files.c.id,
        t_user.c.username,
    ]).select_from(
        t_files.join(t_user, t_files.c.user_id == t_user.c.id)
    )).fetchall()

    for file_id, username in files:
        conn.execute(t_files
                     .update()
                     .where(t_files.c.id == file_id)
                     .values(username=username))

    op.drop_column('files', 'user_id')
