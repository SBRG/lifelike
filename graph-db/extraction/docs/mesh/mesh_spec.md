# MeSH data for Neo4j

Medical Subject Headings (MeSH) RDF is a linked data representation of the MeSH biomedical vocabulary produced by 
the National Library of Medicine. MeSH RDF includes a downloadable file in RDF N-Triples format, a SPARQL query editor, 
a SPARQL endpoint (API), and a RESTful interface for retrieving MeSH data.
https://id.nlm.nih.gov/mesh/

MeSH RDF Documentation: https://hhs.github.io/meshrdf/
MeSH download site: https://nlmpubs.nlm.nih.gov/projects/mesh/rdf/

### Steps to load MeSH into Neo4j
#### 1. Install neo4j plugin neosemantics
https://neo4j.com/labs/neosemantics/

    - download jar file version 4.2.0.2 from https://github.com/neo4j-labs/neosemantics/releases. Put the jar file in neo4j plugins folder.
    - add the following line to neo4j.config file, then restart neo4j
    ```
    dbms.unmanaged_extension_classes=n10s.endpoint=/rdf
    ```
#### 2. Create a database 'meshdb' in neo4j
#### 3. Download mesh.nt.gz from the download site, then unzip it into mesh download folder
#### 4. Run MeshParser to import mesh rdf to neo4j database 'meshdb', then load into lifelike (see mesh_parser.py)

#### 5. Clean mesh term synonyms with ',' except for chemicals (LL-2974)
Since the LMDB annotations disease and TopicalDescriptor categories (disease, food, anatomy, phenomena) under tree number ['A', 'C', 'F', 'G'],
the synonyms with comma were deleted under the following categories:

- TopicalDescriptor with tree number starts with ['A', 'C', 'F', 'G']
- Disease
First delete the 'HAS_SYNONYM' relationships, then remove orphan synonyms
```
match(n:TopicalDescriptor)-[:HAS_TREENUMBER]-(t) where left(t.id, 1) in ['A', 'C', 'F', 'G'] 
with distinct n match (n)-[r:HAS_SYNONYM]-(s) where s.name contains ',' 
delete r;

match (n:Disease)-[r:HAS_SYNONYM]-(s) where s.name contains ',' delete r;

match (n:Synonym) where not (n)-[]-() delete n;
```

#### 6. Add annotation entity labels
call function in mesh.mesh_annotations.py

#### 7. Add disease synonym from manually created list (LL-3159)
load additional disease synonyms by pruning 'disease' from synonyms.  The list were manually edited by Sharon.  
use the code mesh.add_disease_synonyms_by_pruning_disease.py

#### 8. Create LMDB annotation files
call functions in mesh_LMDB_annotation.py






