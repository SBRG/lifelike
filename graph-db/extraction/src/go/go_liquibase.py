from common.liquibase_changelog_generator import *
from common.constants import *
from common.query_builder import *
from go.go_parser import *
from zipfile import ZipFile


class GoChangeLogsGenerator(ChangeLogFileGenerator):
    def __init__(self, author, zip_data_file: str, initial_load=True):
        ChangeLogFileGenerator.__init__(self, author, zip_data_file, DB_GO, None, initial_load)
        self.index_quieries = []
        self.logger = logging.getLogger(__name__)

    def get_create_index_queries(self):
        self.index_quieries.append(get_create_constraint_query(NODE_GO, PROP_ID))
        self.index_quieries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME))
        self.index_quieries.append(get_create_index_query(NODE_SYNONYM, PROP_LOWERCASE_NAME))
        self.index_quieries.append(get_create_index_query(NODE_GO, PROP_NAME))
        return self.index_quieries

    def add_node_changesets(self):
        self.logger.info("add node changesets")
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filename = "go.tsv"
            with zip.open(filename) as f:
                df = pd.read_csv(f, sep='\t')
                namespaces = df[PROP_NAMESPACE].drop_duplicates()
                for namespace in namespaces:
                    entity_label = namespace.title().replace('_', '')
                    node_changeset = self.get_node_changeset(df, filename, entity_label, NODE_GO,
                                                             row_filter_col=PROP_NAMESPACE,
                                                             row_filter_val=namespace)
                    self.change_sets.append(node_changeset)

    def add_synonym_changesets(self):
        self.logger.info('add synonym changesets')
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filenames = zip.namelist()
            file = "go-synonyms.tsv"
            if file in filenames:
                self.change_sets.append(self.get_synonym_changeset(file, NODE_GO))

    def add_relationship_changesets(self):
        self.logger.info('add rel changesets')
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filenames = zip.namelist()
            file = "go-rels.tsv"
            if file in filenames:
                with zip.open(file) as f:
                    df = pd.read_csv(f, sep='\t')
                    changesets = self.get_relationships_changesets(df, file, NODE_GO, NODE_GO)
                    self.change_sets += changesets


def main():
    task = GoChangeLogsGenerator('rcai', "go-data-220320.zip")
    task.add_all_change_sets()
    task.generate_changelog_file('go_changelog.xml')


if __name__ == '__main__':
    main()

