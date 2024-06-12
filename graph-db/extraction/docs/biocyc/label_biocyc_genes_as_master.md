# Label Biocyc Genes as Master Genes (LL-3404)
The following steps are for PseudomonasCyc genes, but similar steps can apply to other biocyc databases 
if NCBI gene links not available, and Lifelike need to search and annotate those genes

- add Master label
```
match(n:db_PseudomonasCyc:Gene) set n:Master;
```

- Link genes with taxnomy nodes
```
match(n:db_PseudomonasCyc:Gene) set n.tax_id = '160488';

match(n:db_PseudomonasCyc:Gene), (t:Taxonomy {id:'160488'}) 
merge (n)-[:HAS_TAXONOMY]->(t);
```

- associate with taxonomy and GO
```
match(n:db_PseudomonasCyc:Gene)-[:ENCODES]-()-[r:GO_LINK]->(go) merge (n)-[r:GO_LINK]->(go) set r.tax_id=n.tax_id;
```
- create links with STRING
```
match(n:db_STRING {tax_id:'160488'}) with n, apoc.text.split(n.id, '\.')[1] as accession match(g:db_PseudomonasCyc:Gene) where g.accession = accession 
merge (n)-[:HAS_GENE]->(g);
```
- set gene uniprot_id property by parsing gene-links.dat file
An additional parser can be created to load gene-links.dat file. For now I just put the code snippet here
(I used Jupyter notebook to run, but it would be better to integrated with other biocyc parsers)
```
file = "~/download/biocyc/pput160488cyc/22.0/data/gene-links.dat"
df = pd.read_table(file, skiprows=12, header=None, names=['id', 'uniprotId', 'geneName', 'none'])
df = df[df.uniprotId.notnull()]
rows = df[['id', 'uniprotId']].to_dict('records')
query = """
with $rows as rows unwind rows as row
match(g:db_PseudomonasCyc {biocyc_id: row.id}), (p:db_UniProt {id:row.uniprotId}) 
return count(*)
"""
database.run_query(query)
```
- Create gene-uniprot links
```
match(n:db_PseudomonasCyc:Gene) with n match (p:db_UniProt {id:n.uniprot_id})
merge (p)-[:HAS_GENE]->(n)
```


