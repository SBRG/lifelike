ARG LIQUIBASE_IMAGE_TAG=4.7.1

# ========================================
# Maven build stage
# ========================================
FROM maven:3.8-jdk-11 as build

# Install dependencies
COPY pom.xml ./
RUN mvn -B dependency:go-offline

# Copy code and build JAR
COPY src ./src
RUN mvn -B clean package -DskipTests


# ========================================
# Liquibase runtime stage
# ========================================
FROM liquibase/liquibase:$LIQUIBASE_IMAGE_TAG
LABEL org.opencontainers.image.source https://github.com/SBRG/lifelike

ARG LIQUIBASE_NEO4J_VERSION=4.7.1.3
ARG NEO4J_JDBC_VERSION=4.0.5

# Install liquibase-neo4j extension
RUN lpm update && lpm add --global liquibase-neo4j@$LIQUIBASE_NEO4J_VERSION

# Download Neo4j JDBC driver
ADD --chown=liquibase:liquibase https://github.com/neo4j-contrib/neo4j-jdbc/releases/download/${NEO4J_JDBC_VERSION}/neo4j-jdbc-driver-${NEO4J_JDBC_VERSION}.jar lib/

# Copy JAR from build stage
COPY --from=build --chown=liquibase:liquibase /target/graphdb-migrator-*.jar ./lib

# Neo4j database configuration
ENV NEO4J_HOST=
ENV NEO4J_USERNAME=neo4j
ENV NEO4J_PASSWORD=neo4j
ENV NEO4J_DATABASE=neo4j

# Master changelog file. e.g. lifelike-graph/changelog-master.xml
ENV CHANGELOG_FILE=

# Remote storage configuration
ENV STORAGE_TYPE=azure
ENV AZURE_ACCOUNT_STORAGE_NAME=
ENV AZURE_ACCOUNT_STORAGE_KEY=

# Storage files prefix (stage or prod)
ENV DATAFILES_PREFIX=stage

# Liquibase configuration
ENV LOG_LEVEL=info

# Add wait-for-it command
ADD --chown=liquibase:liquibase https://raw.githubusercontent.com/vishnubob/wait-for-it/81b1373f17855a4dc21156cfe1694c31d7d1792e/wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# Override parent image entrypoint
COPY --chown=liquibase:liquibase docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

CMD ["update"]
