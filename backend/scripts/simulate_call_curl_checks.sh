#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
AUTH_EMAIL="${AUTH_EMAIL:-}"
AUTH_PASSWORD="${AUTH_PASSWORD:-}"
COOKIE_JAR="${COOKIE_JAR:-${TMPDIR:-/tmp}/aws-connect-insight-simulate-cookies.txt}"
SIM_RESPONSE_FILE="${SIM_RESPONSE_FILE:-${TMPDIR:-/tmp}/aws-connect-insight-simulate-response.json}"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
ACTION="${1:-all}"

CALL_ID=""
ANALYSIS_ID=""

print_usage() {
  cat <<EOF
Usage:
  bash backend/scripts/simulate_call_curl_checks.sh [action]

Actions:
  all          Run health, login, simulate, response checks, and database verification
  health       GET /health
  login        POST /api/auth/login
  me           GET /api/auth/me
  simulate     POST /api/calls/simulate
  verify       Validate the last simulate response stored in SIM_RESPONSE_FILE
  verify-db    Read the created call and analysis directly from Supabase REST
  help         Show this help

Required environment variables:
  AUTH_EMAIL     Existing agent email with a team assignment
  AUTH_PASSWORD  Password for AUTH_EMAIL

Optional environment variables:
  BASE_URL                   Backend address. Default: http://localhost:8000
  COOKIE_JAR                 File used to store auth cookies
  SIM_RESPONSE_FILE          File used to store the latest simulate response JSON
  SUPABASE_URL               Supabase project URL for direct database verification
  SUPABASE_SERVICE_ROLE_KEY  Service role key for direct database verification

Examples:
  AUTH_EMAIL=agent@example.com AUTH_PASSWORD=password123 \\
    bash backend/scripts/simulate_call_curl_checks.sh all

  AUTH_EMAIL=agent@example.com AUTH_PASSWORD=password123 \\
    bash backend/scripts/simulate_call_curl_checks.sh simulate

  AUTH_EMAIL=agent@example.com AUTH_PASSWORD=password123 \\
  SUPABASE_URL=https://project.supabase.co \\
  SUPABASE_SERVICE_ROLE_KEY=... \\
    bash backend/scripts/simulate_call_curl_checks.sh verify-db
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

require_auth_env() {
  if [[ -z "$AUTH_EMAIL" || -z "$AUTH_PASSWORD" ]]; then
    printf 'AUTH_EMAIL and AUTH_PASSWORD are required.\n' >&2
    exit 1
  fi
}

json_post() {
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

login() {
  require_auth_env
  section "POST /api/auth/login"
  : > "$COOKIE_JAR"
  json_post "POST" "/api/auth/login" \
    "$(printf '{"email":"%s","password":"%s"}' "$AUTH_EMAIL" "$AUTH_PASSWORD")" \
    -c "$COOKIE_JAR"
}

me() {
  section "GET /api/auth/me"
  curl -sS -i "$BASE_URL/api/auth/me" -b "$COOKIE_JAR"
  printf '\n'
}

simulate() {
  section "POST /api/calls/simulate"
  local body
  body="$(curl -sS -X POST "$BASE_URL/api/calls/simulate" -b "$COOKIE_JAR" -c "$COOKIE_JAR")"
  printf '%s\n' "$body" | tee "$SIM_RESPONSE_FILE"
  CALL_ID="$(printf '%s' "$body" | jq -r '.call_id // empty')"
  printf '\nSaved response to %s\n' "$SIM_RESPONSE_FILE"
}

verify_response() {
  require_cmd jq
  if [[ ! -f "$SIM_RESPONSE_FILE" ]]; then
    printf 'SIM_RESPONSE_FILE does not exist: %s\n' "$SIM_RESPONSE_FILE" >&2
    exit 1
  fi

  section "Verify simulate response JSON"

  jq -e '
    (.call_id | type == "string" and length > 0) and
    (.transcript | type == "array" and length > 0) and
    (.summary | type == "string" and length > 0) and
    (.sentiment_score | type == "number") and
    (.sentiment_label | IN("positive", "neutral", "negative")) and
    (.key_moves | type == "array") and
    (.is_resolved | type == "boolean") and
    (.topics | type == "array") and
    (.keywords | type == "object")
  ' "$SIM_RESPONSE_FILE" >/dev/null

  CALL_ID="$(jq -r '.call_id' "$SIM_RESPONSE_FILE")"

  printf 'call_id=%s\n' "$CALL_ID"
  printf 'sentiment=%s\n' "$(jq -r '.sentiment_label' "$SIM_RESPONSE_FILE")"
  printf 'summary=%s\n' "$(jq -r '.summary' "$SIM_RESPONSE_FILE")"
  printf 'transcript_turns=%s\n' "$(jq '.transcript | length' "$SIM_RESPONSE_FILE")"
  printf 'key_moves=%s\n' "$(jq -c '.key_moves' "$SIM_RESPONSE_FILE")"
  printf 'topics=%s\n' "$(jq -c '.topics' "$SIM_RESPONSE_FILE")"
  printf 'keywords=%s\n' "$(jq -c '.keywords' "$SIM_RESPONSE_FILE")"
}

supabase_get() {
  local path="$1"
  curl -sS "$SUPABASE_URL/rest/v1/$path" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Accept: application/json"
}

verify_db() {
  require_cmd jq
  if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    printf 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for verify-db.\n' >&2
    exit 1
  fi

  if [[ -z "$CALL_ID" && -f "$SIM_RESPONSE_FILE" ]]; then
    CALL_ID="$(jq -r '.call_id // empty' "$SIM_RESPONSE_FILE")"
  fi
  if [[ -z "$CALL_ID" ]]; then
    printf 'No call_id available. Run simulate first.\n' >&2
    exit 1
  fi

  section "Verify created call row in Supabase"
  local calls_json
  calls_json="$(supabase_get "calls?id=eq.$CALL_ID&select=id,agent_id,team_id,transcript,recording_url,duration_seconds,started_at")"
  printf '%s\n' "$calls_json" | jq '.'
  printf '%s' "$calls_json" | jq -e 'length == 1 and .[0].transcript != null and (.[]?.transcript | length > 0)' >/dev/null

  section "Verify analysis row in Supabase"
  local analysis_json
  analysis_json="$(supabase_get "call_analyses?call_id=eq.$CALL_ID&select=id,call_id,summary,sentiment_score,sentiment_label,key_moves,is_resolved")"
  printf '%s\n' "$analysis_json" | jq '.'
  printf '%s' "$analysis_json" | jq -e 'length == 1 and .[0].summary != null and .[0].key_moves != null' >/dev/null
  ANALYSIS_ID="$(printf '%s' "$analysis_json" | jq -r '.[0].id')"

  section "Verify linked topics in Supabase"
  local topics_json
  topics_json="$(supabase_get "call_analysis_topics?call_analysis_id=eq.$ANALYSIS_ID&select=call_analysis_id,topics(name)")"
  printf '%s\n' "$topics_json" | jq '.'

  section "Verify linked keywords in Supabase"
  local keywords_json
  keywords_json="$(supabase_get "call_analysis_keywords?call_analysis_id=eq.$ANALYSIS_ID&select=call_analysis_id,keywords(word)")"
  printf '%s\n' "$keywords_json" | jq '.'
}

all() {
  require_cmd curl
  require_cmd jq
  printf 'BASE_URL=%s\n' "$BASE_URL"
  printf 'AUTH_EMAIL=%s\n' "$AUTH_EMAIL"
  printf 'COOKIE_JAR=%s\n' "$COOKIE_JAR"
  printf 'SIM_RESPONSE_FILE=%s\n' "$SIM_RESPONSE_FILE"
  health
  login
  me
  simulate
  verify_response
  if [[ -n "$SUPABASE_URL" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    verify_db
  else
    printf '\nSkipping direct database verification because Supabase env vars are not set.\n'
  fi
}

case "$ACTION" in
  all)
    all
    ;;
  health)
    health
    ;;
  login)
    login
    ;;
  me)
    me
    ;;
  simulate)
    simulate
    ;;
  verify)
    verify_response
    ;;
  verify-db)
    verify_db
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
