#!/bin/bash
# run-crons.sh — manually trigger all 8 ATS scrapers on production
#
# Usage:
#   ./scripts/run-crons.sh YOUR_CRON_SECRET
#
# Get CRON_SECRET from: Vercel dashboard → your project → Settings → Environment Variables
#
# You can also set it permanently:
#   export CRON_SECRET=your_secret_here
#   ./scripts/run-crons.sh

SECRET="${1:-$CRON_SECRET}"
BASE="${BASE_URL:-https://career-portal-nine.vercel.app}"

if [ -z "$SECRET" ]; then
  echo "Usage: ./scripts/run-crons.sh YOUR_CRON_SECRET"
  echo "   or: export CRON_SECRET=... && ./scripts/run-crons.sh"
  echo ""
  echo "Get CRON_SECRET from Vercel dashboard → Settings → Environment Variables"
  exit 1
fi

CRONS=(greenhouse lever ashby recruitee workable smartrecruiters workday remotive muse adzuna usajobs)
PASS=0
FAIL=0

echo "Running all ATS scrapers against $BASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for cron in "${CRONS[@]}"; do
  printf "%-18s " "$cron..."
  RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE/api/cron/$cron" \
    -H "x-cron-secret: $SECRET" \
    --max-time 60)

  HTTP_CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -1)

  INSERTED=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('inserted',d.get('upserted','?')))" 2>/dev/null || echo "?")

  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓  HTTP $HTTP_CODE  |  inserted: $INSERTED"
    PASS=$((PASS+1))
  else
    echo "✗  HTTP $HTTP_CODE  |  $BODY"
    FAIL=$((FAIL+1))
  fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Done: $PASS passed, $FAIL failed"
echo ""
echo "Check live jobs at: $BASE/all-jobs"
