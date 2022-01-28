import os


class Config():
    """Default values"""
    # Optional for tracking the master branch for the build
    GITHUB_HASH = os.environ.get('GITHUB_HASH', 'undefined')
    GITHUB_LAST_COMMIT_TIMESTAMP = os.environ.get('GITHUB_COMMIT_TIMESTAMP', 'undefined')
    APP_BUILD_NUMBER = os.environ.get('APP_BUILD_NUMBER', 'undefined')
    APP_VERSION = os.environ.get('APP_VERSION', 'undefined')

    JWT_SECRET = os.environ.get('JWT_SECRET', 'secret')

    NLP_SECRET = os.environ.get('NLP_SECRET', 'secret')

    POSTGRES_HOST = os.environ.get('POSTGRES_HOST', 'localhost')
    POSTGRES_PORT = os.environ.get('POSTGRES_PORT', '5432')
    POSTGRES_USER = os.environ.get('POSTGRES_USER', 'postgres')
    POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', 'postgres')
    POSTGRES_DB = os.environ.get('POSTGRES_DB', 'postgres')

    NEO4J_HOST = os.environ.get('NEO4J_HOST', 'localhost')
    NEO4J_SCHEME = os.environ.get('NEO4J_SCHEME', 'bolt')
    NEO4J_AUTH = os.environ.get('NEO4J_AUTH', 'neo4j/password')
    NEO4J_PORT = os.environ.get('NEO4J_PORT', '7687')
    NEO4J_DATABASE = os.environ.get('NEO4J_DATABASE', 'neo4j')

    ELASTICSEARCH_URL = os.environ.get('ELASTICSEARCH_URL', 'http://localhost:9200')

    AZURE_ACCOUNT_STORAGE_NAME = os.environ.get('AZURE_ACCOUNT_STORAGE_NAME')
    AZURE_ACCOUNT_STORAGE_KEY = os.environ.get('AZURE_ACCOUNT_STORAGE_KEY')
    AZURE_BLOB_STORAGE_URL = os.environ.get('AZURE_BLOB_STORAGE_URL')

    SQLALCHEMY_DATABASE_URI = 'postgresql://%s:%s@%s:%s/%s' % (
        POSTGRES_USER,
        POSTGRES_PASSWORD,
        POSTGRES_HOST,
        POSTGRES_PORT,
        POSTGRES_DB
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}

    WTF_CSRF_ENABLED = False
    SUPPORTED_LOCALES = ['en']


class Testing(Config):
    """Functional test configuration"""
    TESTING = True
