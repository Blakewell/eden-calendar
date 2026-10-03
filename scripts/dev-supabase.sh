#!/bin/sh
# Runs the app against a local Supabase (Docker), never the live project.
# Start it first with `supabase start`; it applies every migration from scratch.
set -e

if ! status=$(supabase status -o env 2>/dev/null); then
  echo "Local Supabase isn't running. Start it with: supabase start (needs Docker)" >&2
  exit 1
fi
eval "$status"

# Newer CLIs call the browser key PUBLISHABLE_KEY; older ones ANON_KEY.
VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_ANON_KEY="${PUBLISHABLE_KEY:-$ANON_KEY}" exec npx vite "$@"
