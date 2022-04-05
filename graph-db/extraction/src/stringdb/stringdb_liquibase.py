from common.liquibase_changelog_generator import *
from stringdb.stringdb_parser import PROT_INFO_HEADER


class StringChangeLogsGenerator(ChangeLogFileGenerator):
    def __init__(self, author, gzfile):
        ChangeLogFileGenerator.__init__(self, author, gzfile, DB_STRING, NODE_PROTEIN)
        self.index_quieries = []
        self.logger = logging.getLogger(__name__)

    def get_create_index_queries(self):
        self.index_quieries.append(get_create_constraint_query(NODE_STRING, PROP_ID))
        self.index_quieries.append(get_create_constraint_query(NODE_STRING, PROP_STRING_ID))
        self.index_quieries.append(get_create_index_query(NODE_STRING, PROP_NAME))
        self.index_quieries.append(get_create_index_query(NODE_STRING, PROP_REFSEQ))
        self.index_quieries.append(get_create_index_query(NODE_STRING, PROP_TAX_ID))
        return self.index_quieries

    def add_node_changesets(self):
        id = f'load String Protein from {self.zipfile}, date {self.date_tag}'
        comment = f'load all String Protein from {self.zipfile}'
        query = get_create_update_nodes_query(NODE_STRING, PROP_ID,
                                              PROT_INFO_HEADER,
                                              [NODE_PROTEIN],
                                              datasource=DB_STRING)
        changeset = CustomChangeSet(id, self.author, comment, query,
                                    handler=QUERY_HANDLER,
                                    filename='string-data.tsv',
                                    zipfile=self.zipfile)
        self.change_sets.append(changeset)

    def add_cypher_changesets(self):
        cyphers = Config().get_string_cyphers()
        for key, content in cyphers.items():
            id = f"{key}, data {self.date_tag}"
            desc = content['description']
            query = content['query']
            self.change_sets.append(ChangeSet(id, self.author, desc, query))

    def add_all_change_sets(self):
        self.add_index_changesets()
        self.add_node_changesets()
        self.add_cypher_changesets()


def generate_string_changelogs(data_zip_file):
    task = StringChangeLogsGenerator('rcai', data_zip_file)
    task.add_all_change_sets()
    task.generate_changelog_file(f"string_changelog_{task.date_tag.replace('/', '-')}.xml")


if __name__ == '__main__':
    generate_string_changelogs('jira-LL-4222-string-data-v11.5.zip')



