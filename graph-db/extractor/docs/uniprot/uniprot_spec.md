# UniProt data in KG

The UniProt Knowledgebase (UniProtKB) is the central hub for the collection of functional information on proteins, with accurate, 
consistent and rich annotation. https://www.uniprot.org/help/uniprotkb

The UniProt Knowledgebase consists of two sections: 
- Swiss-Prot: a section containing manually-annotated records with information extracted from literature and curator-evaluated computational analysis 
- TrEMBL:  a section with computationally analyzed records that await full manual annotation.

For Lifelike KG, we only loaded Swiss-Prot proteins. 

### Download links:
https://ftp.uniprot.org/pub/databases/uniprot/

The following two files were downloaded for data processing:
- ftp.uniprot.org/pub/databases/uniprot/current_release/knowledgebase/complete/uniprot_sprot.dat.gz
- ftp.uniprot.org/pub/databases/uniprot/current_release/knowledgebase/idmapping/idmapping_selected.tab.gz

### UniProt user manual and data format:
https://www.uniprot.org/docs/userman.htm

### idmapping_selected.tab
It is tab-delimited table which includes the following mappings delimited by tab:

1. UniProtKB-AC
2. UniProtKB-ID
3. GeneID (EntrezGene)
4. RefSeq
5. GI
6. PDB
7. GO
8. UniRef100
9. UniRef90
10. UniRef50
11. UniParc
12. PIR
13. NCBI-taxon
14. MIM
15. UniGene
16. PubMed
17. EMBL
18. EMBL-CDS
19. Ensembl
20. Ensembl_TRS
21. Ensembl_PRO
22. Additional PubMed

Since the file contains data for all uniprot protein, including TrEMBL, we still use the sprot data file for go and tax links 
because currently there are 220M TrEMBL proteins, but less than 600K UniProt proteins. 


