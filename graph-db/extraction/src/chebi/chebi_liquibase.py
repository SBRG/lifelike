from common.liquibase_changelog_generator import *
from common.constants import *
from common.query_builder import *
from zipfile import ZipFile


class ChebiChangeLogsGenerator(ChangeLogFileGenerator):
    def __init__(self, author, zip_data_file: str, initial_load=True):
        ChangeLogFileGenerator.__init__(self, author, zip_data_file, DB_CHEBI, NODE_CHEMICAL, initial_load)
        self.index_quieries = []
        self.logger = logging.getLogger(__name__)

    def get_create_index_queries(self):
        self.index_quieries.append(get_create_constraint_query(NODE_CHEBI, PROP_ID))
        self.index_quieries.append(get_create_constraint_query(NODE_CHEMICAL, PROP_ID))
        self.index_quieries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME))
        self.index_quieries.append(get_create_index_query(NODE_SYNONYM, PROP_LOWERCASE_NAME))
        self.index_quieries.append(get_create_index_query(NODE_CHEBI, PROP_NAME))
        self.index_quieries.append(get_create_index_query(NODE_CHEMICAL, PROP_NAME))
        return self.index_quieries

    def add_node_changesets(self):
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filename = "chebi.tsv"
            with zip.open(filename) as f:
                df = pd.read_csv(f, sep='\t')
                node_changeset = self.get_node_changeset(df, filename, NODE_CHEMICAL, NODE_CHEBI)
                self.change_sets.append(node_changeset)

    def add_synonym_changesets(self):
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filenames = zip.namelist()
            file = "chebi-synonyms.tsv"
            if file in filenames:
                self.change_sets.append(self.get_synonym_changeset(file, NODE_CHEBI))

    def add_relationship_changesets(self):
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filenames = zip.namelist()
            file = "chebi-rels.tsv"
            if file in filenames:
                with zip.open(file) as f:
                    df = pd.read_csv(f, sep='\t')
                    changesets = self.get_relationships_changesets(df, file, NODE_CHEBI, NODE_CHEBI)
                    self.change_sets += changesets


def main():
    task = ChebiChangeLogsGenerator('rcai', "chebi-data-220222.zip")
    task.add_all_change_sets()
    task.generate_changelog_file('chebi_changelog.xml')


if __name__ == '__main__':
    main()

