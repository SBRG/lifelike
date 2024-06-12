# Lifelike-stg database refactoring (LL-3520)

## 1. load data from lifelike-stg-08042021.dump
Stop lifelike-stg, then run the following command:
```
neo4j-admin load --from=lifelike-stg-08042021.dump --database=lifelike-stg --force
```
make sure the data files has owner neo4j
``` 
sudo chown -R neo4j:neo4j databases/lifelike-stg
sudo chown -R neo4j:neo4j transactions/lifelike-stg
```
## 2. open cypher-shell, start lifelike-stg
```
start database `lifelike-stg`;
use lifelike-stg
```

## 3. Run cyphers to merge snippets
At beginning, snippet count is 13974556   

#### add association id: 20 sec + 5 sec
  ``` 
call apoc.periodic.iterate(
 "with ['Chemical', 'Gene', 'Disease'] as entities
 match (n1)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(n2) 
 with a, n1, n2, [l in labels(n1) where l in entities][0] as l1,
 [l in labels(n2) where l in entities][0] as l2
 return a, n1, n2, l1, l2", 
 "set a.id = n1.id + '-' + n2.id + '-' + a.type, a.entry1_type=l1, a.entry2_type=l2",
 {batchSize:10000, parallel: true}
 );
CREATE CONSTRAINT constraint_association_id ON (n:Association) ASSERT n.id IS UNIQUE;
  ```
#### set snippet id: 4 min 
``` 
drop index on :Snippet(id);
call apoc.periodic.iterate(
"match (n:Snippet) return n",
"set n.id = n.pmid + '-' + n.sentence_num", 
{batchSize:5000, parallel: true}
);
create index index_snippet_id for (n:Snippet) on (n.id);
```

#### Set PREDICTS properties: 1 min
``` 
call apoc.periodic.iterate(
"match (n:Snippet)-[p:PREDICTS]-(a) return n, p",
"set p.entry1_text = n.entry1_text, p.entry1_type=n.entry1_type, 
p.entry2_text = n.entry2_text, p.entry2_type=n.entry2_type, p.path = n.path",
{batchSize:5000, parallel: true}
);
```
#### Remove Snippet properties: 1 min
``` 
call apoc.periodic.iterate("match (n:Snippet) return n",
"remove n.path, n.entry1_text, n.entry1_type, n.entry2_text, n.entry2_type, n.sentence_num",
{batchSize:5000, parallel: true}
);
```

#### Merge snippets

apoc.periodic.commit or iterate did not seem to work with apoc refactoring methods.  
Use the following python script: 25 min, final snippets 8106939

```
graph = Graph('bolt://neo4j.lifelike.bio:7687', auth=(username, password), name='lifelike-stg')
query = """
match (n:Snippet) with n.id as id, collect(n) as nodes where size(nodes) > 1 with nodes limit 50000
call apoc.refactor.mergeNodes(nodes, {properties: 'discard', mergeRels:false}) 
               yield node RETURN COUNT(*)
"""
loop = 0
node_cnt = 0
start = datetime.now()
print(start)
while True:
    loop += 1
    print(loop)
    result = graph.run(query).to_series()
    node_ctn += result[0]
    print(node_ctn)
    if result[0] == 0:
        break

elapsed = datetime.now() - start
print(f"Took: {elapsed}")
```
Create snippet id constraint:
```
drop index index_snippet_id;
create constraint constraint_snippet_id on (n:Snippet) assert n.id is unique;
```

## 4. Remove duplicated synonyms

merge synonyms: 1 min
``` 
match (n:Synonym) with n.name as name, collect(n) as nodes where size(nodes) > 1
call apoc.refactor.mergeNodes(nodes, {properties: {name:'discard',`.*`: 'discard'}}) yield node
RETURN COUNT(*);
```
create constraint: 1 min
```
drop index on :Synonym(name);
create constraint constraint_synonym_name on (n:Synonym) assert n.name is unique;
```

## 5. Change relationship PREDICTS to INDICATES: 6.5 min + 5 min
```
call apoc.periodic.iterate(
"match(n:Snippet)-[r:PREDICTS]->(n2) return n, n2, r",
"create (n)-[r2:INDICATES]->(n2) 
set r2.entry1_text = r.entry1_text, r2.entry2_text=r.entry2_text, 
r2.entry1_type = r.entry1_type, r2.entry2_type = r.entry2_type,
r2.path=r.path, r2.raw_score=r.raw_score, r2.normalized_score=r.normalized_score",
{batchSize:5000}
);

call apoc.periodic.iterate(
    "match(n:Snippet)-[r:PREDICTS]->() return r",
    "delete r",
    {batchSize: 5000}
);
```

## 6. Separate Literature data (dormain) from other domains
#### Create constraints
```
create constraint constraint_LiteratureDisease_id on (n:LiteratureDisease) assert n.id is unique;
create constraint constraint_LiteratureChemical_id on (n:LiteratureChemical) assert n.id is unique;
create constraint constraint_LiteratureGene_id on (n:LiteratureGene) assert n.id is unique;
```

#### Create LiteratureChemical
``` 
match(n:Chemical) where (n)-[:ASSOCIATED]-()  
merge (x:LiteratureChemical {id:n.id}) set x:db_Literature, x:LiteratureEntity, x.name = n.name
merge (x)-[:MAPPED_TO]->(n);

match(n:Chemical:db_Literature) where not (n)-[:ASSOCIATED]-()   
merge(x:LiteratureChemical {id:n.id}) set x:db_Literature, x:LiteratureEntity, x.name = n.name
merge (x)-[:MAPPED_TO]->(n);
```

#### Create LiteratureDisease
``` 
match(n:Disease) where (n)-[:ASSOCIATED]-()  
merge (x:LiteratureDisease {id:n.id}) set x:db_Literature, x:LiteratureEntity, x.name = n.name
merge (x)-[:MAPPED_TO]->(n)

match(n:Disease:db_Literature) where not (n)-[:ASSOCIATED]-() 
merge(x:LiteratureDisease {id:n.id}) set x:db_Literature, x:LiteratureEntity, x.name = n.name
merge (x)-[:MAPPED_TO]->(n);
```

#### Create LiteratureGene
``` 
match(n:db_Literature:Gene) 
merge(x:LiteratureGene {id:n.id}) set x:db_Literature, x:LiteratureEntity, x.name = n.name
merge (x)-[:MAPPED_TO]->(n);
```

#### Create LiteratureDisease-Association relationships
25 + 7 sec
```
call apoc.periodic.iterate(
    "match(n:LiteratureDisease)-[:MAPPED_TO]-(d:Disease)<-[:HAS_ASSOCIATION]-(a) return n, a",
    "merge(a)-[:HAS_ASSOCIATION]->(n)",
    {batchSize:5000}
);

call apoc.periodic.iterate(
    "match(n:LiteratureDisease)-[:MAPPED_TO]-(d:Disease)-[:HAS_ASSOCIATION]->(a) return n, a",
    "merge(n)-[:HAS_ASSOCIATION]->(a)",
    {batchSize:5000}
);
```  
remove old disease-association relationship: 5 sec
```
match(n:Disease)-[r:HAS_ASSOCIATION]-(a) delete r
```

#### Create LiteratureChemical-Association relationShips
3 + 23 sec
``` 
call apoc.periodic.iterate(
    "match(n:LiteratureChemical)-[:MAPPED_TO]-(d:Chemical)<-[:HAS_ASSOCIATION]-(a) return n, a",
    "merge(a)-[:HAS_ASSOCIATION]->(n)",
    {batchSize:5000}
);
call apoc.periodic.iterate(
    "match(n:LiteratureChemical)-[:MAPPED_TO]-(d:Chemical)-[:HAS_ASSOCIATION]->(a) return n, a",
    "merge(n)-[:HAS_ASSOCIATION]->(a)",
    {batchSize:5000}
);
```
remove old chemical-associaton relationships: 15 sec
``` 
call apoc.periodic.iterate(
    "match(n:Chemical)-[r:HAS_ASSOCIATION]-() return r",
    "delete r",
    {batchSize: 5000}
);
```

#### Create LiteratureGene-Assocation relationships:
37 + 34 sec
```  
call apoc.periodic.iterate(
    "match(n:LiteratureGene)-[:MAPPED_TO]-(d:Gene)<-[:HAS_ASSOCIATION]-(a) return n, a",
    "merge(a)-[:HAS_ASSOCIATION]->(n)",
    {batchSize:5000}
);

call apoc.periodic.iterate(
    "match(n:LiteratureGene)-[:MAPPED_TO]-(d:Gene)-[:HAS_ASSOCIATION]->(a) return n, a",
    "merge(n)-[:HAS_ASSOCIATION]->(a)",
    {batchSize:5000}
);
```
Remove old Gene-Association relationships: 55 sec
``` 
call apoc.periodic.iterate(
    "match(n:db_Literature:Gene)-[r:HAS_ASSOCIATION]-() return r",
    "delete r",
    {batchSize: 5000}
);
```

There is one gene that had association but not labeled as db_literature (MYC). Create Literature gene for it: 32 sec
```
match(n:Gene) where (n)-[:HAS_ASSOCIATION]-() 
merge (x:LiteratureGene {id:n.id}) set x:db_Literature, x:LiteratureEntity, x.name = n.name
merge (x)-[:MAPPED_TO]->(n);
```
Add the missed associations: < 1 sec
```
match(n:LiteratureGene)-[:MAPPED_TO]-(g:Gene) where not (g:db_Literature) 
with n, g match (g)-[:HAS_ASSOCIATION]->(a) 
merge (n)-[:HAS_ASSOCIATION]->(a);

match(n:LiteratureGene)-[:MAPPED_TO]-(g:Gene) where not (g:db_Literature) 
with n, g match (g)<-[:HAS_ASSOCIATION]-(a) 
merge (a)-[:HAS_ASSOCIATION]->(n);
```
Delete the old asociations that has an entity without db_literature label: < 1 sec
```
match(n:LiteratureGene)-[:MAPPED_TO]-(g:Gene) where not (g:db_Literature) 
with g match (g)-[r:HAS_ASSOCIATION]-(a) delete r
```

#### Create Entity-Entity Associations: 53 sec, 3637074 relationships created
```
call apoc.periodic.iterate(
"match(x:LiteratureEntity)-[:HAS_ASSOCIATION]->(a)-[:HAS_ASSOCIATION]->(y:LiteratureEntity) return x, y, a",
"create (x)-[r:ASSOCIATED]->(y) set r.type = a.type, r.description = a.description",
{batchSize:5000}
);
```


#### Remove old entity-entity associations: 100sec

call apoc.periodic.iterate(
"match (n:LiteratureEntity)-[:ASSOCIATED]->(n2)-[:MAPPED_TO]-(y) with n, n2, y 
 match (n)-[:MAPPED_TO]-(x)-[r:ASSOCIATED]->(y) return r",
"delete r",
{batchSize:5000}
);

#### Remove old db_Literature labels for Gene, Disease and Chemical: < 3 sec

```
match(n:db_Literature:Chemical) remove n:db_Literature;
match(n:db_Literature:Disease) remove n:db_Literature;
match(n:db_Literature:Gene) remove n:db_Literature;
```

## 7. Create dump file, and transfer from dtu server to google cloud serer.
Copy google storage is a lot faster than copying to compute engine

gcloud scp filename neo4j-qa:/mnt/disk/data
or
gsutil cp filename gs://robin-files


__lifelike-after-refactor-08082021.dump (26g)__:  dump file for lifelike, which was restored from google lifelike-stg dump file, then 
performed the above refactoring steps.

__lifelike-copy-08082021.dump (6.8g)__: lifelike was copied to lifelike-stg using neo4j-admin copy --from-database=lifelike, to-database=lifelike-stg --force
The database does not have indexes.  All constraints and indexes need to be re-created.

lifelike-copy-08082021.dump was uploaded to google cloud storage, then downloaded to google vm (neo4j-staging-migration-test)
to perform the following steps

## 8. Create constraints and indexes
``` 
create constraint constraint_association_id on (n:Association) assert n.id is unique;
create constraint constraint_biocyc_biocycId on (n:db_BioCyc) assert n.biocyc_id is unique;
create constraint constraint_biocyc_id on (n:db_BioCyc) assert n.id is unique;
create constraint constraint_chebi_id on (n:db_CHEBI) assert n.id is unique;
create constraint constraint_chemical_id on (n:Chemical) assert n.id is unique;
create constraint constraint_compound_id on (n:Compound) assert n.id is unique;
create constraint constraint_disease_id on (n:Disease) assert n.id is unique;
create constraint constraint_ecnumber_id on (n:EC_Number) assert n.id is unique;
create constraint constraint_enzyme_id on (n:db_Enzyme) assert n.id is unique;
create constraint constraint_gene_id on (n:Gene) assert n.id is unique;
create constraint constraint_genome_id on (n:Genome) assert n.id is unique;
create constraint constraint_go_id on (n:db_GO) assert n.id is unique;
create constraint constraint_kegg_id on (n:db_KEGG) assert n.id is unique;
create constraint constraint_ko_id on (n:KO) assert n.id is unique;
create constraint constraint_literaturechemical_id on (n:LiteratureChemical) assert n.id is unique;
create constraint constraint_literaturedisease_id on (n:LiteratureDisease) assert n.id is unique;
create constraint constraint_literaturegene_id on (n:LiteratureGene) assert n.id is unique;
create constraint constraint_mesh_id on (n:db_MESH) assert n.id is unique;
create constraint constraint_pathway_id on (n:Pathway) assert n.id is unique;
create constraint constraint_protein_id on (n:Protein) assert n.id is unique;
create constraint constraint_pubmed_pmid on (n:db_PubMed) assert n.pmid is unique;
create constraint constraint_publication_pmid on (n:db_Publication) assert n.pmid is unique;
create constraint constraint_snippet_id on (n:Snippet) assert n.id is unique;
create constraint constraint_string_id on (n:db_STRING) assert n.id is unique;
create constraint constraint_synonym_name on (n:Synonym) assert n.name is unique;
create constraint constraint_taxonomy_id on (n:Taxonomy) assert n.id is unique;
create constraint constraint_uniprot_id on (n:db_UniProt) assert n.id is unique;

create index index_biocyc_name for (n:db_BioCyc) on (n.name);  
create index index_biocycclass_name for (n:BioCycClass) on (n.name);
create index index_chebi_name for (n:db_CHEBI) on (n.name); 
create index index_chemical_name for (n:Chemical) on (n.name); 
create index index_compound_name for (n:Compound) on (n.name); 
create index index_disease_name for (n:Disease) on (n.name); 
create index index_ecocyc_biocycid for (n:db_EcoCyc) on (n.biocyc_id);
create index index_ecocyc_id for (n:db_EcoCyc) on (n.id);  
create index index_ecnumber_name for (n:EC_Number) on (n.name); 
create index index_enzyme_name for (n:db_Enzyme) on (n.name); 
create index index_gene_accession for (n:Gene) on (n.accession);
create index index_gene_locustag for (n:Gene) on (n.locus_tag); 
create index index_gene_name for (n:Gene) on (n.name);  
create index index_go_name for (n:db_GO) on (n.name);
create index index_humancyc_biocycid for (n:db_HumanCyc) on (n.biocyc_id);  
create index index_mesh_name for (n:db_MESH) on (n.name);
create index index_pathway_name for (n:Pathway) on (n.name); 
create index index_promoter_name for (n:Promoter) on (n.name);
create index index_protein_name for (n:Protein) on (n.name); 
create index index_pseudomonascyc_biocycid for (n:db_PseudomonasCyc) on (n.biocyc_id); 
create index index_pseudomonascyc_id for (n:db_PseudomonasCyc) on (n.id); 
create index index_rna_name for (n:RNA) on (n.name);
create index index_synonym_lowercase_name for (n:Synonym) on (n.lowercase_name); 
create index index_taxonomy_name for (n:Taxonomy) on (n.name); 
create index index_transcriptionunit_name for (n:TranscriptionUnit) on (n.name);
create index index_uniprot_name for (n:db_UniProt) on (n.name);  
create index index_yeastcyc_biocycid for (n:db_YeastCyc) on (n.biocyc_id);
create index index_yeastcyc_id for (n:db_YeastCyc) on (n.id); 

call db.index.fulltext.createNodeIndex("synonymIdx", ["Synonym"], ["name"]); 
```

## 9. Add 'Master' label for master genes. 
Master genes are link/reference genes for searching and are associated with entities in other data sources

#### Mark all NCBI genes as Master - 3 min
```
call apoc.periodic.iterate(
    "match (n:Gene:db_NCBI) return n",
    "set n:Master",
    {batchSize:10000, parallel: true}
)
```

#### Associate Pseudomonas gene as Master since it cannot map to NCBI genes.
follow the steps described in docs/biocyc/label_biocyc_genes_as_master.md

## 10. Replace all node id property as 'eid'
see "docs/databases/Replace lifelike kg nodes id with eid.md"

## 11. Add tax_id to relationship GO_LINK for enrichment statistics 
The code was in NCBI gene parser and docs/biocyc/label_biocyc_genes_as_master.md (for pseudomonas gene go links)

Update the database with the following query:
``` 
call apoc.periodic.iterate(
"match(n:db_GO)-[r:GO_LINK]-(g:Gene) return g.tax_id as taxid, r",
"set r.tax_id = taxid",
{batchSize: 5000}
)
```


















