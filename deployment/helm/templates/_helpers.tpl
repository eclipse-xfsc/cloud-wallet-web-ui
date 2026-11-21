{{- define "wallet.hostname" -}}
{{- printf "wallet.%s.%s" (required "global.tenantId is required" .Values.global.tenantId) (required "global.domain is required" .Values.global.domain) -}}
{{- end -}}
{{- define "wallet.name" -}}{{ printf "%s-web-ui" .Release.Name | trunc 44 | trimSuffix "-" }}{{- end -}}
{{- define "wallet.gatewayName" -}}{{ required "gateway.name is required" .Values.gateway.name }}{{- end -}}
{{- define "wallet.gatewayNamespace" -}}{{ required "gateway.namespace is required" .Values.gateway.namespace }}{{- end -}}
{{- define "wallet.tlsSecret" -}}{{ default (printf "%s-tls" (include "wallet.name" .)) .Values.certificate.secretName }}{{- end -}}
{{- define "wallet.labels" -}}
app.kubernetes.io/name: web-ui
app.kubernetes.io/instance: {{ .Release.Name | quote }}
{{- end -}}
{{- define "wallet.listenerSetName" -}}{{ include "wallet.name" . }}-listeners{{- end -}}
