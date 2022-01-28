"""empty message

Revision ID: cd1cffdea0e8
Revises: f5c30dc0effe
Create Date: 2020-05-05 21:48:21.343438

"""
import hashlib

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'cd1cffdea0e8'
down_revision = 'f5c30dc0effe'
branch_labels = None
depends_on = None

t_files_content = sa.Table(
    'files_content',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column('raw_file', sa.LargeBinary, nullable=True),
    sa.Column('checksum_sha256', sa.Binary(32), nullable=False, index=True, unique=True),
    sa.Column('creation_date', sa.DateTime, nullable=False, default=sa.func.now()),
)

t_files = sa.Table(
    'files',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column('filename', sa.String(60)),
    sa.Column('content_id', sa.Integer, sa.ForeignKey(t_files_content.c.id, ondelete='CASCADE')),
    sa.Column('raw_file', sa.LargeBinary, nullable=True),
)


def upgrade():
    op.create_table('files_content',
                    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
                    sa.Column('raw_file', sa.LargeBinary(), nullable=False),
                    sa.Column('checksum_sha256', sa.Binary(), nullable=False),
                    sa.Column('creation_date', sa.DateTime(), nullable=False),
                    sa.PrimaryKeyConstraint('id', name=op.f('pk_files_content'))
                    )
    op.create_index(op.f('ix_files_content_checksum_sha256'), 'files_content', ['checksum_sha256'], unique=True)
    op.add_column('files', sa.Column('content_id', sa.Integer(), nullable=True))
    op.create_foreign_key(op.f('fk_files_content_id_files_content'), 'files', 'files_content', ['content_id'], ['id'],
                          ondelete='CASCADE')
    op.alter_column('files', 'filename',
                    existing_type=sa.VARCHAR(length=60),
                    type_=sa.String(length=200),
                    existing_nullable=False)

    conn = op.get_bind()

    files = conn.execute(sa.select([
        t_files.c.id,
        t_files.c.raw_file,
    ])).fetchall()

    for file_id, raw_file in files:
        checksum_sha256 = hashlib.sha256(raw_file).digest()

        existing_content_result = conn \
            .execute(sa.select([t_files_content.c.id]).where(t_files_content.c.checksum_sha256 == checksum_sha256)) \
            .fetchone()

        if existing_content_result:
            content_id = existing_content_result[0]
        else:
            content_id = conn \
                .execute(t_files_content.insert().values(raw_file=raw_file, checksum_sha256=checksum_sha256)) \
                .inserted_primary_key[0]

        conn.execute(t_files
                     .update()
                     .where(t_files.c.id == file_id)
                     .values(content_id=content_id))

    op.drop_column('files', 'raw_file')
    op.alter_column('files', 'content_id',
                    existing_type=postgresql.INTEGER(),
                    nullable=False)
    op.alter_column('files_content', 'raw_file',
                    existing_type=postgresql.BYTEA(),
                    nullable=False)


def downgrade():
    op.alter_column('files', 'filename',
                    existing_type=sa.String(length=200),
                    type_=sa.VARCHAR(length=60),
                    existing_nullable=False)
    op.drop_constraint(op.f('fk_files_content_id_files_content'), 'files', type_='foreignkey')
    op.add_column('files', sa.Column('raw_file', sa.LargeBinary(), nullable=True))

    conn = op.get_bind()

    # this could be a single UPDATE from SELECT statement but ¯\_(ツ)_/¯
    files = conn.execute(sa.select([
        t_files.c.id,
        t_files_content.c.raw_file,
    ]).select_from(
        t_files.join(t_files_content, t_files_content.c.id == t_files.c.content_id)
    )).fetchall()

    for file_id, raw_file in files:
        conn.execute(t_files
                     .update()
                     .where(t_files.c.id == file_id)
                     .values(raw_file=raw_file))

    op.drop_column('files', 'content_id')
    op.drop_index(op.f('ix_files_content_checksum_sha256'), table_name='files_content')
    op.drop_table('files_content')
