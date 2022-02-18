# Consistent handling of data source + ID for entities (LL-3554)
- Need to split data source and ID into their own properties.  
- Rename ID to EID = entity ID to avoid confusion with Neo4j internal IDs.

### 1. Drop id constraints
``` 
drop constraint constraint_association_id; 
drop constraint constraint_biocyc_id ;
drop constraint constraint_chebi_id;
drop constraint constraint_chemical_id;
drop constraint constraint_compound_id;
drop constraint constraint_disease_id;
drop constraint constraint_ecnumber_id;
drop constraint constraint_enzyme_id;
drop constraint constraint_gene_id ;
drop constraint constraint_genome_id;
drop constraint constraint_go_id;
drop constraint constraint_kegg_id;
drop constraint constraint_ko_id;
drop constraint constraint_literaturechemical_id;
drop constraint constraint_literaturedisease_id;
drop constraint constraint_literaturegene_id;
drop constraint constraint_mesh_id;
drop constraint constraint_pathway_id;
drop constraint constraint_protein_id;
drop constraint constraint_snippet_id;
drop constraint constraint_string_id;
drop constraint constraint_taxonomy_id;
drop constraint constraint_uniprot_id;

drop index index_ecocyc_id;  
drop index index_pseudomonascyc_id;
drop index index_humancyc_id;  
drop index index_yeastcyc_id;
```


### 2. Extract and set eid:
For CHEBI, MESH and GO, remove the prefix from id
```
match(n:db_CHEBI) with n, apoc.text.split(n.id, ':')[1] as eid set n.eid = eid;
match(n:db_MESH) with n, apoc.text.split(n.id, ':')[1] as eid set n.eid = eid;
match(n:TreeNumber) set n.eid = n.id;
match(n:db_GO) with n, apoc.text.split(n.id, ':')[1] as eid set n.eid = eid, n.data_source='GO';

match(n:db_BioCyc) set n.eid = n.id;
match(n:db_Enzyme) set n.eid = n.id, n.data_source = 'ENZYME';

call apoc.periodic.iterate(
"match(n:db_KEGG) return n",
"set n.eid = id, n.data_source='KEGG'",
{batchSize: 5000}
);

match(n:db_Lifelike) set n.eid = n.id;

call apoc.periodic.iterate(
"match(n:db_NCBI) return n",
"set n.eid = n.id",
{batchSize: 5000}
);

call apoc.periodic.iterate(
"match (n:db_Literature) return n",
"set n.eid = n.id, n.data_source='Literature'",
{batchSize: 5000}
);

match(n:db_RegulonDB) set n.eid = n.id, n.data_source = 'RegulonDB';
match(n:db_STRING) set n.eid = n.id, n.data_source = 'STRING';
match(n:db_UniProt) set n.eid = n.id;
 ```
#### remove node id property
``` 
match(n:db_BioCyc) remove n.id;
match(n:db_CHEBI) remove n.id;
match(n:db_Enzyme) remove n.id; 
match(n:db_GO) remove n.id;

call apoc.periodic.iterate(
"match(n:db_KEGG) return n",
"remove n.id",
{batchSize: 5000}
);

match(n:db_Lifelike) remove n.id;
match(n:db_MESH) remove n.id; 

call apoc.periodic.iterate(
"match(n:db_NCBI) return n",
"remove n.id",
{batchSize: 5000}
);

call apoc.periodic.iterate(
"match (n:db_Literature) return n",
"remove n.id",
{batchSize: 5000}
);

match(n:db_RegulonDB) remove n.id;
match(n:db_STRING) remove n.id;

```

#### recreate constraint and indexes
``` 
create constraint constraint_association_id on (n:Association) assert n.eid is unique;
create constraint constraint_biocyc_id on (n:db_BioCyc) assert n.eid is unique;
create constraint constraint_chebi_id on (n:db_CHEBI) assert n.eid is unique;
create constraint constraint_chemical_id on (n:Chemical) assert n.eid is unique;
create constraint constraint_compound_id on (n:Compound) assert n.eid is unique;
create constraint constraint_disease_id on (n:Disease) assert n.eid is unique;
create constraint constraint_ecnumber_id on (n:EC_Number) assert n.eid is unique;
create constraint constraint_enzyme_id on (n:db_Enzyme) assert n.eid is unique;
create constraint constraint_gene_id on (n:Gene) assert n.eid is unique;
create constraint constraint_genome_id on (n:Genome) assert n.eid is unique;
create constraint constraint_go_id on (n:db_GO) assert n.eid is unique;
create constraint constraint_kegg_id on (n:db_KEGG) assert n.eid is unique;
create constraint constraint_ko_id on (n:KO) assert n.eid is unique;
create constraint constraint_literaturechemical_id on (n:LiteratureChemical) assert n.eid is unique;
create constraint constraint_literaturedisease_id on (n:LiteratureDisease) assert n.eid is unique;
create constraint constraint_literaturegene_id on (n:LiteratureGene) assert n.eid is unique;
create constraint constraint_mesh_id on (n:db_MESH) assert n.eid is unique;
create constraint constraint_pathway_id on (n:Pathway) assert n.eid is unique;
create constraint constraint_protein_id on (n:Protein) assert n.eid is unique;
create constraint constraint_snippet_id on (n:Snippet) assert n.eid is unique;
create constraint constraint_string_id on (n:db_STRING) assert n.eid is unique;
create constraint constraint_taxonomy_id on (n:Taxonomy) assert n.eid is unique;
create constraint constraint_uniprot_id on (n:db_UniProt) assert n.eid is unique;


create index index_ecocyc_id for (n:db_EcoCyc) on (n.eid);  
create index index_pseudomonascyc_id for (n:db_PseudomonasCyc) on (n.eid);
create index index_humancyc_id for (n:db_HumanCyc) on (n.eid);  
create index index_yeastcyc_id for (n:db_YeastCyc) on (n.eid); 
```

