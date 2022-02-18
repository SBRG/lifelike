import os

from common.database import Database
from common.utils import get_data_dir


class BaseDataLoader:
    def __init__(self, data_dir_name, base_dir: str = None):
        if not base_dir:
            base_dir = get_data_dir()
        self.base_dir = base_dir
        self.output_dir = os.path.join(self.base_dir, 'processed', data_dir_name)

    def create_indexes(self, database: Database):
        pass

    def load_data_to_neo4j(self, database: Database):
        pass
