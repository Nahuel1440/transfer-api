#!/usr/bin/env bash
#
# Smoke test: hits a RUNNING Transfers API and checks the main paths end to end.
# Assumes the database has just been seeded (Alice=200000, Bob=50000, Carol=0).
#
# Usage:
#   BASE_URL=http://localhost:3000 bash scripts/smoke-test.sh
#
set -u
# JSON bodies look like {"a":1,"b":2}; disable brace expansion so bash does not
# split them on the commas when they are passed as command arguments.
set +B

BASE_URL="${BASE_URL:-http://localhost:3000}"
ALICE=11111111-1111-1111-1111-111111111111
BOB=22222222-2222-2222-2222-222222222222
CAROL=33333333-3333-3333-3333-333333333333

pass=0
fail=0

check() { # label expected actual
  if [ "$2" = "$3" ]; then
    echo "  PASS  $1 (=$3)"
    pass=$((pass + 1))
  else
    echo "  FAIL  $1 (expected $2, got $3)"
    fail=$((fail + 1))
  fi
}

contains() { # label needle haystack
  if printf '%s' "$3" | grep -q "$2"; then
    echo "  PASS  $1"
    pass=$((pass + 1))
  else
    echo "  FAIL  $1 (missing '$2' in: $3)"
    fail=$((fail + 1))
  fi
}

http_code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
json_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).id||""))}catch(e){process.stdout.write("")}})'; }
post() { curl -s -X POST "$BASE_URL/transactions" -H 'content-type: application/json' -d "$1"; }
post_code() { curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/transactions" -H 'content-type: application/json' -d "$1"; }

echo "== Smoke test against $BASE_URL =="

echo "[infra]"
check "GET /health" 200 "$(http_code "$BASE_URL/health")"
check "GET /docs (Swagger UI)" 200 "$(http_code "$BASE_URL/docs")"
check "GET /docs/json (OpenAPI)" 200 "$(http_code "$BASE_URL/docs/json")"

echo "[transfers]"
small="$(post "{\"originId\":\"$ALICE\",\"destinationId\":\"$BOB\",\"amount\":1000}")"
contains "POST small (<=threshold) -> APPROVED" '"status":"APPROVED"' "$small"

large="$(post "{\"originId\":\"$ALICE\",\"destinationId\":\"$BOB\",\"amount\":60000}")"
contains "POST large (>threshold) -> PENDING" '"status":"PENDING"' "$large"
large_id="$(printf '%s' "$large" | json_id)"

check "PATCH approve -> 200" 200 "$(http_code -X PATCH "$BASE_URL/transactions/$large_id/approve")"
check "PATCH approve again -> 409" 409 "$(http_code -X PATCH "$BASE_URL/transactions/$large_id/approve")"

pending2="$(post "{\"originId\":\"$ALICE\",\"destinationId\":\"$BOB\",\"amount\":60000}")"
pending2_id="$(printf '%s' "$pending2" | json_id)"
check "PATCH reject -> 200" 200 "$(http_code -X PATCH "$BASE_URL/transactions/$pending2_id/reject")"

echo "[validation]"
check "POST insufficient funds -> 409" 409 "$(post_code "{\"originId\":\"$CAROL\",\"destinationId\":\"$ALICE\",\"amount\":10}")"
check "POST same account -> 400" 400 "$(post_code "{\"originId\":\"$ALICE\",\"destinationId\":\"$ALICE\",\"amount\":10}")"
check "POST negative amount -> 400" 400 "$(post_code "{\"originId\":\"$ALICE\",\"destinationId\":\"$BOB\",\"amount\":-5}")"

echo "[list]"
check "GET /transactions?userId= -> 200" 200 "$(http_code "$BASE_URL/transactions?userId=$BOB")"

echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ] || exit 1
