# NCBI Taxonomy

The NCBI Taxonomy database (http://www.ncbi.nlm.nih.gov/taxonomy) is the standard nomenclature and classification repository 
for the International Nucleotide Sequence Database Collaboration (INSDC), comprising the GenBank, ENA (EMBL) and DDBJ databases. 
It includes organism names and taxonomic lineages for each of the sequences represented in the INSDC's nucleotide and protein
sequence databases (reference: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3245000/).    

#### Top lavel taxonomy:
- Archaea
- Bacteria
- Eukaryota
- Viruses
- Other: Other artificial sequences
- Unclassified

The organism classification should include the first 4 catagories, and remove taxnomy with name "environmental samples".  

NCBI taxonomy download link: https://ftp.ncbi.nlm.nih.gov/pub/taxonomy/new_taxdump/

#### NCBI Taxonomy Nodes in KG: 
- Labels:  [db_NCBI, Taxonomy]
- Node Properties:
    - id: tax_id
    - name: scientific name
    - rank: In biological classification, taxonomic rank is the relative level of a group of organisms (a taxon) in a taxonomic hierarchy. 
    Examples of taxonomic ranks are species, genus, family, order, class, phylum, kingdom, domain, etc.
    - species_id: species tax_id, only for organism with rank as species or below species
    - data_source: NCBI Taxonomy
    
#### Taxonomy parser improvement
- The current parser could be rewritten using pandas. 
- Currently the data were parsed and written into files.  The parser then used the output file to load data.  The output
files could be eliminated and neo4j data loading could be done using the parsed data directly

#### Additional synonyms for strains (no rank, children nodes under species) (LL-1802)
combined all synonyms from species as string, and added as synonym for children nodes.  This could help children nodes search
using a species synonym which is not part of strain synonym. Not sure if we need to update this for each taxnomy updates. 
```
 match (n:Taxonomy) where n.rank='species' and (()-[:HAS_PARENT]->(n))
        with n match (n)-[:HAS_SYNONYM]->(s) with n, collect(s.name) as syns
        match (t)-[:HAS_PARENT*1..]->(n)
        with n, syns, t
        match (t)-[:HAS_SYNONYM]->(s)
        with t, syns, apoc.text.join(collect(s.name), '|') as synonym
        with t, synonym, [s in syns where not synonym contains s] as syns where size(syns)>0
        with t, apoc.text.join([synonym] + syns, '|') as syn where size(syn) < 9000
        merge (s:Synonym {name:syn})
        merge (t)-[:HAS_SYNONYM {type:'combined terms'}]->(s) 
```

#### LMDB Annotation file
In the LMDB file, set the species' tax_id as the default strain id so that any searching for the species will map to the default strain

| Strain tax_id | strain_name | species_id | species_name | 
|:------ |: ---------- |: --------- |: ----------- | 
| 367830 | Staphylococcus aureus subsp. aureus USA300 | 46170 | Staphylococcus aureus subsp. aureus | 
| 367830 | Staphylococcus aureus subsp. aureus USA300 | 1280 | Staphylococcus aureus | 
| 511145 | Escherichia coli str. K-12 substr. MG1655 | 83333 | Escherichia coli K-12 | 
| 511145 | Escherichia coli str. K-12 substr. MG1655 | 562 | Escherichia coli | 
| 272563 | Clostridioides difficile 630 | 1496 | Clostridioides difficile | 
| 208964 | Pseudomonas aeruginosa PAO1 | 287 | Pseudomonas aeruginosa | 
| 559292 | Saccharomyces cerevisiae S288C | 4932 | Saccharomyces cerevisiae |  

See taxonomy_LMDB_annotation.py to generate LMDB annotation file



    
 












