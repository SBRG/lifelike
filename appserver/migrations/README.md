# Database Migration

## Initial migration

If you are running the app for the first time after cloning the repository, then nothing is needed except running the app via docker.

```bash
docker-compose build --no-cache; docker-compose up -d
```

Once the app is running, the database should be seeded with the latest changes. If you however have an outdated or corrupted `appserver/migrations` folder, then delete that folder with `rm -rf appserver/migrations` then copy the latest from the repo before running the above command.

## Making changes to database models

When new changes to the database models occur, they need to be added to the migration scripts. A new migration script can be created by running the command.

```bash
docker-compose exec appserver bin/migrate-db
```

This will create a new migration script in `appserver/migrations/versions` based on the changes. In order for the new changes to be applied to the database, run the command.

```bash
docker-compose exec appserver bin/migrate-db --upgrade
```

## Making changes to database data without schema changes

If you need to generate an alembic revision for data migration, but don't have any schema changes, run:

```bash
docker-compose exec appserver flask db revision
```

This will generate a new revision with no schema changes.

### Important

The generated migration scripts need to be reviewed and edited. The reason is because Alembic does not detect all changes made to the models.

For a summary of limitations: http://alembic.zzzcomputing.com/en/latest/autogenerate.html#what-does-autogenerate-detect-and-what-does-it-not-detect

Once the scripts have been reviewed, they need to be checked in and pushed.

#### Non nullable columns

When adding new non nullable columns, adding a default value via the SQLAlchemy models will not add default values to the database. To add default values to existing tables with data, use the `server_default` from alembic.

E.g
```python
class ClassA(Mixin):
    id = db.Column(db.BigInteger, primary_key=True)
    # will not work for existing tables!!!
    test = db.Column(db.String, nullable=False, default='')
    # instead use `server_default` which will create the corresponding attribute in the migration file
    test = db.Column(db.String, nullable=False, server_default='Test')

# instead use `server_default`
# ref: https://alembic.sqlalchemy.org/en/latest/ops.html?highlight=insert#alembic.operations.Operations.add_column
op.add_column('class_a', sa.Column('test',
                                    postgresql.JSONB(astext_type=sa.Text()),
                                    nullable=False,
                                    server_default='[]',
                                    ))
```

## Upgrade and downgrade database revisions

If for some reason you want to upgrade or downgrade to a specific version, run the command.

```bash
docker-compose exec appserver bin/migrate-db --upgrade --version=<revision_number>
docker-compose exec appserver bin/migrate-db --downgrade --version=<revision_number>
```

The revision number can be found in the migration script. If you are going to be jumping to a specific version, be careful to not make changes on that revision. Instead, go back to the most recent version, make changes to either undo a previous change or make new changes. If undoing, then make a new migration script, then make new changes from the newly made migration.
