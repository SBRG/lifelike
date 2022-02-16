# lifelike

Lifelike, a graph-powered knowledge mining platform. Turning big data into contextualized knowledge

![Version: 0.5.0](https://img.shields.io/badge/Version-0.5.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 0.10.4](https://img.shields.io/badge/AppVersion-0.10.4-informational?style=flat-square)

## Installing the Chart

To install the chart with the release name `lifelike`:

```console
helm repo add lifelike https://helm.apps.lifelike.cloud
helm install lifelike lifelike/lifelike
```

## Requirements

Kubernetes: `>=1.20.0-0`

| Repository | Name | Version |
|------------|------|---------|
| https://charts.bitnami.com/bitnami | postgresql | 11.0.4 |
| https://charts.bitnami.com/bitnami | redis | 16.2.0 |
| https://helm.elastic.co | elasticsearch | 7.16.3 |
| https://neo4j-contrib.github.io/neo4j-helm | neo4j | 4.4.3 |

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| ingress | object | `{"annotations":{},"className":"","enabled":false,"hostname":"lifelike.local","tls":[]}` | --------------------------------------------------------------------------- |
| api | object | `{"autoScaling":{"enabled":false,"maxReplicas":4,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80},"dbWaiter":{"image":{"imagePullPolicy":"IfNotPresent","repository":"willwill/wait-for-it","tag":"latest"},"timeoutSeconds":30},"extraEnv":{"INITIAL_ADMIN_EMAIL":"admin@example.com"},"extraVolumeMounts":[],"extraVolumes":[],"image":{"repository":"ghcr.io/sbrg/lifelike-appserver","tag":""},"livenessProbe":{"enabled":true,"failureThreshold":20,"initialDelaySeconds":20,"path":"/meta","periodSeconds":10,"successThreshold":1,"timeoutSeconds":10},"lmdb":{"loadEnabled":false},"podSecurityContext":{"runAsUser":0},"readinessProbe":{"enabled":true,"failureThreshold":20,"initialDelaySeconds":20,"path":"/meta","periodSeconds":10,"successThreshold":1,"timeoutSeconds":10},"replicaCount":1,"resources":{"requests":{"ephemeral-storage":"8Gi"}},"secret":"secret","service":{"port":5000,"type":"ClusterIP"},"strategyType":"RollingUpdate"}` | ---------------------------------------------------------------------------- |
| api.extraEnv | object | `{"INITIAL_ADMIN_EMAIL":"admin@example.com"}` | Extra environment variables to pass to the appserver |
| api.lmdb.loadEnabled | bool | `false` | Load LMDB data from storage when initializing |
| api.replicaCount | int | `1` | Number of replicas running the appserver |
| api.autoScaling.enabled | bool | `false` | If enabled, value at api.replicaCount will be ignored |
| api.strategyType | string | `"RollingUpdate"` | if using some PV that does not support readWriteMany, set this to 'Recreate' |
| api.resources | object | `{"requests":{"ephemeral-storage":"8Gi"}}` | Optional resources requests and limits |
| frontend | object | `{"autoScaling":{"enabled":false,"maxReplicas":5,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80},"image":{"repository":"ghcr.io/sbrg/lifelike-frontend","tag":""},"livenessProbe":{"enabled":true,"failureThreshold":20,"initialDelaySeconds":20,"path":"/","periodSeconds":10,"successThreshold":1,"timeoutSeconds":10},"readinessProbe":{"enabled":true,"failureThreshold":20,"initialDelaySeconds":20,"path":"/","periodSeconds":10,"successThreshold":1,"timeoutSeconds":10},"replicaCount":1,"resources":{},"service":{"port":80,"type":"ClusterIP"}}` | ---------------------------------------------------------------------------- |
| statisticalEnrichment | object | `{"image":{"repository":"ghcr.io/sbrg/lifelike-statistical-enrichment","tag":""},"livenessProbe":{"enabled":true,"failureThreshold":20,"initialDelaySeconds":20,"path":"/healthz","periodSeconds":10,"successThreshold":1,"timeoutSeconds":10},"readinessProbe":{"enabled":true,"failureThreshold":20,"initialDelaySeconds":20,"path":"/healthz","periodSeconds":10,"successThreshold":1,"timeoutSeconds":10},"replicaCount":1,"resources":{},"service":{"port":5000,"type":"ClusterIP"}}` | ---------------------------------------------------------------------------- |
| pdfparser | object | `{"autoScaling":{"enabled":false,"maxReplicas":4,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80},"image":{"repository":"ghcr.io/sbrg/lifelike-pdfparser","tag":"latest"},"livenessProbe":{"enabled":true,"failureThreshold":20,"initialDelaySeconds":20,"path":"/","periodSeconds":10,"successThreshold":1,"timeoutSeconds":10},"readinessProbe":{"enabled":true,"failureThreshold":20,"initialDelaySeconds":20,"path":"/","periodSeconds":10,"successThreshold":1,"timeoutSeconds":10},"replicaCount":1,"resources":{},"service":{"port":7600,"type":"ClusterIP"}}` | ---------------------------------------------------------------------------- |
| postgresqlExternal | object | `{"database":"postgres","existingSecret":"","host":"postgres.local","password":"password","port":5432,"user":"postgres"}` | ---------------------------------------------------------------------------- |
| neo4jExternal.host | string | `"neo4j.local"` |  |
| neo4jExternal.port | int | `7687` |  |
| neo4jExternal.user | string | `"neo4j"` |  |
| neo4jExternal.password | string | `"password"` |  |
| neo4jExternal.database | string | `"neo4j"` |  |
| redisExternal.host | string | `"redis.local"` |  |
| redisExternal.port | int | `6379` |  |
| redisExternal.password | string | `""` |  |
| elasticsearchExternal.host | string | `"elasticsearch.local"` |  |
| elasticsearchExternal.port | int | `9200` |  |
| elasticsearchExternal.user | string | `""` |  |
| elasticsearchExternal.password | string | `""` |  |
| elasticsearchExternal.ssl | bool | `false` |  |
| postgresql | object | `{"auth":{"database":"database","postgresPassword":"password"},"enabled":true}` | ---------------------------------------------------------------------------- |
| postgresql.enabled | bool | `true` | Set to false to disable automatic deployment of PostgreSQL |
| neo4j | object | `{"core":{"numberOfServers":1,"persistentVolume":{"size":"100Gi"},"standalone":true},"enabled":true,"imageTag":"4.4.3-community","neo4jPassword":"password"}` | ---------------------------------------------------------------------------- |
| elasticsearch | object | `{"enabled":true,"esConfig":{"elasticsearch.yml":"node.store.allow_mmap: false\n"},"fullnameOverride":"elasticsearch","image":"ghcr.io/sbrg/lifelike-elasticsearch","imageTag":"7.16.3","volumeClaimTemplate":{"resources":{"requests":{"storage":"30Gi"}}}}` | ---------------------------------------------------------------------------- |
| redis | object | `{"auth":{"password":"password"},"commonConfiguration":"# Disable persistence to disk\nsave \"\"\n# Disable AOF https://redis.io/topics/persistence#append-only-file\nappendonly no","enabled":true,"master":{"extraFlags":["--maxmemory-policy allkeys-lru"],"persistence":{"enabled":false}},"replica":{"extraFlags":["--maxmemory-policy allkeys-lru"],"persistence":{"enabled":false}}}` | ---------------------------------------------------------------------------- |

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.7.0](https://github.com/norwoodj/helm-docs/releases/v1.7.0)
