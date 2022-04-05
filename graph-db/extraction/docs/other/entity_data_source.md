# Standardize casing for Entity Data Source and Id (LL-3275)

### Suggested data sources:
- ChEBI
- MeSH
- BioCyc
- UniProt
- NCBI Gene
- NCBI Taxonomy
- PubChem
- Lifelike

### Update data sources
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

call apoc.periodic.iterate(
	"match(n:db_NCBI:Gene) return n",
    "set n.data_source='NCBI Gene'",
    {batchSize: 10000}
);
```