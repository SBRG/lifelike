# lifelike

Lifelike, a graph-powered knowledge mining platform. Turning big data into contextualized knowledge

![Version: 0.4.6](https://img.shields.io/badge/Version-0.4.6-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 0.10.0](https://img.shields.io/badge/AppVersion-0.10.0-informational?style=flat-square)

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
| https://charts.bitnami.com/bitnami | postgresql | 10.16.2 |
| https://charts.bitnami.com/bitnami | redis | 16.2.0 |
| https://helm.elastic.co | elasticsearch | 7.16.3 |
| https://neo4j-contrib.github.io/neo4j-helm | neo4j | 4.4.3 |

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| global | object | `{}` |  |
| nameOverride | string | `""` |  |
| fullnameOverride | string | `""` |  |
| ingress | object | `{"annotations":{},"className":"","enabled":false,"hostname":"lifelike.local","tls":[]}` | --------------------------------------------------------------------------- |
| api | object | `{"autoScaling":{"enabled":false,"maxReplicas":4,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80},"dbWaiter":{"image":{"imagePullPolicy":"IfNotPresent","repository":"willwill/wait-for-it","tag":"latest"},"timeoutSeconds":30},"extraEnv":{"INITIAL_ADMIN_EMAIL":"admin@example.com"},"extraVolumeMounts":[],"extraVolumes":[],"image":{"repository":"us.gcr.io/able-goods-221820/lifelike-appserver","tag":""},"livenessProbe":{"enabled":true,"path":"/meta"},"lmdb":{"loadEnabled":false},"podSecurityContext":{"fsGroup":1000,"runAsUser":1000},"readinessProbe":{"enabled":true,"path":"/meta"},"replicaCount":1,"resources":{},"secret":"secret","service":{"port":5000,"type":"ClusterIP"},"strategyType":"RollingUpdate"}` | ---------------------------------------------------------------------------- |
| api.extraEnv | object | `{"INITIAL_ADMIN_EMAIL":"admin@example.com"}` | Extra environment variables to pass to the appserver |
| api.replicaCount | int | `1` | Number of replicas running the appserver |
| api.autoScaling.enabled | bool | `false` | If enabled, value at api.replicaCount will be ignored |
| api.strategyType | string | `"RollingUpdate"` | if using some PV that does not support readWriteMany, set this to 'Recreate' |
| api.livenessProbe.enabled | bool | `true` | Set to false to disable liveness probes |
| api.readinessProbe.enabled | bool | `true` | Set to false to disable readiness probes |
| frontend | object | `{"autoScaling":{"enabled":false,"maxReplicas":5,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80},"image":{"repository":"us.gcr.io/able-goods-221820/lifelike-frontend","tag":""},"livenessProbe":{"enabled":true,"path":"/"},"readinessProbe":{"enabled":true,"path":"/"},"replicaCount":1,"service":{"port":80,"type":"ClusterIP"}}` | ---------------------------------------------------------------------------- |
| frontend.livenessProbe.enabled | bool | `true` | Set to false to disable liveness probes |
| pdfparser | object | `{"autoScaling":{"enabled":false,"maxReplicas":4,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80},"image":{"repository":"us.gcr.io/able-goods-221820/lifelike-pdfparser","tag":"latest"},"livenessProbe":{"enabled":true,"path":"/"},"readinessProbe":{"enabled":true,"path":"/"},"replicaCount":1,"service":{"port":7600,"type":"ClusterIP"}}` | ---------------------------------------------------------------------------- |
| pdfparser.replicaCount | int | `1` | Number of replicas running, ignored if autoScaling is enabled |
| pdfparser.autoScaling | object | `{"enabled":false,"maxReplicas":4,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80}` | Horizontal pod autoscaler configuration |
| pdfparser.autoScaling.enabled | bool | `false` | Set to true to enable autoscaling, ignoring pdfparser.replicaCount |
| pdfparser.livenessProbe.enabled | bool | `true` | Set to false to disable liveness probes |
| statisticalEnrichment | object | `{"image":{"repository":"us.gcr.io/able-goods-221820/lifelike-statistical-enrichment","tag":""},"livenessProbe":{"enabled":true,"path":"/healthz"},"readinessProbe":{"enabled":true,"path":"/healthz"},"replicaCount":1,"resources":{},"service":{"port":5000,"type":"ClusterIP"}}` | ---------------------------------------------------------------------------- |
| statisticalEnrichment.livenessProbe.enabled | bool | `true` | Set to false to disable liveness probes |
| statisticalEnrichment.readinessProbe.enabled | bool | `true` | Set to false to disable readiness probes |
| worker | object | `{"autoScaling":{"enabled":false,"maxReplicas":4,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80},"image":{"repository":"us.gcr.io/able-goods-221820/lifelike-worker","tag":""},"replicaCount":1}` | ---------------------------------------------------------------------------- |
| worker.replicaCount | int | `1` | Number of running replicas, ignored if autoScaling is enabled |
| worker.autoScaling | object | `{"enabled":false,"maxReplicas":4,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80}` | Horizontal pod autoscaler configuration |
| worker.autoScaling.enabled | bool | `false` | Set to true to enable autoscaling, ignoring pdfparser.replicaCount |
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
| postgresql | object | `{"enabled":true,"postgresqlDatabase":"postgres","postgresqlPassword":"password"}` | ---------------------------------------------------------------------------- |
| postgresql.enabled | bool | `true` | Set to false to disable automatic deployment of PostgreSQL |
| neo4j | object | `{"core":{"numberOfServers":1,"persistentVolume":{"size":"100Gi"},"standalone":true},"enabled":true,"imageTag":"4.4.3-community","neo4jPassword":"password"}` | ---------------------------------------------------------------------------- |
| elasticsearch | object | `{"enabled":true,"esConfig":{"elasticsearch.yml":"node.store.allow_mmap: false\n"},"fullnameOverride":"elasticsearch","image":"us.gcr.io/able-goods-221820/lifelike-elasticsearch","imageTag":"7.16.3","volumeClaimTemplate":{"resources":{"requests":{"storage":"30Gi"}}}}` | ---------------------------------------------------------------------------- |
| redis | object | `{"auth":{"password":"password"},"commonConfiguration":"# Disable persistence to disk\nsave \"\"\n# Disable AOF https://redis.io/topics/persistence#append-only-file\nappendonly no","enabled":true,"master":{"extraFlags":["--maxmemory-policy allkeys-lru"],"persistence":{"enabled":false}},"replica":{"extraFlags":["--maxmemory-policy allkeys-lru"],"persistence":{"enabled":false}}}` | ---------------------------------------------------------------------------- |

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.7.0](https://github.com/norwoodj/helm-docs/releases/v1.7.0)
