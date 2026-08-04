#!/bin/sh
set -eu

api_base="${PROGRAMMABLE_API_BASE:-https://developers.programmable.family}"
api_base="${api_base%/}"
cursor="${1:-}"
after="${PROGRAMMABLE_AFTER:-}"

if [ -n "$cursor" ] && [ -n "$after" ]; then
  printf '%s\n' 'Use a page cursor argument or PROGRAMMABLE_AFTER, not both.' >&2
  exit 2
fi

get_json() {
  if command -v jq >/dev/null 2>&1; then
    curl --fail --silent --show-error --compressed \
      --header 'Accept: application/json' "$1" | jq .
  else
    curl --fail --silent --show-error --compressed \
      --header 'Accept: application/json' "$1"
    printf '\n'
  fi
}

printf '%s\n' 'Manifest and deployment discovery'
get_json "$api_base/api/v1/manifest"

printf '\n%s\n' 'Launch feed'
if [ -n "$cursor" ]; then
  encoded_cursor=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$cursor")
  get_json "$api_base/api/v1/launches?limit=25&cursor=$encoded_cursor"
elif [ -n "$after" ]; then
  encoded_after=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$after")
  get_json "$api_base/api/v1/launches?limit=25&after=$encoded_after"
else
  get_json "$api_base/api/v1/launches?limit=25"
fi

# Pass the opaque nextCursor as the first argument to request the next page:
# sh examples/curl-quickstart.sh '<nextCursor>'
# Poll after a durable resumeCursor without mixing it with page traversal:
# PROGRAMMABLE_AFTER='<resumeCursor>' sh examples/curl-quickstart.sh
