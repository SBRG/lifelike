from common.liquibase_changelog_generator import *
from common.query_builder import *
from common.constants import *

class YeastCycChangeLogGenerator(ChangeLogFileGenerator):
    """
    After loading yeastcyc, there are a lot of indexes that could be removed
    """
    def __init__(self):
        ChangeLogFileGenerator.__init__(self, 'Robin Cai', False, '', DB_BIOCYC)

    def remove_indexes(self):
        """
        remove unused indexes and constraints
        """
        queries = []
        queries.append(get_drop_constraint_query())
