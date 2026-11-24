#!/bin/sh
set -eu
umask 077

# Restrict the alphabet so the key can be written safely as a YAML scalar.
case "${CODEX_GATEWAY_KEY:-}" in
  ''|*[!a-zA-Z0-9_-]*)
    echo 'Set CODEX_GATEWAY_KEY to at least 32 letters, digits, underscores or hyphens.' >&2
    exit 1
    ;;
esac
if [ "${#CODEX_GATEWAY_KEY}" -lt 32 ]; then
  echo 'CODEX_GATEWAY_KEY must contain at least 32 characters.' >&2
  exit 1
fi

mkdir -p /root/.cli-proxy-api
printf '%s\n' \
  'config-version: 8' \
  'server:' \
  '  host: "0.0.0.0"' \
  '  port: 8317' \
  'management:' \
  '  allow-remote: false' \
  '  secret-key: ""' \
  '  disable-control-panel: true' \
  'access:' \
  '  api-keys:' \
  "    - \"${CODEX_GATEWAY_KEY}\"" \
  'oauth:' \
  '  auth-dir: "/root/.cli-proxy-api"' \
  > /CLIProxyAPI/config.yaml

exec /CLIProxyAPI/CLIProxyAPI -config /CLIProxyAPI/config.yaml "$@"
