#!/usr/bin/env bash
# Deploy the repair escrow contract to Stellar testnet, then write the contract
# ID into web/.env.local so the frontend can call it.
#
# Prereqs (from the workshop setup checklist): Rust + the wasm32v1-none target,
# and the Stellar CLI (run `stellar --version` to confirm).
#
# Usage:  ./scripts/deploy.sh [identityName]   (default identity: workshop)
set -euo pipefail

IDENTITY="${1:-workshop}"
NETWORK="testnet"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM="target/wasm32v1-none/release/savings_goal.wasm"
ENV_FILE="$ROOT/web/.env.local"

cd "$ROOT"

# 1. Ensure a funded testnet identity exists
if ! stellar keys ls | grep -qx "$IDENTITY"; then
  echo "Creating + funding testnet identity '$IDENTITY'..."
  stellar keys generate "$IDENTITY" --network "$NETWORK" --fund
fi

# 2. Build the contract to wasm
echo "Building contract..."
stellar contract build

# 3. Deploy to testnet (returns the contract ID, starting with C...)
echo "Deploying to $NETWORK..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$IDENTITY" \
  --network "$NETWORK")
echo "Deployed contract ID: $CONTRACT_ID"

# 4. Initialise the repair escrow admin. Ignore error if already initialised.
ADMIN=$(stellar keys address "$IDENTITY")
echo "Initialising repair escrow admin: $ADMIN"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$IDENTITY" \
  --network "$NETWORK" \
  -- init --admin "$ADMIN" || echo "(init skipped - contract may already be initialised)"

# 5. Write NEXT_PUBLIC_CONTRACT_ID into web/.env.local
if [ -f "$ENV_FILE" ]; then
  grep -v '^NEXT_PUBLIC_CONTRACT_ID=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
  mv "$ENV_FILE.tmp" "$ENV_FILE"
fi
echo "NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID" >> "$ENV_FILE"
echo ""
echo "Wrote NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID to web/.env.local"
echo "Restart 'npm run dev' to pick up the new contract ID."
