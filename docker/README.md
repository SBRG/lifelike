# Getting Started with Lifelike using Docker

Docker is an easy way to get started with Lifelike.

## Prerequisites

- [Docker](https://www.docker.com/get-started)

## Run locally

In order to build and bring up all required containers, run the following command after cloning this repository:

Once it's running, you can access the Lifelike UI at [http://localhost:8080](http://localhost:8080) in your browser.
Default username / password is: `admin@example.com` / `password`

```shell
make up
```

```text
Building and running containers...
This may take a while if running for the first time. 

[+] Running 13/13
 ⠿ Network lifelike                             Created
 ⠿ Volume "lifelike_postgres"                   Created
 ⠿ Volume "lifelike_elasticsearch"              Created
 ⠿ Volume "lifelike_neo4j"                      Created
 ⠿ Container lifelike-neo4j-1                   Started
 ⠿ Container lifelike-postgres-1                Started
 ⠿ Container lifelike-pdfparser-1               Started
 ⠿ Container lifelike-elasticsearch-1           Started
 ⠿ Container lifelike-redis-1                   Started
 ⠿ Container lifelike-statistical-enrichment-1  Started
 ⠿ Container lifelike-cache-invalidator-1       Started
 ⠿ Container lifelike-appserver-1               Started
 ⠿ Container lifelike-webserver-1               Started

To access Lifelike, point your browser at: http://localhost:8080
```

## Architecture diagram


![Architecture diagram](diagram.svg)

## Customize

The stack definition is divided into three Docker Compose files:

```tree
├── docker-compose.yml           --> Base core services
├── docker-compose.dev.yml       --> Overrides base core services for local development and debugging.
└── docker-compose.services.yml  --> Adds third party services (PostgreSQL, Neo4j, Elasticsearch, Redis)
```

You may combine them as you need and/or add your own `docker-compose.override.yml` to override any configuration. (this file will be ignored by Git)

## Other Docker operations

You can run `make help` to see other available common operation:

```text
usage: make [target]

docker:
  up                              Build and run container(s). [c=<names>]
  up-dev                          Build and run container(s) for development. [c=<names>]
  images                          Build container(s) for distribution.
  status                          Show container(s) status. [c=<names>]
  logs                            Show container(s) logs. [c=<names>]
  restart                         Restart container(s). [c=<names>]
  stop                            Stop containers(s). [c=<names>]
  exec                            Execute a command inside a container. [c=<name>, cmd=<command>]
  test                            Execute test suite
  down                            Destroy all containers and volumes
  diagram                         Generate an architecture diagram from the Docker Compose files
```
