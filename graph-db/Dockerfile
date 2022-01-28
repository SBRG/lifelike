FROM maven:3.8.3-openjdk-11-slim

RUN apt-get update && apt-get install -y vim curl

ENV APPUSER neo4j
ENV APPHOME /home/$APPUSER
ENV UID 1000
ENV GID 1000

# User and group creation
RUN groupadd -g $GID $APPUSER && useradd -u $UID -g $GID -ms /bin/bash $APPUSER

WORKDIR $APPHOME

COPY --chown=1000:1000 migration/ .

RUN cd liquibase-src && mvn clean package -DskipTests && echo "Done building jar..."

USER $APPUSER

# sleep for a bit to allow copying of the jar file (and liquibase migration xml)
# to the host system (using ansible)
# run liquibase on host vm rather than container
# easier for ansible to decrypt the liquibase properties
# and update graph without resource constraints
CMD sleep 300
