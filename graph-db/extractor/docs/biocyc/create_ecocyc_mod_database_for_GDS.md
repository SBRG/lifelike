# Create EcoCyc graph database for GDS
The database created was named ecocyc.mod
### Ecocyc.mod
1. load EcoCyc
2. Remove synonyms
3. Set description 
4. Set reaction direction correctly
4. Change TransUnit->Gene to Gene->TransUnit
5. Remove EnzReaction nodes, and connect protein(enzyme) directly with reactions
6. Remove Regulation nodes, connect regulators directly with regulated elements
7. Remove DNABindingSite nodes
8. Remove currency metabolites (optional)
Run the following cypher script after loading ecocyc to neo4j
#### Remove synonyms

```
match(n:Synonym) detach delete n;

```

#### Set description:
```
match (n:Gene:db_EcoCyc)-[:IS]-(g:Gene:db_NCBI) set n.description = g.full_name;

match (n:Gene:db_EcoCyc) where not exists(n.description) or n.description = '-' 
with n match (n)-[:ENCODES]-(p) set n.description = p.name;

match (n:TranscriptionUnit:db_EcoCyc)-[:ELEMENT_OF]-(g:Gene) 
with n, collect(g.description) as descs 
set n.description = 'TranscriptionUnit for ' + apoc.text.join(descs, ' and ');

match (n:Promoter:db_EcoCyc)-[:ELEMENT_OF]->(tu)-[:ELEMENT_OF]-(g:Gene) 
with n, collect(g.description) as descriptions set n.description = 'Promoter for ' + apoc.text.join(descriptions, ' and ');

match (n:Protein:db_EcoCyc)-[:ENCODES]-(g:Gene) where not exists(n.name) set n.name = g.description;

match (p:db_EcoCyc)-[:COMPONENT_OF]->(n:Protein) where not exists(n.name)
with n, collect(p.name) as comps set n.name = 'complex of ' + apoc.text.join(comps, ', ');

match (p:db_EcoCyc)-[:COMPONENT_OF]->(n:Protein) with n, collect(p.displayName) as comps set n.description = 'complex of ' + apoc.text.join(comps, ' and ') ;

match (n:Reaction:db_EcoCyc) with n match (x)-[:CONSUMED_BY]-(n)-[:PRODUCES]-(y) with n, collect(distinct x.displayName) as c1, collect(distinct y.displayName) as c2,
case when n.direction = 'REVERSIBLE' then ' <==> '
when n.direction contains 'RIGHT-TO-LEFT' then ' <== '
else ' ==> ' end as symbol 
set n.description = apoc.text.join(c1, ' + ') + symbol + apoc.text.join(c2, ' + ');

```

#### Set correction reaction directions
```
drop constraint constraint_db_biocyc_biocyc_id;

match (n:Reaction) where n.direction ends with 'RIGHT-TO-LEFT' match (n)-[r1:CONSUMED_BY]-(c1), (n)-[r2:PRODUCES]-(c2) merge (n)-[:PRODUCES]->(c1) merge (c2)-[:CONSUMED_BY]->(n) delete r1 delete r2;

match(n:Reaction) where n.direction = 'REVERSIBLE' with n 
match (n)-[:PRODUCES]-(p), (n)-[:CONSUMED_BY]-(c) where id(p) = id(c) 
with collect(distinct n) as undirectReactions 
match(n:Reaction) where n.direction = 'REVERSIBLE' and not n in undirectReactions 
with collect(n) as inputNodes 
call apoc.refactor.cloneNodesWithRelationships(inputNodes) yield input, output 
return count(*);

match(n:Reaction) with n.id as id, collect(n) as nodes where size(nodes) > 1 with nodes[0] as n 
set n.id = n.biocyc_id + '_r';

match(n:Reaction) where n.id ends with '_r' with n 
match (n)-[r1:CONSUMED_BY]-(c1), (n)-[r2:PRODUCES]-(c2) merge (n)-[:PRODUCES]->(c1) merge (c2)-[:CONSUMED_BY]->(n) delete r1 delete r2;
```
#### Change TransUnit->Gene to Gene->TransUnit
```
match(n:TranscriptionUnit)-[r:ELEMENT_OF]-(g:Gene) merge (n)-[:HAS_GENE]->(g) delete r
```

#### Remove EnzReaction nodes, and connect protein(enzyme) directly with reactions
- check relationships for EnzReaction: CATALYZES and REGULATES, Swith (Regulation)->(EnzReaction) to (Regulation)->(Reaction), then delete EnzReaction

```
match(n:EnzReaction)-[r]-() return distinct type(r);

match (n:Regulation)-[r1:REGULATES]->(e:EnzReaction)-[:CATALYZES]->(r:Reaction) 
merge (n)-[:REGULATES]->(r) delete r1;

match(n:Protein)-[:CATALYZES]->(e:EnzReaction)-[:CATALYZES]->(r) 
merge (n)-[:CATALYZES]->(r)
detach delete e;
```

#### Remove Regulation nodes, connect regulators directly with regulated elements
```
match(x)-[:REGULATES]->(r:Regulation)-[:REGULATES]->(y) where r.mode='+' merge (x)-[:ACTIVATES]->(y);
match(x)-[:REGULATES]->(r:Regulation)-[:REGULATES]->(y) where r.mode='-' merge (x)-[:INHIBITS]->(y);
match(x)-[:REGULATES]->(r:Regulation)-[:REGULATES]->(y) where not exists(r.mode) merge (x)-[:REGULATES]->(y);
match(n:Regulation) detach delete n;
```

#### Remove DNABindingSite nodes
```
match(n:DNABindingSite) detach delete n
```

#### Remove currency metabolites
put currency_metabolites.txt into neo4j import folder 
```
load csv from 'file:///currency_metabolites.txt' as rows match (c:Compound) 
where c.biocyc_id = rows[0] detach delete c
```

