import os
import json
import lmdb
import sys

from collections import deque
from getopt import getopt, GetoptError

from elasticsearch import Elasticsearch
from elasticsearch.helpers import parallel_bulk

from neo4japp.services.annotations.constants import (
    ANATOMY_LMDB,
    CHEMICALS_LMDB,
    COMPOUNDS_LMDB,
    DISEASES_LMDB,
    FOODS_LMDB,
    GENES_LMDB,
    PHENOTYPES_LMDB,
    PROTEINS_LMDB,
    SPECIES_LMDB,
)

from neo4japp.database import db
from neo4japp.factory import create_app
from neo4japp.models import GlobalList
from neo4japp.services.annotations.constants import ManualAnnotationType


es = Elasticsearch(hosts=['http://elasticsearch'], timeout=5000)

"""
Don't delete - useful for testing locally to confirm the
LMDB structure and row count.
"""


def process_lmdb(env, db, entity_type):
    with env.begin(db=db) as transaction:
        cursor = transaction.cursor()
        for i, (key, value) in enumerate(cursor.iternext()):
            data = json.loads(value.decode('utf-8'))
            yield {
                '_id': i+1,
                '_index': entity_type,
                '_source': {
                    'id': key.decode('utf-8'),
                    'data': data
                }
            }


def add_exclusion_to_elastic(exclusions):
    # make sure there are exclusions before indexing
    if exclusions[0]:
        for i, exclusion, in enumerate(exclusions):
            yield {
                '_id': i+1,
                '_index': 'annotation_exclusion',
                '_source': {
                    'id': i+1,
                    'word': exclusion
                }
            }


def print_help():
    help_str = """
    index_annotations.py
    -a                          index all annotations
    -n <lmdb_name>              index specific annotation
    -e                          index annotation exclusion words
    Current LMDB names include:
        anatomy
        chemicals
        compounds
        diseases
        foods
        genes
        phenotypes
        proteins
        species
    """
    print(help_str)


def _open_env(parentdir, db_name):
    env = lmdb.open(parentdir, readonly=True, max_dbs=2)
    db = env.open_db(db_name.encode('utf-8'), dupsort=True)

    return env, db


def open_env(entity_type, parentdir):
    if entity_type == 'anatomy':
        env, db = _open_env(parentdir, ANATOMY_LMDB)
    elif entity_type == 'chemicals':
        env, db = _open_env(parentdir, CHEMICALS_LMDB)
    elif entity_type == 'compounds':
        env, db = _open_env(parentdir, COMPOUNDS_LMDB)
    elif entity_type == 'diseases':
        env, db = _open_env(parentdir, DISEASES_LMDB)
    elif entity_type == 'foods':
        env, db = _open_env(parentdir, FOODS_LMDB)
    elif entity_type == 'genes':
        env, db = _open_env(parentdir, GENES_LMDB)
    elif entity_type == 'phenotypes':
        env, db = _open_env(parentdir, PHENOTYPES_LMDB)
    elif entity_type == 'proteins':
        env, db = _open_env(parentdir, PROTEINS_LMDB)
    elif entity_type == 'species':
        env, db = _open_env(parentdir, SPECIES_LMDB)
    else:
        print_help()
        sys.exit(2)
    return env, db


def seed_exclusions():
    app = create_app('Functional Test Flask App', config='config.Testing')
    with app.app_context():
        exclusions = db.session.query(
            GlobalList.annotation['text']
        ).filter(
            GlobalList.type == ManualAnnotationType.EXCLUSION.value
        ).all()

        es.indices.delete(index='annotation_exclusion', ignore=[404])
        es.indices.create(index='annotation_exclusion')
        deque(parallel_bulk(es, add_exclusion_to_elastic(exclusions)), maxlen=0)


def main(argv):
    directory = os.path.realpath(os.path.dirname(__file__))

    try:
        opts, args = getopt(argv, 'aen:')
    except GetoptError:
        print_help()
        sys.exit(2)

    if opts:
        opt, entity_type = opts[0]

        if opt == '-n':
            parentdir = os.path.join(directory, f'lmdb/{entity_type}')

            env, db = open_env(entity_type, parentdir)

            print(f'Processing {parentdir}')
            # first delete the index to clear the data
            es.indices.delete(index=entity_type, ignore=[404])
            es.indices.create(index=entity_type)
            deque(parallel_bulk(es, process_lmdb(env, db, entity_type)), maxlen=0)
            env.close()
        elif opt == '-a':
            for parentdir, subdirs, files in os.walk(os.path.join(directory, 'lmdb')):
                if 'data.mdb' in files:
                    print(f'Processing {parentdir}')
                    entity_type = parentdir.split('/')[-1]

                    env, db = open_env(entity_type, parentdir)

                    # first delete the index to clear the data
                    es.indices.delete(index=entity_type, ignore=[404])
                    es.indices.create(index=entity_type)
                    deque(parallel_bulk(es, process_lmdb(env, db, entity_type)), maxlen=0)
                    env.close()
        elif opt == '-e':
            seed_exclusions()
        else:
            print_help()
            sys.exit(2)
    else:
        print_help()
        sys.exit(2)


if __name__ == '__main__':
    main(sys.argv[1:])
