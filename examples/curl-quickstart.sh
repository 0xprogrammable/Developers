#!/bin/sh
set -eu

api_base="${PROGRAMMABLE_API_BASE:-https://developers.programmable.family}"
api_base="${api_base%/}"
cursor="${1:-}"
after="${PROGRAMMABLE_AFTER:-}"
chain_id="${PROGRAMMABLE_CHAIN_ID:-1}"
category="${PROGRAMMABLE_CATEGORY:-}"
token_address="${PROGRAMMABLE_TOKEN_ADDRESS:-}"

case "$chain_id" in
  ''|0|0*|*[!0-9]*)
    printf '%s\n' 'PROGRAMMABLE_CHAIN_ID must be a positive decimal chain ID.' >&2
    exit 2
    ;;
esac

if [ -n "$token_address" ] &&
  ! printf '%s\n' "$token_address" | grep -Eq '^0x[0-9A-Fa-f]{40}$'; then
  printf '%s\n' 'PROGRAMMABLE_TOKEN_ADDRESS must be a 20-byte EVM address.' >&2
  exit 2
fi

case "$category" in
  ''|classic|custom) ;;
  *)
    printf '%s\n' 'PROGRAMMABLE_CATEGORY must be classic or custom.' >&2
    exit 2
    ;;
esac

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
get_json "$api_base/api/v2/manifests/$chain_id"

printf '\n%s\n' 'Status and feed quality'
get_json "$api_base/api/v2/status?chainId=$chain_id"

printf '\n%s\n' 'Launch feed'
scope="chainId=$chain_id"
if [ -n "$category" ]; then
  scope="$scope&category=$category"
fi
if [ -n "$cursor" ]; then
  encoded_cursor=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$cursor")
  get_json "$api_base/api/v2/launches?limit=25&$scope&cursor=$encoded_cursor"
elif [ -n "$after" ]; then
  encoded_after=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$after")
  get_json "$api_base/api/v2/launches?limit=25&$scope&after=$encoded_after"
else
  get_json "$api_base/api/v2/launches?limit=25&$scope"
fi

if [ -n "$token_address" ]; then
  printf '\n%s\n' 'Token-address launch lookup'
  get_json "$api_base/api/v2/launches/$chain_id/$token_address"
fi

# Pass the opaque nextCursor as the first argument to request the next page:
# sh examples/curl-quickstart.sh '<nextCursor>'
# Poll after a durable resumeCursor without mixing it with page traversal:
# PROGRAMMABLE_AFTER='<resumeCursor>' sh examples/curl-quickstart.sh
# Select Robinhood Custom and optionally resolve a token address:
# PROGRAMMABLE_CHAIN_ID=4663 PROGRAMMABLE_CATEGORY=custom \
# PROGRAMMABLE_TOKEN_ADDRESS=0x... sh examples/curl-quickstart.sh
