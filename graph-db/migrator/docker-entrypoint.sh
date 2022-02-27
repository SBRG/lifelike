#!/bin/bash
set -e

## This is a modified version of the official Docker entrypoint script.
## Ref: https://github.com/liquibase/docker/blob/ff6b4b8753d4a8a755521bf0e99bf3f03ecbfa08/docker-entrypoint.sh

if type "$1" > /dev/null 2>&1; then
  ## First argument is an actual OS command. Run it
  exec "$@"
else
  if [[ "$*" == *--defaultsFile* ]] || [[ "$*" == *--defaults-file* ]] || [[ "$*" == *--version* ]]; then
    ## Just run as-is
    liquibase "$@"
  else
    ## Validate envrioment variables
    if [ -z "$NEO4J_HOST" ]; then
      echo "NEO4J_HOST environment variable is not set. Please set it to the hostname or IP address of the Neo4j server."
      exit 1
    elif [[ "$NEO4J_HOST" != *":"* ]]; then
      ## If no port is specified, use the default one
      NEO4J_HOST="$NEO4J_HOST:7687"
    fi
    if [ "$STORAGE_TYPE" != "azure" ]; then
      echo "STORAGE_TYPE environment is set to an invalid valie. `azure` is currently only supported."
      exit 1
    fi
    if [ -z "$AZURE_ACCOUNT_STORAGE_NAME" ]; then
      echo "AZURE_ACCOUNT_STORAGE_NAME environment variable is not set. Please set it to the storage account key."
      exit 1
    fi
    if [ -z "$AZURE_ACCOUNT_STORAGE_KEY" ]; then
      echo "AZURE_ACCOUNT_STORAGE_KEY environment variable is not set. Please set it to the storage account key."
      exit 1
    fi

    ## Wait until Neo4j is available
    /wait-for-it.sh "$NEO4J_HOST" --timeout=600 -- echo "Neo4j is up"

    ## Include standard defaultsFile
    liquibase \
      --url="jdbc:neo4j:bolt://$NEO4J_HOST?database=${NEO4J_DATABASE:-neo4j}" \
      --username="$NEO4J_USERNAME" \
      --password="$NEO4J_PASSWORD" \
      --changelog-file="$CHANGELOG_FILE" \
      --log-level="$LOG_LEVEL" \
      --defaults-file=/liquibase/liquibase.docker.properties \
      "$@" \
      -Dneo4jHost="bolt://$NEO4J_HOST" \
      -Dneo4jCredentials="$NEO4J_USERNAME,$NEO4J_PASSWORD" \
      -Dneo4jDatabase="${NEO4J_DATABASE:-neo4j}" \
      -DazureStorageName="$AZURE_ACCOUNT_STORAGE_NAME" \
      -DazureStorageKey="$AZURE_ACCOUNT_STORAGE_KEY" \
      -DlocalSaveFileDir=/tmp \
      -Dliquibase.hub.mode=off \
      -Djava.util.logging.manager=org.apache.logging.log4j.jul.LogManager
  fi
fi
