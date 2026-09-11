#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
usage() {
  printf '%s\n' 'Usage: bash scripts/docker.sh [up|build|down|restart|status|logs|check|help]' \
    '  up       Build, start/update, wait for health and run smoke checks (default)' \
    '  build    Build and test the image without replacing the running container' \
    '  down     Remove this project container/network; keep images and local files' \
    '  restart  Restart the current container, then wait for health and check it' \
    '  status   Show this project status and published URL' \
    '  logs     Follow the last 100 lines (Ctrl-C stops logs, not the container)' \
    '  check    Verify the published HTTP port, assets and local API behavior' \
    'Configuration: .env.docker (optional), default URL http://localhost:8080'
}
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
[[ $# -le 1 ]] || { usage >&2; exit 2; }
ACTION="${1:-up}"
case "$ACTION" in
  help|-h|--help) usage; exit 0 ;;
  up|build|down|restart|status|logs|check) ;;
  *) usage >&2; exit 2 ;;
esac
command -v docker >/dev/null 2>&1 || fail 'Docker is not installed or is not on PATH.'
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2.24+ is required.'
docker info >/dev/null 2>&1 || fail 'Docker engine is unavailable. Start Docker Desktop and retry.'
ENV_FILE="$ROOT/.env.docker.example"
[[ ! -f "$ROOT/.env.docker" ]] || ENV_FILE="$ROOT/.env.docker"
compose() { docker compose --project-directory "$ROOT" --env-file "$ENV_FILE" -f "$ROOT/compose.yaml" -p zhiti-atlas "$@"; }
compose config --quiet

published_url() {
  local binding
  binding="$(compose port atlas 8787)" || return 1
  [[ -n "$binding" ]] || return 1
  printf 'http://%s' "$binding"
}
check() {
  command -v curl >/dev/null 2>&1 || fail 'curl is required to check the published port.'
  local url
  url="$(published_url)" || fail 'No running service found. Run the up command first.'
  curl --fail --silent --show-error --max-time 10 "$url/api/health/status" >/dev/null
  compose exec -T -e "SMOKE_ORIGIN=$url" atlas node scripts/smoke.mjs
  printf 'Atlas is ready: %s\n' "$url"
}
wait_ready() {
  if ! compose up -d --no-build --wait --wait-timeout 120 atlas; then
    compose logs --tail 80 atlas >&2 || true
    fail 'Container did not become healthy; inspect the logs above.'
  fi
}
wait_restarted() {
  local attempt
  for attempt in {1..60}; do
    if compose exec -T atlas node scripts/healthcheck.mjs >/dev/null 2>&1; then return; fi
    sleep 2
  done
  compose logs --tail 80 atlas >&2 || true
  fail 'Restarted container did not become ready within 120 seconds.'
}
case "$ACTION" in
  up) compose build atlas; wait_ready; check ;;
  build) compose build atlas ;;
  down) compose down ;;
  restart)
    [[ -n "$(compose ps -aq atlas)" ]] || fail 'No container found. Run the up command first.'
    compose restart atlas; wait_restarted; check ;;
  status) compose ps -a; if url="$(published_url 2>/dev/null)"; then printf '%s\n' "$url"; fi ;;
  logs) compose logs --tail 100 --follow atlas ;;
  check) check ;;
esac
