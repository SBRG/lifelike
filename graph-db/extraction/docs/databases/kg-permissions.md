# Set up database permissions

Run cypher-shell:
```
show databases; 
show users;

GRANT ALL GRAPH PRIVILEGES ON GRAPH `ecocyc-plus` TO humelifelike;
GRANT ACCESS ON DATABASE `ecocyc-plus` TO humelifelike;
GRANT CREATE NEW RELATIONSHIP TYPE ON DATABASE `ecocyc-plus` TO humelifelike;
GRANT CREATE NEW PROPERTY NAME ON DATABASE `ecocyc-plus` TO humelifelike;
GRANT CREATE NEW NODE LABEL ON DATABASE `ecocyc-plus` TO humelifelike;


GRANT ALL GRAPH PRIVILEGES ON GRAPH `ecocyc-mod` TO humelifelike;
GRANT ACCESS ON DATABASE `ecocyc-mod` TO humelifelike;
GRANT CREATE NEW RELATIONSHIP TYPE ON DATABASE `ecocyc-mod` TO humelifelike;
GRANT CREATE NEW PROPERTY NAME ON DATABASE `ecocyc-mod` TO humelifelike;
GRANT CREATE NEW NODE LABEL ON DATABASE `ecocyc-mod` TO humelifelike;
```


