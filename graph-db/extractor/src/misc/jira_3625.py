import csv
import os

from collections import defaultdict

from common.cloud_utils import azure_upload
from common.database import get_database, Database
from common.utils import get_data_dir


MESH_QUERY = """
MATCH (n:db_MESH)-[r:HAS_SYNONYM]-(s:Synonym)
WHERE NOT n:GlobalInclusion
WITH n, r, [l IN labels(n) WHERE NOT l IN ['db_MESH', 'TopicalDescriptor', 'TreeNumber']] AS labels
WHERE size(labels) >= 1
RETURN DISTINCT n.eid AS entity_id, labels AS node_labels,
    exists(r.global_inclusion) AS is_global, collect(DISTINCT r.entity_type) AS edge_entity_types
"""

COMPOUND_QUERY = """
MATCH (n:Compound)-[r:HAS_SYNONYM]-(s:Synonym)
WHERE NOT n:GlobalInclusion
WITH n, r, s, [l IN labels(n) WHERE NOT l starts with 'db_' and l <> 'BioCycClass'] as labels
WHERE size(labels) >= 1 
RETURN DISTINCT n.eid AS entity_id, labels AS node_labels,
    exists(r.global_inclusion) AS is_global, collect(DISTINCT r.entity_type) AS edge_entity_types
"""

CHEMICAL_QUERY = """
MATCH (n:Chemical)-[r:HAS_SYNONYM]-(s:Synonym)
WHERE NOT n:GlobalInclusion
WITH n, r, s, [l IN labels(n) WHERE NOT l starts WITH 'db_' AND NOT l IN ['TopicalDescriptor', 'GlobalInclusion']] as labels
WHERE size(labels) >= 1
RETURN DISTINCT n.eid AS entity_id, labels AS node_labels,
    exists(r.global_inclusion) AS is_global, collect(DISTINCT r.entity_type) AS edge_entity_types
"""

PROTEIN_QUERY = """
MATCH (n:Protein)-[r:HAS_SYNONYM]-(s:Synonym)
WHERE NOT n:GlobalInclusion
WITH n, r, s, [l IN labels(n) WHERE NOT l starts with 'db_' and l <> 'Complex'] as labels
WHERE size(labels) >= 1
RETURN DISTINCT n.eid AS entity_id, labels AS node_labels,
exists(r.global_inclusion) AS is_global, collect(DISTINCT r.entity_type) AS edge_entity_types
"""

# GENE_QUERY = """
# MATCH (n:Gene)-[r:HAS_SYNONYM]-(s:Synonym)
# WHERE NOT n:GlobalInclusion
# WITH n, r, s, [l IN labels(n) WHERE NOT l starts with 'db_' and l <> 'Master'] as labels
# WHERE size(labels) >= 1
# RETURN DISTINCT n.eid AS entity_id, labels AS node_labels,
# exists(r.global_inclusion) AS is_global, collect(DISTINCT r.entity_type) AS edge_entity_types
# """

# TAXONOMY_QUERY = """
# MATCH (n:Taxonomy)-[r:HAS_SYNONYM]-(s:Synonym)
# WHERE NOT n:GlobalInclusion
# WITH n, r, s, [l IN labels(n) WHERE NOT l starts with 'db_'] as labels
# WHERE size(labels) >= 1
# RETURN DISTINCT n.eid AS entity_id, labels AS node_labels,
# exists(r.global_inclusion) AS is_global, collect(DISTINCT r.entity_type) AS edge_entity_types
# """


"""File is used to execute generic queries and create
a TSV data file.

The data file is then uploaded to a cloud storage (e.g Azure),
where the migration will pull from and use.
"""
def create_data_file(db: Database, filepath: str, query: str):
    with open(filepath, 'w', newline='\n') as tsvfile:
        results = db.get_data(query)
        writer = csv.writer(tsvfile, delimiter='\t', quotechar='"')
        writer.writerow(['entity_id', 'entity_type'])

        # a node could have 2+ entity labels (rare)
        # but at the same time, a global inclusion could've
        # been made by mistake
        #
        # if node_id: list(is_global) are all false
        # then safe to assume node has valid 2+ entity labels
        node_id_global = defaultdict(set)
        node_id_labels = {}
        node_id_edge_entity_type = defaultdict(set)
        for index, row in results.iterrows():
            node_id_global[row.entity_id].add(row.is_global)
            node_id_labels[row.entity_id] = row.node_labels
            node_id_edge_entity_type[row.entity_id] = node_id_edge_entity_type[row.entity_id].union(
                set(entity_type for entity_type in row.edge_entity_types))

        del results

        for entity_id, global_set in node_id_global.items():
            if True not in global_set:
                writer.writerow([entity_id, '|'.join(label for label in node_id_labels[entity_id])])
            else:
                if len(node_id_labels[entity_id]) == 1:
                    writer.writerow([entity_id, '|'.join(label for label in node_id_labels[entity_id])])
                else:
                    writer.writerow([entity_id, '|'.join(
                        label for label in set(node_id_labels[entity_id]) - node_id_edge_entity_type[entity_id])])


if __name__ == '__main__':
    db = get_database()
    for prefix, query in [('mesh', MESH_QUERY), ('compound', COMPOUND_QUERY), ('chemical', CHEMICAL_QUERY), ('protein', PROTEIN_QUERY)]:
        filename = f'prod-jira-LL-3625-add-entity-type-array-{prefix}.tsv'
        filepath = os.path.join(get_data_dir(), filename)
        create_data_file(db, filepath, query)
        azure_upload(filename, filepath)
