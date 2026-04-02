#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
SUPERVISOR_EMAIL="${SUPERVISOR_EMAIL:-}"
SUPERVISOR_PASSWORD="${SUPERVISOR_PASSWORD:-}"
AGENT_EMAIL="${AGENT_EMAIL:-}"
AGENT_PASSWORD="${AGENT_PASSWORD:-}"
SUPERVISOR_COOKIE_JAR="${SUPERVISOR_COOKIE_JAR:-${TMPDIR:-/tmp}/aws-connect-insight-supervisor-alerts-cookies.txt}"
AGENT_COOKIE_JAR="${AGENT_COOKIE_JAR:-${TMPDIR:-/tmp}/aws-connect-insight-agent-alerts-cookies.txt}"
RULE_RESPONSE_FILE="${RULE_RESPONSE_FILE:-${TMPDIR:-/tmp}/aws-connect-insight-alert-rule.json}"
SIM_RESPONSE_FILE="${SIM_RESPONSE_FILE:-${TMPDIR:-/tmp}/aws-connect-insight-alert-simulate.json}"
ALERTS_RESPONSE_FILE="${ALERTS_RESPONSE_FILE:-${TMPDIR:-/tmp}/aws-connect-insight-alerts-list.json}"
ACTION="${1:-all}"

RULE_ID=""
CALL_ID=""

print_usage() {
  cat <<EOF
Usage:
  bash backend/scripts/alerts_live_curl_checks.sh [action]

Actions:
  all                 Run the end-to-end live alert flow against a running backend
  health              GET /health
  login-supervisor    POST /api/auth/login as supervisor
  login-agent         POST /api/auth/login as agent
  me-supervisor       GET /api/auth/me using supervisor cookies
  me-agent            GET /api/auth/me using agent cookies
  create-rule         POST /api/alerts/rules for a threshold rule that should trigger on almost any call
  list-rules          GET /api/alerts/rules
  simulate            POST /api/calls/simulate as agent
  list-alerts         GET /api/alerts as supervisor
  verify              Verify stored rule, simulate, and alert responses
  help                Show this help

Required environment variables:
  SUPERVISOR_EMAIL       Existing supervisor email
  SUPERVISOR_PASSWORD    Password for SUPERVISOR_EMAIL
  AGENT_EMAIL            Existing agent email on the same team
  AGENT_PASSWORD         Password for AGENT_EMAIL

Optional environment variables:
  BASE_URL               Backend address. Default: http://localhost:8000
  SUPERVISOR_COOKIE_JAR  File used for supervisor auth cookies
  AGENT_COOKIE_JAR       File used for agent auth cookies
  RULE_RESPONSE_FILE     File used to store created rule JSON
  SIM_RESPONSE_FILE      File used to store simulate response JSON
  ALERTS_RESPONSE_FILE   File used to store alert list JSON

Examples:
  SUPERVISOR_EMAIL=supervisor@example.com SUPERVISOR_PASSWORD=password123 \\
  AGENT_EMAIL=agent@example.com AGENT_PASSWORD=password123 \\
    bash backend/scripts/alerts_live_curl_checks.sh all

  SUPERVISOR_EMAIL=supervisor@example.com SUPERVISOR_PASSWORD=password123 \\
    bash backend/scripts/alerts_live_curl_checks.sh list-rules
EOF
}

section() {
  printf '\n==> %s\n' "$1"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$cmd" >&2
    exit 1
  fi
}

require_supervisor_env() {
  if [[ -z "$SUPERVISOR_EMAIL" || -z "$SUPERVISOR_PASSWORD" ]]; then
    printf 'SUPERVISOR_EMAIL and SUPERVISOR_PASSWORD are required.\n' >&2
    exit 1
  fi
}

require_agent_env() {
  if [[ -z "$AGENT_EMAIL" || -z "$AGENT_PASSWORD" ]]; then
    printf 'AGENT_EMAIL and AGENT_PASSWORD are required.\n' >&2
    exit 1
  fi
}

json_request() {
  local method="$1"
  local endpoint="$2"
  local payload="$3"
  shift 3
  curl -sS -i -X "$method" "$BASE_URL$endpoint" \
    -H "Content-Type: application/json" \
    "$@" \
    --data "$payload"
  printf '\n'
}

health() {
  section "GET /health"
  curl -sS -i "$BASE_URL/health"
  printf '\n'
}

login_supervisor() {
  require_supervisor_env
  section "POST /api/auth/login as supervisor"
  : > "$SUPERVISOR_COOKIE_JAR"
  json_request "POST" "/api/auth/login" \
    "$(printf '{"email":"%s","password":"%s"}' "$SUPERVISOR_EMAIL" "$SUPERVISOR_PASSWORD")" \
    -c "$SUPERVISOR_COOKIE_JAR"
}

login_agent() {
  require_agent_env
  section "POST /api/auth/login as agent"
  : > "$AGENT_COOKIE_JAR"
  json_request "POST" "/api/auth/login" \
    "$(printf '{"email":"%s","password":"%s"}' "$AGENT_EMAIL" "$AGENT_PASSWORD")" \
    -c "$AGENT_COOKIE_JAR"
}

me_supervisor() {
  section "GET /api/auth/me as supervisor"
  curl -sS -i "$BASE_URL/api/auth/me" -b "$SUPERVISOR_COOKIE_JAR"
  printf '\n'
}

me_agent() {
  section "GET /api/auth/me as agent"
  curl -sS -i "$BASE_URL/api/auth/me" -b "$AGENT_COOKIE_JAR"
  printf '\n'
}

create_rule() {
  require_cmd jq
  section "POST /api/alerts/rules"
  local body
  body="$(curl -sS -X POST "$BASE_URL/api/alerts/rules" \
    -H "Content-Type: application/json" \
    -b "$SUPERVISOR_COOKIE_JAR" -c "$SUPERVISOR_COOKIE_JAR" \
    --data '{"type":"sentiment_threshold","severity":"high","sentiment_below":1.0,"is_active":true}')"
  printf '%s\n' "$body" | tee "$RULE_RESPONSE_FILE"
  RULE_ID="$(printf '%s' "$body" | jq -r '.id // empty')"
  printf '\nSaved rule response to %s\n' "$RULE_RESPONSE_FILE"
}

list_rules() {
  section "GET /api/alerts/rules"
  curl -sS "$BASE_URL/api/alerts/rules" -b "$SUPERVISOR_COOKIE_JAR" | tee "$RULE_RESPONSE_FILE"
  printf '\n'
}

simulate() {
  require_cmd jq
  section "POST /api/calls/simulate as agent"
  local body
  body="$(curl -sS -X POST "$BASE_URL/api/calls/simulate" -b "$AGENT_COOKIE_JAR" -c "$AGENT_COOKIE_JAR")"
  printf '%s\n' "$body" | tee "$SIM_RESPONSE_FILE"
  CALL_ID="$(printf '%s' "$body" | jq -r '.call_id // empty')"
  printf '\nSaved simulate response to %s\n' "$SIM_RESPONSE_FILE"
}

list_alerts() {
  section "GET /api/alerts as supervisor"
  curl -sS "$BASE_URL/api/alerts" -b "$SUPERVISOR_COOKIE_JAR" | tee "$ALERTS_RESPONSE_FILE"
  printf '\n'
}

verify() {
  require_cmd jq

  if [[ ! -f "$RULE_RESPONSE_FILE" ]]; then
    printf 'RULE_RESPONSE_FILE does not exist: %s\n' "$RULE_RESPONSE_FILE" >&2
    exit 1
  fi
  if [[ ! -f "$SIM_RESPONSE_FILE" ]]; then
    printf 'SIM_RESPONSE_FILE does not exist: %s\n' "$SIM_RESPONSE_FILE" >&2
    exit 1
  fi
  if [[ ! -f "$ALERTS_RESPONSE_FILE" ]]; then
    printf 'ALERTS_RESPONSE_FILE does not exist: %s\n' "$ALERTS_RESPONSE_FILE" >&2
    exit 1
  fi

  section "Verify created rule"
  jq -e '
    (.id | type == "string" and length > 0) and
    (.type == "sentiment_threshold") and
    (.severity == "high") and
    (.sentiment_below == 1)
  ' "$RULE_RESPONSE_FILE" >/dev/null
  RULE_ID="$(jq -r '.id' "$RULE_RESPONSE_FILE")"
  printf 'rule_id=%s\n' "$RULE_ID"

  section "Verify simulate response"
  jq -e '
    (.call_id | type == "string" and length > 0) and
    (.transcript | type == "array" and length > 0) and
    (.summary | type == "string" and length > 0) and
    (.sentiment_score | type == "number")
  ' "$SIM_RESPONSE_FILE" >/dev/null
  CALL_ID="$(jq -r '.call_id' "$SIM_RESPONSE_FILE")"
  printf 'call_id=%s\n' "$CALL_ID"
  printf 'sentiment_score=%s\n' "$(jq -r '.sentiment_score' "$SIM_RESPONSE_FILE")"

  section "Verify alert list contains triggered alert"
  jq -e --arg rule_id "$RULE_ID" --arg call_id "$CALL_ID" '
    (.alerts | type == "array") and
    (
      .alerts
      | map(
          select(
            .call_id == $call_id and
            .rule_id == $rule_id
          )
        )
      | length >= 1
    )
  ' "$ALERTS_RESPONSE_FILE" >/dev/null

  jq -r --arg rule_id "$RULE_ID" --arg call_id "$CALL_ID" '
    .alerts[]
    | select(
        .call_id == $call_id and
        .rule_id == $rule_id
      )
    | "alert_id=\(.id)\nalert_type=\(.type)\nalert_status=\(.status)\nalert_title=\(.title)"
  ' "$ALERTS_RESPONSE_FILE"
}

all() {
  require_cmd curl
  require_cmd jq
  require_supervisor_env
  require_agent_env

  printf 'BASE_URL=%s\n' "$BASE_URL"
  printf 'SUPERVISOR_EMAIL=%s\n' "$SUPERVISOR_EMAIL"
  printf 'AGENT_EMAIL=%s\n' "$AGENT_EMAIL"
  printf 'SUPERVISOR_COOKIE_JAR=%s\n' "$SUPERVISOR_COOKIE_JAR"
  printf 'AGENT_COOKIE_JAR=%s\n' "$AGENT_COOKIE_JAR"

  health
  login_supervisor
  me_supervisor
  create_rule
  login_agent
  me_agent
  simulate
  list_alerts
  verify
}

case "$ACTION" in
  all)
    all
    ;;
  health)
    health
    ;;
  login-supervisor)
    login_supervisor
    ;;
  login-agent)
    login_agent
    ;;
  me-supervisor)
    me_supervisor
    ;;
  me-agent)
    me_agent
    ;;
  create-rule)
    create_rule
    ;;
  list-rules)
    list_rules
    ;;
  simulate)
    simulate
    ;;
  list-alerts)
    list_alerts
    ;;
  verify)
    verify
    ;;
  help|-h|--help)
    print_usage
    ;;
  *)
    printf 'Unknown action: %s\n\n' "$ACTION" >&2
    print_usage
    exit 1
    ;;
esac
