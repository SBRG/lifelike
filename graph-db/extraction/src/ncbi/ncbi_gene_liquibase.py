import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
from common.query_builder import *
from ncbi.ncbi_gene_parser import *

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


class NcbiGeneChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        if initial_load:
            self.add_index_change_set()
        self.load_ncbi_gene_nodes()
        self.load_ncbi_gene_synonym_rels()
        self.load_ncbi_gene2go()
        self.add_taxonomy_to_golink_rels()
        self.add_locustag_to_synonym()
        self.load_ncbi_gene_taxonomy_rels()

    def load_ncbi_gene_nodes(self):
        id = f'NCBI gene data on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Load NCBI gene nodes'
        query = get_create_update_nodes_query(NODE_GENE, PROP_ID, NODE_ATTRS, [NODE_NCBI, NODE_MASTER])
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{NCBI_GENE_FILE}')
        self.change_sets.append(changeset)

    def load_ncbi_gene_synonym_rels(self):
        id = f'load NCBI gene synonym relationship on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Load NCBI gene synonym relationship'
        query = get_create_synonym_relationships_query(NODE_GENE, PROP_ID, PROP_ID, 'synonym')
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{NCBI_GENE_SYNONYM_FILE}')
        self.change_sets.append(changeset)

    def load_ncbi_gene2go(self):
        id = f'load NCBI gene to GO on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f'Load NCBI gene to GO'
        query = get_create_relationships_query(NODE_GENE, PROP_ID, 'GeneID', NODE_GO, PROP_ID, 'GO_ID', REL_GO_LINK)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{NCBI_GENE_GO_FILE}')
        self.change_sets.append(changeset)

    def load_ncbi_gene_taxonomy_rels(self):
        id = f'create relationship between gene and taxonomy nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Gene and taxonomy need to be linked; important for annotations etc'
        query = """
        CALL apoc.periodic.iterate(
        'MATCH (n:Gene:db_NCBI), (t:Taxonomy {id:n.tax_id}) RETURN n, t',
        'MERGE (n)-[:HAS_TAXONOMY]->(t)', {batchSize:5000})
        """
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def add_taxonomy_to_golink_rels(self):
        id = f'update GO_LINK rel to have tax_id on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'tax_id is used by statistical enrichment cypher queries'
        query = """
        CALL apoc.periodic.iterate(
        'MATCH (n:db_GO)-[r:GO_LINK]-(g:Gene) RETURN g.tax_id AS taxid, r',
        'SET r.tax_id = taxid', {batchSize: 5000})
        """
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def add_locustag_to_synonym(self):
        id = f'update NCBI gene synonyms to have locus tag name on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'NCBI gene synonym names should be locus tag'
        query = """
        CALL apoc.periodic.iterate(
        'MATCH (n:Gene:db_NCBI) WHERE exists(n.locus_tag) AND n.locus_tag <> '' AND n.locus_tag <> n.name RETURN n',
        'MERGE (s:Synonym {name:n.locus_tag}) SET s.lowercase_name = toLower(n.locus_tag) MERGE (n)-[:HAS_SYNONYM]->(s)',
        {batchSize:10000})
        """
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_GENE, PROP_ID, 'constraint_gene_id') + ';')
        queries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name') + ';')
        queries.append(get_create_index_query(NODE_GENE, PROP_NAME, 'index_gene_name') + ';')
        queries.append(get_create_index_query(NODE_GENE, PROP_LOCUS_TAG, 'index_locus_tag') + ';')
        queries.append(get_create_index_query(NODE_GENE, PROP_TAX_ID, 'index_gene_taxid') + ';')
        return queries

    def add_index_change_set(self):
        id = f'load NCBI gene constraints on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Create constraints and indexes for NCBI gene nodes'
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = NcbiGeneChangeLog('Binh Vu', 'LL-3211')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('ncbi_gene_changelog.xml', directory)
