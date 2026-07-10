#!/usr/bin/env bash
# Verifies RLS on the global-upload tables.
# Requires: SB_URL, SB_ANON, SB_SERVICE, SB_USER_JWT in env.
set -euo pipefail
REST="$SB_URL/rest/v1"

echo "1. anon SELECT uploads -> should return [] (only live, none yet):"
curl -s "$REST/uploads?select=id" -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"; echo

echo "2. anon INSERT uploads -> should be 401/403:"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$REST/uploads" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000","bunny_path":"x"}'

echo "3. anon SELECT creator_trust -> should be [] or 403 (no policy):"
curl -s "$REST/creator_trust?select=user_id" -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"; echo

echo "4. anon SELECT banned_hashes -> should be [] or 403:"
curl -s "$REST/banned_hashes?select=sha256_head" -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"; echo

echo "Manual: with SB_USER_JWT, SELECT uploads returns own rows; UPDATE title on own"
echo "non-live row succeeds; UPDATE status fails."
