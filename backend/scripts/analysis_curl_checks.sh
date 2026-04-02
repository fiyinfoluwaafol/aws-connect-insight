#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
MODEL="${MODEL:-gpt-5-mini}"
ACTION="${1:-all}"
PAYLOAD_FILE="${PAYLOAD_FILE:-}"

print_usage() {
  cat <<EOF
Usage:
  bash backend/scripts/analysis_curl_checks.sh [action]

Actions:
  all             Run all built-in transcript checks
  positive        POST /api/analysis with a positive/account-help transcript
  neutral         POST /api/analysis with a neutral/password-reset transcript
  negative        POST /api/analysis with a frustrated/escalation transcript
  custom-file     POST /api/analysis using PAYLOAD_FILE=/path/to/payload.json
  help            Show this help

Environment variables:
  BASE_URL        Backend address. Default: http://localhost:8000
  MODEL           OpenAI model to send. Default: gpt-5-mini
  PAYLOAD_FILE    JSON file for custom-file action

Examples:
  bash backend/scripts/analysis_curl_checks.sh all
  MODEL=gpt-5-mini bash backend/scripts/analysis_curl_checks.sh negative
  PAYLOAD_FILE=/tmp/analysis-payload.json bash backend/scripts/analysis_curl_checks.sh custom-file
EOF
}

section() {
  printf '\n==> %s\n' "$1"
}

post_json() {
  local payload="$1"
  curl -sS -i -X POST "$BASE_URL/api/analysis" \
    -H "Content-Type: application/json" \
    --data "$payload"
  printf '\n'
}

positive() {
  section "POST /api/analysis (positive transcript)"
  post_json "$(cat <<EOF
{
  "model": "$MODEL",
  "transcript": [
    {
      "speaker": "Customer",
      "text": "Hi, I am having trouble getting into my account after I changed phones."
    },
    {
      "speaker": "Agent",
      "text": "I can help with that. Let me walk you through verifying your account and getting you signed back in."
    },
    {
      "speaker": "Customer",
      "text": "Thank you, I appreciate it."
    },
    {
      "speaker": "Agent",
      "text": "Your account is verified now and I have reset the sign-in method. Please try again."
    },
    {
      "speaker": "Customer",
      "text": "That worked. I am back in now."
    }
  ]
}
EOF
)"
}

neutral() {
  section "POST /api/analysis (neutral transcript)"
  post_json "$(cat <<EOF
{
  "model": "$MODEL",
  "transcript": [
    {
      "speaker": "Customer",
      "text": "I need to reset my password but I am not sure which email is on the account."
    },
    {
      "speaker": "Agent",
      "text": "I can help check that for you. I need to verify a few account details first."
    },
    {
      "speaker": "Customer",
      "text": "Okay."
    },
    {
      "speaker": "Agent",
      "text": "I have sent a reset link to the email we have on file. If you do not see it, check spam and call us back."
    },
    {
      "speaker": "Customer",
      "text": "Alright, I will look for it."
    }
  ]
}
EOF
)"
}

negative() {
  section "POST /api/analysis (negative transcript)"
  post_json "$(cat <<EOF
{
  "model": "$MODEL",
  "transcript": [
    {
      "speaker": "Customer",
      "text": "I have been charged twice this month and I am getting really frustrated."
    },
    {
      "speaker": "Agent",
      "text": "I am sorry you are dealing with that. Let me review the billing activity on the account."
    },
    {
      "speaker": "Customer",
      "text": "This happened before and nobody fixed it. I want this escalated if you cannot solve it today."
    },
    {
      "speaker": "Agent",
      "text": "I understand. I can document the duplicate charge and send this to our billing specialists for urgent review."
    },
    {
      "speaker": "Customer",
      "text": "That is not a resolution. I still need the refund."
    }
  ]
}
EOF
)"
}

custom_file() {
  if [[ -z "$PAYLOAD_FILE" ]]; then
    printf 'PAYLOAD_FILE is required for custom-file.\n' >&2
    exit 1
  fi

  section "POST /api/analysis (custom payload file)"
  curl -sS -i -X POST "$BASE_URL/api/analysis" \
    -H "Content-Type: application/json" \
    --data "@$PAYLOAD_FILE"
  printf '\n'
}

all() {
  printf 'BASE_URL=%s\n' "$BASE_URL"
  printf 'MODEL=%s\n' "$MODEL"
  positive
  neutral
  negative
}

case "$ACTION" in
  all)
    all
    ;;
  positive)
    positive
    ;;
  neutral)
    neutral
    ;;
  negative)
    negative
    ;;
  custom-file)
    custom_file
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
