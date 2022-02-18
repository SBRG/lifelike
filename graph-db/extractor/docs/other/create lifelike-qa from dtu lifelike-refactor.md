# LL-3272 Build Lifelike-qa from Lifelike-refactor.dump (dtu)

1. Clean data
- Remove user-input data from database
```
match(n:UserData) detach delete n;
match(n:Worksheet) detach delete n;
match(n:TestViralProtein) detach delete n;
match(n:TestHumanProtein) detach delete n;
```
- drop failed index
```
drop index classIdx
```

2. Update GO
Run go_parser
```
parser = GoOboParser("/Users/rcai/data")
database = get_database(Neo4jInstance.LOCAL, 'lifelike-qa')
parser.load_data_to_neo4j(database)
database.close()
```

2. Update NCBI genes to match with lifelike-staging
- remove all gene synonyms
```
call apoc.periodic.iterate(
"match(n:db_NCBI:Gene)-[r:HAS_SYNONYM]-() return r",
"delete r",
{batchSize: 5000}
)
```

3. Update CHEBI
Run chebi_parser
```
    parser = ChebiOboParser("/Users/rcai/data")
    # use the right database
    database = get_database(Neo4jInstance.LOCAL, 'lifelike-qa')
    parser.load_data_to_neo4j(database)
    database.close()
```

4. Update MESH nodes  with additional annotation labels
Run mesh_annotations.py
```
    database = get_database(Neo4jInstance.LOCAL, 'lifelike-qa')
    add_annotation_entity_labels(database)
    database.close()
```

5. Remove extra db_Literature node label
```
match(n:db_Literature) where none(l in labels(n) where l 
in ['LiteratureEntity', 'Association', 'Snippet', 'AssociationType', 'Publication']) 
remove n:db_Literature
```

6. Delete orphan synonyms
```
call apoc.periodic.iterate(
    "match(n:Synonym) where not (n)-[]-() return n",
    "delete n",
    {batchSize: 5000}
)
``` 

7. Update synonyms
- Delete single-letter synonym relationships to non-chemicals
```
call apoc.periodic.iterate(
"match(n:Synonym)-[r:HAS_SYNONYM]-(x) where size(n.name) = 1 and not x:Chemical return r",
"delete r",
{batchSize:5000}
);
```
- add biocyc protein abbrev_name as synonym
```
match(n:db_BioCyc:Protein) where exists (n.abbrev_name) 
        merge(s:Synonym {name:n.abbrev_name})
        merge (n)-[:HAS_SYNONYM]->(s)
```

- add uniprot protein name and id as synonym
```
call apoc.periodic.iterate(
    "match(n:db_UniProt) return n",
    "merge (s:Synonym {name:n.name}) merge (n)-[:HAS_SYNONYM]->(s)",
    {batchSize: 10000}
);
call apoc.periodic.iterate(
    "match(n:db_UniProt) return n",
    "merge (s:Synonym {name:n.id}) merge (n)-[:HAS_SYNONYM]->(s)",
    {batchSize: 10000}
);

```

- add biocyc protein single-word synonyms as UniProt protein synonyms
since EcoCyc has many insert genes (e.g. insA1, insA2, insA3) , excluded those due to many-to-many relationship for gene and synonyms
```
match(n:db_EcoCyc:Gene) where n.name =~'ins[A-Z][0-9]+' with collect(n) as filteredGenes 
match(biocycProt:Protein:db_BioCyc)-[:ENCODES]-(gene)-[:IS]-()-[:HAS_GENE]-(uniProt:db_UniProt) 
where (biocycProt:db_HumanCyc or biocycProt:db_EcoCyc) and not gene in filteredGenes
with biocycProt, uniProt match (uniProt)-[:HAS_SYNONYM]-(syn) with biocycProt, uniProt, collect(syn) as syns
match (biocycProt)-[:HAS_SYNONYM]-(s) where not s in syns and s.name =~ '[\w-]*' 
merge (uniProt)-[:HAS_SYNONYM]->(s)
```

- add disease synonyms
run add_disease_synonyms.py
```
    file = os.path.join(get_data_dir(), 'Pruned mesh_terms_ends_with_disease.csv')
    database = get_database(Neo4jInstance.LOCAL, 'lifelike-qa')
    load_pruned_terms_as_disease_synonym(file, database)
    database.close()
```

- remove synonym with empty name
```
match(n:Synonym) where n.name = '' detach delete n
```

### Drop index for decrease dump data size
drop index synonymIdx;
drop index namesEvidenceAndId;
drop index index_taxonomy_species_id;
drop index index_synonym_lowercasename;
drop index index_gene_taxid;

drop index on :Gene(name);
drop index on :Gene(locus_tag);
drop index on :Protein(name);
drop index on :Taxonomy(name);

### After load dump file to neo4j, re-create indexes
create index index_synonym_lowercasename for (n:Synonym) on (n.lowercase_name);
create index index_gene_name for (n:Gene) on (n.name);
create index index_taxonomy_name for (n:Taxonomy) on (n.name);
create index index_protein_name for (n:Protein) on (n.name);
create index index_gene_taxid for (n:Gene) on (n.tax_id);


### Add node data_source properties
```
call apoc.periodic.iterate(
	"match(n:db_BioCyc) return n",
    "set n.data_source='BioCyc'",
    {batchSize: 10000}
);

call apoc.periodic.iterate(
	"match(n:db_CHEBI) return n",
    "set n.data_source='ChEBI'",
    {batchSize: 10000}
);

call apoc.periodic.iterate(
	"match(n:db_MESH) return n",
    "set n.data_source='MeSH'",
    {batchSize: 10000}
);

call apoc.periodic.iterate(
	"match(n:db_UniProt) return n",
    "set n.data_source='UniProt'",
    {batchSize: 10000}
);

call apoc.periodic.iterate(
	"match(n:db_NCBI:Taxonomy) return n",
    "set n.data_source='NCBI Taxonomy'",
    {batchSize: 10000}
);




```












