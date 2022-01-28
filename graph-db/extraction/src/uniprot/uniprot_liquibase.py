import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
from common.query_builder import (
    get_create_constraint_query,
    get_create_index_query,
    get_create_relationships_query,
    get_create_synonym_relationships_query,
    get_create_update_nodes_query
)
from uniprot.uniprot_parser import (
    UNIPROT_FILE,
    UNIPROT_2_GENE,
    UNIPROT_2_GO,
    UNIPROT_SYNONYM,
    UNIPROT_SYNONYM_DERIVED
)

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


class UniprotChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        if initial_load:
            self.add_index_change_set()
        self.load_protein_data()
        self.load_protein_genes()
        self.load_protein_synonyms()
        self.load_protein_synonym_rel()
        self.load_protein_to_go_rel()
        self.load_protein_to_taxonomy_rel()

    def load_protein_data(self):
        id = f'load UniProt protein on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        cols = [PROP_ID, PROP_NAME, PROP_TAX_ID, PROP_PATHWAY, PROP_FUNCTION]
        query = get_create_update_nodes_query(NODE_UNIPROT, PROP_ID, cols, [NODE_PROTEIN], datasource=DB_UNIPROT, original_entity_types=[NODE_PROTEIN])
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{UNIPROT_FILE}')
        self.change_sets.append(changeset)

    def load_protein_genes(self):
        id = f'load UniProt protein/gene on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = ''
        query = get_create_relationships_query(NODE_UNIPROT, PROP_ID, PROP_ID, NODE_GENE, PROP_ID, PROP_GENE_ID, REL_GENE)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{UNIPROT_2_GENE}')
        self.change_sets.append(changeset)

    def load_protein_synonyms(self):
        for filename, text in [(UNIPROT_SYNONYM, ''), (UNIPROT_SYNONYM_DERIVED, 'derived')]:
            id = f'load UniProt protein/gene synonyms {text} on date {self.date_tag}'
            if self.id_prefix:
                id = f'{self.id_prefix} {id}'
            comment = ''
            query = get_create_synonym_relationships_query(NODE_UNIPROT, PROP_ID, PROP_ID, PROP_NAME, [PROP_TYPE])
            changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{filename}')
            self.change_sets.append(changeset)

    def load_protein_synonym_rel(self):
        id = f'load UniProt protein/synonym relationship on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Create a synonym relationships for Protein id and name'
        query = """
        CALL apoc.periodic.iterate(
        'MATCH (n:%s) RETURN n',
        'MERGE (s1:Synonym {name:n.name}) MERGE (s2:Synonym {name:n.eid}) MERGE (n)-[:HAS_SYNONYM]->(s1) MERGE (n)-[:HAS_SYNONYM]->(s2)',
        {batchSize:5000})
        """ % (NODE_UNIPROT)
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def load_protein_to_go_rel(self):
        id = f'load UniProt protein-GO on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Create relationship between protein and GO'
        query = get_create_relationships_query(NODE_UNIPROT, PROP_ID, PROP_ID, NODE_GO, PROP_ID, PROP_GO_ID, REL_GO_LINK)
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{UNIPROT_2_GO}')
        self.change_sets.append(changeset)

    def load_protein_to_taxonomy_rel(self):
        id = f'load UniProt protein/taxonomy relationship on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Create a synonym relationship for Protein and Taxonomy'
        query = """
        CALL apoc.periodic.iterate(
        'MATCH (n:%s), (t:%s {id: n.tax_id}) RETURN n,t',
        'MERGE (n)-[:%s]->(t)', {batchSize:5000})
        """ % (NODE_UNIPROT, NODE_TAXONOMY, REL_TAXONOMY)
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_UNIPROT, PROP_ID, 'constraint_uniprot_id') + ';')
        queries.append(get_create_index_query(NODE_UNIPROT, PROP_NAME, 'index_uniprot_name') + ';')
        queries.append(get_create_index_query(NODE_PROTEIN, PROP_NAME, 'index_protein_name') + ';')
        queries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name') + ';')
        return queries

    def add_index_change_set(self):
        id = f'load UniProt constraints on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Create constraints and indexes for UniProt data'
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = UniprotChangeLog('Binh Vu', 'LL-3210')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('uniprot_changelog.xml', directory)
