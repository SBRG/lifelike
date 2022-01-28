{{- define "lifelike.apiEnv" -}}
{{ include "lifelike.poostgresEnv" . }}
{{ include "lifelike.neo4jEnv" . }}
{{ include "lifelike.redisEnv" . }}
- name: ELASTICSEARCH_URL
  value: {{ include "lifelike.elasticsearchUrl" . }}
- name: PDFPARSER_URL
  value: http://{{ include "lifelike.fullname" . }}-pdfparser:{{ .Values.pdfparser.service.port }}
- name: APPSERVER_URL
  value: http://{{ include "lifelike.fullname" . }}-api:{{ .Values.api.service.port }}
{{- if .Values.ingress.enabled }}
- name: FRONTEND_URL
  value: https://{{ .Values.ingress.hostname }}
{{- end }}
{{- range $envName, $envValue := .Values.api.extraEnv }}
- name: {{ $envName }}
  value: {{ $envValue | quote }}
{{- end -}}
{{- end -}}
