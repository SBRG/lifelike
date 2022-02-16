DOCKER_DIR:=$(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
DOCKER_REGISTRY:=us.gcr.io/able-goods-221820

# Base Docker Compose command --------------------------------------------------
#  docker-compose.yml           -> Base services containers
#  docker-compose.services.yml  -> Third party services (PostgreSQL, Neo4j, Elasticsearch, Redis)
#  docker-compose.dev.yml       -> Override base services for local development
COMPOSE_COMMAND=docker-compose -p lifelike \
  -f ${DOCKER_DIR}/docker-compose.yml \
  -f ${DOCKER_DIR}/docker-compose.services.yml
# ------------------------------------------------------------------------------

.PHONY: up up-dev images status logs restart stop exec test down diagram

up: ##@docker Run all containers. [c=<names>]
	${COMPOSE_COMMAND} ${args} up -d ${c}
	@echo "\nTo access Lifelike, point your browser at: http://localhost:8080\n"

up-dev: ##@docker Build and run all container(s) for development. [c=<names>]
	@echo "\nBuilding and running containers...\nThis may take a while if running for the first time. \n"
	@${COMPOSE_COMMAND} -f ${DOCKER_DIR}/docker-compose.dev.yml ${args} up -d --build --wait ${c}
	@echo "\nTo access Lifelike, point your browser at: http://localhost:8080\n"

tag ?= latest
images: ##@docker Build container(s) for distribution.
	@echo "\nBuilding Docker images...\n"
	@cd ${DOCKER_DIR}/../appserver && docker build -t ${DOCKER_REGISTRY}/lifelike-appserver:${tag} .
	@cd ${DOCKER_DIR}/../client && docker build -t ${DOCKER_REGISTRY}/lifelike-frontend:${tag} .
	@cd ${DOCKER_DIR}/../statistical-enrichment && docker build -t ${DOCKER_REGISTRY}/lifelike-statistical-enrichment:${tag} .
	@cd ${DOCKER_DIR}/../cache-invalidator && docker build -t ${DOCKER_REGISTRY}/lifelike-cache-invalidator:${tag} .
	@cd ${DOCKER_DIR} && docker build -t ${DOCKER_REGISTRY}/lifelike-elasticsearch:${tag} -f elasticsearch.Dockerfile .

status: ##@docker Show container(s) status. [c=<names>]
	@${COMPOSE_COMMAND} ${args} ps ${c}

logs: ##@docker Show container(s) logs. [c=<names>]
	@${COMPOSE_COMMAND} ${args} logs -f ${c}

restart: ##@docker Restart container(s). [c=<names>]
	@${COMPOSE_COMMAND} ${args} restart ${c}

stop: ##@docker Stop containers(s). [c=<names>]
	@${COMPOSE_COMMAND} ${args} stop ${c}

exec: ##@docker Execute a command inside a container. [c=<name>, cmd=<command>]
	@${COMPOSE_COMMAND} ${args} exec ${c} ${cmd}

test: up-dev ##@docker Execute test suite
	@${COMPOSE_COMMAND} ${args} exec appserver pytest --cov=neo4japp ${pytest_args}

down: ##@docker Destroy all containers and volumes
	@${COMPOSE_COMMAND} ${args} down --volumes --remove-orphans

diagram: ##@docker Generate an architecture diagram from the Docker Compose files
	@echo "Writing diagram to ${DOCKER_DIR}/diagram.svg"
	@${COMPOSE_COMMAND} config | \
	  echo "version: '3.9'\n$$(cat -)" | \
	  docker run --rm -i funkwerk/compose_plantuml --link-graph --notes --group | \
	  docker run --rm -i think/plantuml > ${DOCKER_DIR}/diagram.svg
