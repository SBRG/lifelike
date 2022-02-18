# Add BioCyc(Ecoli and Human) protein synonyms as Uniprot Protein Synonyms (LL-3080)

- get only single word synonym, 
- filter out synonyms linked to E coli insert genes (e.g. insA1, insA2, insA3) due to many-many relationships
- filter out synonyms that are ec number, e.g. 3.4.24.-
```
match(n:db_EcoCyc:Gene) where n.name =~'ins[A-Z][0-9]+' with collect(n) as filteredGenes 
match(biocycProt:Protein:db_BioCyc)-[:ENCODES]-(gene)-[:IS]-()-[:HAS_GENE]-(uniProt:db_UniProt) 
where ('db_EcoCyc' in labels(biocycProt) or 'db_HumanCyc' in labels(biocycProt)) and not gene in filteredGenes
with biocycProt, uniProt match (uniProt)-[:HAS_SYNONYM]-(syn) with biocycProt, uniProt, collect(syn) as syns
match (biocycProt)-[:HAS_SYNONYM]-(s) where not s in syns and s.name =~ '[\w-]*'
merge (uniProt)-[:HAS_SYNONYM]->(s)
```
 