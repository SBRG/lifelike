import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
from common.query_builder import *
from kegg.kegg_parser import *
from kegg.kegg_data_loader import *

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


class KeggChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        if initial_load:
            self.add_index_change_set()
        self.load_gene_nodes()
        self.load_ko_nodes()
        self.load_genome_nodes()
        self.load_pathway_nodes()
        self.load_gene2ko_rels()
        self.load_gene2ncbi_rels()
        self.load_ko2pathway_rels()
        self.load_genome2pathway_rels()

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_KEGG, PROP_ID, "constraint_kegg_id") + ';')
        queries.append(get_create_constraint_query(NODE_KO, PROP_ID, 'constraint_ko_id') + ';')
        queries.append(get_create_constraint_query(NODE_PATHWAY, PROP_ID, 'constraint_pathway_id') + ';')
        queries.append(get_create_constraint_query(NODE_GENE, PROP_ID, 'constraint_gene_id') + ';')
        queries.append(get_create_constraint_query(NODE_GENOME, PROP_ID, 'constraint_genome_id') + ';')
        queries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name') + ';')
        queries.append(get_create_constraint_query(NODE_PATHWAY, PROP_NAME, 'index_pathway_name') + ';')
        return queries

    def add_index_change_set(self):
        id = "KEGG data initial load " + datetime.today().strftime("%m%d%Y")
        comment = "Create constraints and indexes for kegg nodes"
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)

    def load_gene_nodes(self):
        id = 'load kegg genes ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + id
        comment = 'Load KEGG gene nodes'
        query = KeggDataLoader.get_load_gene_query()
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{GENE_FILE}')
        self.change_sets.append(changeset)

    def load_genome_nodes(self):
        id = 'load kegg genomes ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + id
        comment = 'Load KEGG genome nodes'
        query = KeggDataLoader.get_load_geneome_query()
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{GENOME_FILE}')
        self.change_sets.append(changeset)

    def load_ko_nodes(self):
        id = 'load kegg ko ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG KO nodes'
        query = KeggDataLoader.get_load_ko_query()
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{KO_FILE}')
        self.change_sets.append(changeset)

    def load_pathway_nodes(self):
        id = 'load kegg pathways ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG pathway nodes'
        query = KeggDataLoader.get_load_pathway_query()
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{PATHWAY_FILE}')
        self.change_sets.append(changeset)

    def load_gene2ko_rels(self):
        id = 'load kegg gene2ko ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG gene to ko relationships'
        query = KeggDataLoader.get_load_gene2ko_query()
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{GENE2KO_FILE}')
        self.change_sets.append(changeset)

    def load_ko2pathway_rels(self):
        id = 'load kegg ko2pathway ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG KO to pathway relationships'
        query = KeggDataLoader.get_load_ko2pathway_query()
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{KO2PATHWAY_FILE}')
        self.change_sets.append(changeset)

    def load_genome2pathway_rels(self):
        id = 'load kegg genome2pathway ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG genome to pathway relationships'
        query = KeggDataLoader.get_load_gene2ko_query()
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{GENOME2PATHWAY_FILE}')
        self.change_sets.append(changeset)

    def load_gene2ncbi_rels(self):
        id = 'load kegg gene2ncbigene ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG gene to NCBI gene relationships'
        query = KeggDataLoader.get_load_gene2ko_query()
        changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{GENE_FILE}')
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = KeggChangeLog('robin cai', 'LL-1234')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('kegg_changelog.xml', directory)
