#!/bin/bash

# useful to have APOC procedures
# https://neo4j.com/labs/apoc/4.3/installation/#apoc-core
cp /var/lib/neo4j/labs/apoc-4.3.0.4-core.jar /var/lib/neo4j/plugins/

# for the neosemantics-4.3.0.0.jar
echo "dbms.unmanaged_extension_classes=n10s.endpoint=/rdf" > /var/lib/neo4j/conf/neo4j.conf

/docker-entrypoint.sh neo4j
