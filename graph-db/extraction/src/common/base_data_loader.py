import os

from common.database import Database
from config.config import Config


class BaseDataLoader:
    def __init__(self, database:Database, data_dir_name, base_dir: str = None):
        if not base_dir:
            base_dir = Config().data_dir
        self.base_dir = base_dir
        self.output_dir = os.path.join(self.base_dir, 'processed', data_dir_name)
        self.database = database

    def create_indexes(self):
        pass

    def load_data_to_neo4j(self):
        pass
