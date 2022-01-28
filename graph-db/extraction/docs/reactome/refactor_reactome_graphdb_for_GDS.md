# Modify Reactome database for GDS (LL-3119)

### 1. Remove "un-needed" nodes and labels
- Remove label: DatabaseObject
    ```
    call apoc.periodic.iterate(
    "match(n:DatabaseObject) return n", 
    'remove n:DatabaseObject', 
    {batchSize: 5000, parallel:True}
    )
    ```
- Remove nodes: InstanceEdit (parallel failed)
    ```
    call apoc.periodic.iterate(
    "match(n:InstanceEdit) return n", 
    'detach delete n', 
    {batchSize: 1000}
    )
    ```
- Remove person, publication etc.
    ```
    match(n:Affiliation) detach delete n;
    match(n:Person) detach delete n;
    match(n:Publication) detach delete n;
    ```
    
- Remove all Tax 
    ```
    match(n:Taxon) detach delete n
    ```
    
- Remove all non-human events 
All events have property 'speciesName'.  
```
match(n:Event) where n.speciesName <> 'Homo sapiens' detach delete n
```
    
- Remove non-human PhysicalEntity
4783 physical entities did not have speciesName, including SimpleEntity and others. Keep them. 
```
match(n:PhysicalEntity) where  exists (n.speciesName) and n.speciesName <> 'Homo sapiens' detach delete n
```

### 2. Set commonName and compartment properties
- Set PhysicalEntity common name, and create index
```
match(n:PhysicalEntity) set n.commonName = n.name[0]
```

- Set compartment property
    ```
    match(n:PhysicalEntity)-[r:compartment]-(x)  
    with n, collect(x.name) as gos set n.compartment = gos;
    match(n:PhysicalEntity)-[r:compartment]-(x) delete r;
    
    match(n:Event)-[r:compartment]-(x)  
    with n, collect(x.name) as gos set n.compartment = gos;
    match(n:Event)-[r:compartment]-(:GO_Term) delete r
    ```
  
### 3. Set GNE, RNA, Protein and Chemical labels
```
match(n:EntityWithAccessionedSequence) where (n)-[:referenceEntity]-(:ReferenceDNASequence) set n:Gene;
match(n:EntityWithAccessionedSequence) where (n)-[:referenceEntity]-(:ReferenceRNASequence) set n:RNA;
match(n:EntityWithAccessionedSequence) where (n)-[:referenceEntity]-(:ReferenceGeneProduct) set n:Protein;

match(n:SimpleEntity) set n:Chemical;
```

### 4. Reverse a few relationshps for better traversal
```
match(n:Complex)-[r:hasComponent]->(x) merge (x)-[:componentOf]->(n) delete r;
match(n:EntitySet)-[r:hasMember]->(x) merge (x)-[:memberOf]->(n) delete r;
match(n:ReactionLikeEvent)-[r:catalystActivity]->(x) merge (x)-[:catalyzes]->(n) delete r;
match (n:CatalystActivity)-[r:physicalEntity]->(x) merge (x)-[:catalystOf]->(n) delete r;
match (n:CatalystActivity)-[r:activeUnit]->(x) merge (x)-[:activeUnitOf]->(n) delete r
match (n)-[r:regulatedBy]->(x:Regulation) merge (x)-[:regulates]->(n) delete r;
match(n:Regulation)-[r:regulator]->(x) merge (x)-[:regulatorOf]->(n) delete r;
match(n:Regulation)-[r:activeUnit]->(x) merge (x)-[:activeUnitOf]->(n) delete r;
```

### 5. Removed referredTo relationships:
```
match (n)-[r:inferredTo]->(m) delete r
```

### 6. Refactor 'translocate' and 'transport' reactions with EntitySet in both input and output
- Mark reaction nodes to refactor
```
match(n:ReactionLikeEvent {category: 'transition'}) where (n.displayName contains 'transport') or (n.displayName contains 'translocate') 
with n match (s1:EntitySet)-[:input]-(n)-[:output]-(s2:EntitySet) 
set n.refactorStatus = 'refactored'
```
67 nodes were marked with property refactorStatus = 'refactored'

-- Drop constraints and create indexes instead
With unique constraints for dbId and stId, cloning nodes would fail.
```
drop constraint on (n:Event) assert n.dbId is unique;
drop constraint on (n:Event) assert n.stId is unique;
drop constraint on (n:ReactionLikeEvent) assert n.dbId is unique;
drop constraint on (n:ReactionLikeEvent) assert n.stId is unique;
drop constraint on (n:Reaction) assert n.dbId is unique;
drop constraint on (n:Reaction) assert n.stId is unique;

create index for (n:ReactionLikeEvent) on (n.dbId);
create index for (n:ReactionLikeEvent) on (n.stId);
````

-- Clone reactions and add input-output relationships
```
match(n:ReactionLikeEvent {refactorStatus: 'refactored'}) 
with n match (s1:EntitySet)-[:input]-(n)-[:output]-(s2:EntitySet) 
with n, s1, s2 match (s1)<-[:memberOf]-(m1), (s2)<-[:memberOf]-(m2) 
where (m1)-[:referenceEntity]-()-[:referenceEntity]-(m2)
with n, m1, m2 call apoc.refactor.cloneNodes([n]) yield input, output as n2
set n2.refactorStatus = 'added'
merge (m1)-[:input]->(n2)-[:output]->(m2)
return count(*)
```
276 nodes added

-- add regulates relationships to newly created nodes
```
match(n:ReactionLikeEvent {refactorStatus: 'refactored'})-[:regulates]-(r) 
with n, r match (n2:ReactionLikeEvent) where n2.dbId = n.dbId and n2.refactorStatus = 'added'
merge (r)-[:regulates]->(n2)
```
2 relationships added

-- add catalyzes relationships to newly created nodes
```
match(n:ReactionLikeEvent {refactorStatus: 'refactored'})-[:catalyzes]-(c) 
with n, c match (n2:ReactionLikeEvent) where n2.dbId = n.dbId and n2.refactorStatus = 'added'
merge (c)-[:catalyzes]->(n2)
```
236 relationships created

# additinal changes (local lifelike-stg instance reactome-human) 
```
create constraint constraint_synonym_name on (n:Synonym) assert (n.name) is Unique;
match(n:ReferenceGeneProduct) with n unwind n.geneName as synonym 
merge (s:Synonym {name:synonym}) merge (n)-[:HAS_SYNONYM]->(s);

call apoc.periodic.iterate(
    "match(n:PhysicalEntity) unwind n.name as syn return n, syn",
    "merge(s:Synonym {name:syn}) merge (n)-[:HAS_SYNONYM]->(s)",
    {batchSize: 5000}
)
```


### Based on Christian's code, the following changes made
8/24/2021
- Change hasCandidate to candidateOf, reverse
- Change requiredInputComponent to requiredInput, reverse
- Change repeatedUnit to repeatedUnitOf, reverse
``` 
match(n)-[r:hasCandidate]->(x) merge (x)-[:candidateOf]->(n) delete r;
match(n)-[r:requiredInputComponent]->(x) merge (x)-[:requiredInput]->(n) delete r;
match(n)-[r:repeatedUnit]->(x) merge (x)-[:repeatedUnitOf]->(n) delete r
```

9/15/2021
set nodeLabel for display 
``` 
match(n:Protein) set n.nodeLabel ='Protein';
match(n:Gene) set n.nodeLabel='Gene';
match(n:ReferenceGeneProduct) set n.nodeLabel = 'Gene';
match(n:Chemical) set n.nodeLabel = 'Chemical';
match(n:Complex) set n.nodeLabel = 'Complex';
match(n:EntitySet) set n.nodeLabel = 'EntitySet';
match(n:Polymer) set n.nodeLabel = 'Polymer';
match(n:ProteinDrug) set n.nodeLabel = 'Protein';
match(n:ChemicalDrug) set n.nodeLabel = 'Chemical';
match(n:RNA) set n.nodeLabel = 'RNA';
match(n:PhysicalEntity) where not exists (n.nodeLabel) set n.nodeLabel = 'Entity'

match(n:ReactionLikeEvent) set n.nodeLabel = 'Reaction';
match(n:CatalystActivity) set n.nodeLabel = 'CatalystActivity';
match(n:Regulation) set n.nodeLabel = 'Regulation';
match(n:Pathway) set n.nodeLabel = 'Pathway';
```