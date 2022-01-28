The cypher scripts below are subjected to change.

# Scripts to set displayName

If a node has property 'name', set it as displayName, otherwise set biocyc_id as displayName
```
match(n:db_BioCyc) set n.displayName = n.name;
match(n:db_Biocyc) where not exists(n.name) set n.displayName = n.biocyc_id
```

Set display name for the following nodes based on other properties or relationships
- Regulation
```
match(n:Regulation:db_BioCyc)-[:TYPE_OF]-(t) with n, 
case 
	when n.mode='+' then t.id + ' (+)'
    when n.mode='-' then t.id + ' (-)'
    else t.id
end as displayName
set n.displayName = displayName      
```

- Reaction
```
match(n:Reaction:db_BioCyc) with n, 
case
	when exists (n.ec_number) then n.ec_number
    when exists (n.name) then n.name
    else n.id
end as displayName
set n.displayName = displayName
```

- TranscriptionUnit
```
match (n:TranscriptionUnit:db_BioCyc)-[:ELEMENT_OF]-(g:Gene) with n, collect(g.name) as genes
with n,
case
	when exists (n.name) then n.name + ' (tu)'
    else apoc.text.join(apoc.coll.sort(genes), '-') + ' (tu)'
end as displayName
set n.displayName = displayName
```

- EnzReaction
```
match (n:EnzReaction)-[]-(:Protein)<-[:COMPONENT_OF*0..]-()-[:ENCODES]-(g) 
    with n, collect(distinct g.name) as genes
    with n, case when size(genes)>0 then n.name + ' ('+ apoc.text.join(genes, ',') + ')'
    else n.name END as displayName 
SET n.displayName = displayName
```

# Set Description

```
match (n:Gene:db_BioCyc)-[:IS]-(g:Gene:db_NCBI) set n.description = g.full_name;

match (n:Gene:db_BioCyc) where not exists(n.description) or n.description = '-' 
with n match (n)-[:ENCODES]-(p) set n.description = p.name;

match (n:TranscriptionUnit:db_BioCyc)-[:ELEMENT_OF]-(g:Gene) 
with n, collect(g.description) as descs 
set n.description = 'TranscriptionUnit for ' + apoc.text.join(descs, ' and ');

match (n:Promoter:db_BioCyc)-[:ELEMENT_OF]->(tu)-[:ELEMENT_OF]-(g:Gene) 
with n, collect(g.description) as descriptions set n.description = 'Promoter for ' + apoc.text.join(descriptions, ' and ');

match (n:Protein:db_BioCyc)-[:ENCODES]-(g:Gene) where not exists(n.name) set n.name = g.description;

match (p)-[:COMPONENT_OF]->(n:Protein:db_BioCyc) where not exists(n.name)
with n, collect(p.name) as comps set n.name = 'complex of ' + apoc.text.join(comps, ', ');

match (p)-[:COMPONENT_OF]->(n:Protein:db_BioCyc) with n, collect(p.displayName) as comps set n.description = 'complex of ' + apoc.text.join(comps, ' and ') ;

match (n:Reaction:db_BioCyc) with n match (x)-[:CONSUMED_BY]-(n)-[:PRODUCES]-(y) with n, collect(distinct x.displayName) as c1, collect(distinct y.displayName) as c2,
case when n.direction = 'REVERSIBLE' then ' <==> '
when n.direction contains 'RIGHT-TO-LEFT' then ' <== '
else ' ==> ' end as symbol 
set n.description = apoc.text.join(c1, ' + ') + symbol + apoc.text.join(c2, ' + ');

match(n:db_BioCyc:EnzReaction)-[:CATALYZES]-(r)
set n.description = n.name +' catalyzed reaction: ' + r.equation;
``