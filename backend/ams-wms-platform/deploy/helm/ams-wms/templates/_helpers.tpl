{{- define "ams-wms.fullname" -}}
{{ .Release.Name }}-{{ .Chart.Name }}
{{- end -}}
