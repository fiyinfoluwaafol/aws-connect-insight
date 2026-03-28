#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
AUTH_EMAIL="${AUTH_EMAIL:-auth-test-$(date +%s)@example.com}"
AUTH_PASSWORD="${AUTH_PASSWORD:-password123}"
AUTH_NEW_PASSWORD="${AUTH_NEW_PASSWORD:-newpassword123}"
RESET_TOKEN="${RESET_TOKEN:-}"
COOKIE_JAR="${COOKIE_JAR:-${TMPDIR:-/tmp}/aws-connect-insight-auth-cookies.txt}"
ACTION="${1:-all}"

print_usage() {
  cat <<EOF
Usage:
  bash backend/scripts/auth_curl_checks.sh [action]

Actions:
  all               Run the main auth flow except reset-email/token steps
  health            GET /health
  register          POST /api/auth/register
  login             POST /api/auth/login
  me                GET /api/auth/me
  refresh           POST /api/auth/refresh
  change-password   PATCH /api/auth/change-password
  logout            POST /api/auth/logout
  forgot-password   POST /api/auth/forgot-password
  reset-password    POST /api/auth/reset-password (requires RESET_TOKEN)
  help              Show this help

Environment variables:
  BASE_URL          Backend address. Default: http://localhost:8000
  AUTH_EMAIL        Test user email. Default: generated timestamp email
  AUTH_PASSWORD     Starting password. Default: password123
  AUTH_NEW_PASSWORD New password for change-password. Default: newpassword123
  RESET_TOKEN       Recovery token for reset-password
  COOKIE_JAR        File used to store cookies between requests

Examples:
  bash backend/scripts/auth_curl_checks.sh all
  AUTH_EMAIL=test@example.com AUTH_PASSWORD=password123 bash backend/scripts/auth_curl_checks.sh login
  RESET_TOKEN=... bash backend/scripts/auth_curl_checks.sh reset-password
EOF
}

section() {
  printf '\n==> %s\n' "$1"
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

plain_post() {
  local method="$1"
  local endpoint="$2"
  shift 2
  curl -sS -i -X "$method" "$BASE_URL$endpoint" "$@"
  printf '\n'
}

health() {
  section "GET /health"
  curl -sS -i "$BASE_URL/health"
  printf '\n'
}

register() {
  section "POST /api/auth/register"
  json_post "POST" "/api/auth/register" \
    "$(printf '{"email":"%s","password":"%s","first_name":"Test","last_name":"User","role":"agent"}' \
      "$AUTH_EMAIL" "$AUTH_PASSWORD")"
}

login() {
  section "POST /api/auth/login"
  : > "$COOKIE_JAR"
  json_post "POST" "/api/auth/login" \
    "$(printf '{"email":"%s","password":"%s"}' "$AUTH_EMAIL" "$AUTH_PASSWORD")" \
    -c "$COOKIE_JAR"
}

login_with_new_password() {
  section "POST /api/auth/login with new password"
  : > "$COOKIE_JAR"
  json_post "POST" "/api/auth/login" \
    "$(printf '{"email":"%s","password":"%s"}' "$AUTH_EMAIL" "$AUTH_NEW_PASSWORD")" \
    -c "$COOKIE_JAR"
}

me() {
  section "GET /api/auth/me"
  curl -sS -i "$BASE_URL/api/auth/me" -b "$COOKIE_JAR"
  printf '\n'
}

refresh() {
  section "POST /api/auth/refresh"
  plain_post "POST" "/api/auth/refresh" -b "$COOKIE_JAR" -c "$COOKIE_JAR"
}

change_password() {
  section "PATCH /api/auth/change-password"
  json_post "PATCH" "/api/auth/change-password" \
    "$(printf '{"current_password":"%s","new_password":"%s"}' \
      "$AUTH_PASSWORD" "$AUTH_NEW_PASSWORD")" \
    -b "$COOKIE_JAR"
}

logout() {
  section "POST /api/auth/logout"
  plain_post "POST" "/api/auth/logout" -b "$COOKIE_JAR" -c "$COOKIE_JAR"
}

forgot_password() {
  section "POST /api/auth/forgot-password"
  json_post "POST" "/api/auth/forgot-password" \
    "$(printf '{"email":"%s"}' "$AUTH_EMAIL")"
}

reset_password() {
  if [[ -z "$RESET_TOKEN" ]]; then
    printf 'RESET_TOKEN is required for reset-password.\n' >&2
    exit 1
  fi

  section "POST /api/auth/reset-password"
  json_post "POST" "/api/auth/reset-password" \
    "$(printf '{"token":"%s","new_password":"%s"}' "$RESET_TOKEN" "$AUTH_NEW_PASSWORD")"
}

all() {
  printf 'BASE_URL=%s\n' "$BASE_URL"
  printf 'AUTH_EMAIL=%s\n' "$AUTH_EMAIL"
  printf 'COOKIE_JAR=%s\n' "$COOKIE_JAR"
  health
  register
  login
  me
  refresh
  change_password
  logout
  login_with_new_password
  me
  logout
}

case "$ACTION" in
  all)
    all
    ;;
  health)
    health
    ;;
  register)
    register
    ;;
  login)
    login
    ;;
  me)
    me
    ;;
  refresh)
    refresh
    ;;
  change-password)
    change_password
    ;;
  logout)
    logout
    ;;
  forgot-password)
    forgot_password
    ;;
  reset-password)
    reset_password
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
