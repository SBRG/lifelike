# Create HumanCyc graphdb for GDS (LL-3084)
#### 1. Create database humancyc, then load data using biocyc_parser
#### 2. Set displayName
```
match(n:db_BioCyc) set n.displayName = n.name;
match(n:db_Biocyc) where not exists(n.name) set n.displayName = n.biocyc_id;

match(n:Regulation:db_BioCyc)-[:TYPE_OF]-(t) with n, 
case 
    when n.mode='+' then t.id + ' (+)'
    when n.mode='-' then t.id + ' (-)'
    else t.id
end as displayName
set n.displayName = displayName;

match(n:Reaction:db_BioCyc) with n, 
case
    when exists (n.ec_number) then n.ec_number
    when exists (n.name) then n.name
    else n.id
end as displayName
set n.displayName = displayName;

match (n:EnzReaction)-[]-(:Protein)<-[:COMPONENT_OF*0..]-()-[:ENCODES]-(g) 
    with n, collect(distinct g.name) as genes
    with n, case when size(genes)>0 then n.name + ' ('+ apoc.text.join(genes, ',') + ')'
    else n.name END as displayName 
SET n.displayName = displayName;
```
#### 3. Set entity descriptions

    ```
    match(n:Gene)-[:ENCODES]-(x) set n.description = x.name;
    
    match (p)-[:COMPONENT_OF]->(n:Protein) where not exists(n.name)
    with n, collect(p.name) as comps set n.name = 'complex of ' + apoc.text.join(comps, ', ');
    
    match (p)-[:COMPONENT_OF]->(n:Protein) with n, collect(p.displayName) as comps 
    set n.description = 'complex of ' + apoc.text.join(comps, ' and ') ;

    match (n:Reaction) with n match (x)-[:CONSUMED_BY]-(n)-[:PRODUCES]-(y) 
    with n, collect(distinct x.displayName) as c1, collect(distinct y.displayName) as c2,
    case when n.direction = 'REVERSIBLE' then ' <==> '
    when n.direction contains 'RIGHT-TO-LEFT' then ' <== '
    else ' ==> ' end as symbol 
    set n.description = apoc.text.join(c1, ' + ') + symbol + apoc.text.join(c2, ' + ');
    ```
#### 4. Set correction reaction directions
```
drop constraint constraint_biocyc_biocycId;

match (n:Reaction) where n.direction ends with 'RIGHT-TO-LEFT' 
match (n)-[r1:CONSUMED_BY]-(c1), (n)-[r2:PRODUCES]-(c2) where id(c1) <> id(c2)
merge (n)-[:PRODUCES {v:1}]->(c1) merge (c2)-[:CONSUMED_BY {v:1}]->(n) delete r1 delete r2;

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
match (n)-[r1:CONSUMED_BY]-(c1), (n)-[r2:PRODUCES]-(c2) 
merge (n)-[:PRODUCES {v:1}]->(c1) 
merge (c2)-[:CONSUMED_BY {v:1}]->(n) 
delete r1 delete r2;
```
