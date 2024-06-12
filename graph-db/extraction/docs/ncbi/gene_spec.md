# NCBI Gene

The National Center for Biotechnology Information's (NCBI) Gene database (www.ncbi.nlm.nih.gov/gene) integrates gene-specific 
information from multiple data sources. NCBI Reference Sequence (RefSeq) genomes for viruses, prokaryotes and eukaryotes are the 
primary foundation for Gene records in that they form the critical association between sequence and a tracked gene upon which 
additional functional and descriptive content is anchored.  Records in Gene are assigned unique, tracked integers as identifiers. 
(reference: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4383897/)

ftp bulk download link: https://ftp.ncbi.nlm.nih.gov/gene/DATA/

#### NCBI Gene nodes in KG
- Labels: [db_NCBI, Gene, Master]
- Node Properties: id, name, locus_tag, full_name, tax_id, data_source

#### Create new LMDB annotation file
Once NCBI genes were updated, a new LMDB annotation file need to be generated and handle to Binh to update LMDB.
See code in gene_LMDB_annotation.py




