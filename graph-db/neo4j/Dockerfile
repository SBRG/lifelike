FROM neo4j:4.3.9-community
LABEL app=kg-neo4j

COPY --chown=neo4j:neo4j . /var/lib/neo4j

RUN chmod +x /var/lib/neo4j/setup-neo4j.sh

USER neo4j

# Perform a backup before running the docker script
ENTRYPOINT ["/sbin/tini", "-g", "--", "/var/lib/neo4j/setup-neo4j.sh"]

CMD ["neo4j"]
