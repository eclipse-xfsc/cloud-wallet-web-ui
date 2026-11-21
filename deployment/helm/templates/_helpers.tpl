{{- define "wallet.hostname" -}}
{{- printf "%s.%s" (required "tenantId is required" .Values.tenantId) (required "domain is required" .Values.domain) -}}
{{- end -}}
{{- define "wallet.name" -}}{{ printf "%s-web-ui" .Release.Name | trunc 44 | trimSuffix "-" }}{{- end -}}
{{- define "wallet.gatewayName" -}}
{{- if .Values.gateway.create -}}{{ include "wallet.name" . }}-gateway
{{- else -}}{{ required "gateway.name is required when gateway.create=false" .Values.gateway.name }}{{- end -}}
{{- end -}}
{{- define "wallet.gatewayNamespace" -}}
{{- if .Values.gateway.create -}}{{ .Release.Namespace }}{{- else -}}{{ default .Release.Namespace .Values.gateway.namespace }}{{- end -}}
{{- end -}}
{{- define "wallet.tlsSecret" -}}{{ default (printf "%s-tls" (include "wallet.name" .)) .Values.certificate.secretName }}{{- end -}}
{{- define "wallet.labels" -}}
app.kubernetes.io/name: web-ui
app.kubernetes.io/instance: {{ .Release.Name | quote }}
{{- end -}}
