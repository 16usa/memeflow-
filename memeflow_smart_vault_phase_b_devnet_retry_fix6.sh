#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Smart Vault — PHASE B / DEVNET RETRY FIX 6 =="
echo "Fix: Blockhash expired / Max retries exceeded."
echo "DEVNET ONLY. No Mainnet. No production AUTO LIVE unlock."

ROOT="/home/runner/workspace/memeflow-app/smart-vault"
cd "$ROOT"

# shellcheck disable=SC1091
source "./scripts/toolchain-env.sh"

RPC="https://api.devnet.solana.com"
SO="target/deploy/memeflow_smart_vault.so"
PROGRAM_KEYPAIR="target/deploy/memeflow_smart_vault-keypair.json"
PAYER="$HOME/.config/solana/id.json"
RECORD="DEVNET_DEPLOYMENT.json"

[[ -s "$SO" ]] || { echo "ERROR: missing $SO"; exit 2; }
[[ -s "$PROGRAM_KEYPAIR" ]] || { echo "ERROR: missing $PROGRAM_KEYPAIR"; exit 2; }
[[ -s "$PAYER" ]] || { echo "ERROR: missing DEVNET payer $PAYER"; exit 2; }

PROGRAM_ID="$(solana-keygen pubkey "$PROGRAM_KEYPAIR")"
PAYER_ADDRESS="$(solana-keygen pubkey "$PAYER")"

echo
echo "Program ID : $PROGRAM_ID"
echo "Payer      : $PAYER_ADDRESS"
echo "RPC        : $RPC"
echo "Artifact   : $SO"
echo

solana config set --url "$RPC" --keypair "$PAYER" >/dev/null

echo "Checking whether the previous attempt actually finished on-chain..."
if solana program show "$PROGRAM_ID" --url "$RPC" > /tmp/mf_program_show 2>/dev/null; then
  if grep -qi "Program Id:" /tmp/mf_program_show; then
    echo
    echo "PROGRAM IS ALREADY DEPLOYED ON DEVNET."
    cat /tmp/mf_program_show
    ALREADY=1
  else
    ALREADY=0
  fi
else
  ALREADY=0
fi

if [[ "$ALREADY" -eq 0 ]]; then
  echo "Previous deploy did not reach a verifiable executable program."
  echo "The failure was transport/blockhash expiry, not a Rust/Anchor build error."
  echo

  BAL="$(solana balance "$PAYER_ADDRESS" --url "$RPC" | awk '{print $1}')"
  echo "Current DEVNET balance: $BAL SOL"
  echo
  echo "Retry strategy:"
  echo "  - use Solana CLI directly instead of deprecated 'anchor deploy'"
  echo "  - keep the exact same Program ID"
  echo "  - refresh expired blockhashes up to 30 signing attempts"
  echo "  - add a small DEVNET priority fee"
  echo "  - do NOT use --use-rpc on the public RPC"
  echo
  echo "This still deploys ONLY to Devnet."
  read -r -p "Type exactly RETRY DEVNET to continue: " CONFIRM

  if [[ "$CONFIRM" != "RETRY DEVNET" ]]; then
    echo "Cancelled. Nothing changed."
    exit 0
  fi

  echo
  echo "Retrying DEVNET deployment..."
  solana program deploy "$SO" \
    --program-id "$PROGRAM_KEYPAIR" \
    --keypair "$PAYER" \
    --upgrade-authority "$PAYER" \
    --url "$RPC" \
    --max-sign-attempts 30 \
    --with-compute-unit-price 10000

  echo
  echo "Verifying executable program..."
  solana program show "$PROGRAM_ID" --url "$RPC" > /tmp/mf_program_show
  cat /tmp/mf_program_show

  grep -qi "Program Id:" /tmp/mf_program_show || {
    echo "ERROR: program was not verifiable after deploy." >&2
    exit 30
  }
fi

ARTIFACT_BYTES="$(wc -c < "$SO" | tr -d ' ')"
ARTIFACT_SHA256="$(sha256sum "$SO" | awk '{print $1}')"
DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

python3 - "$PROGRAM_ID" "$PAYER_ADDRESS" "$ARTIFACT_SHA256" "$ARTIFACT_BYTES" "$DEPLOYED_AT" <<'PY'
from pathlib import Path
import json, sys
program_id, payer, sha, size, deployed_at = sys.argv[1:]
record = {
    "environment": "devnet",
    "rpc": "https://api.devnet.solana.com",
    "programId": program_id,
    "deployPayer": payer,
    "artifact": "target/deploy/memeflow_smart_vault.so",
    "artifactSha256": sha,
    "artifactBytes": int(size),
    "verifiedAt": deployed_at,
    "productionAutoLiveUnlocked": False,
    "mainnetDeployment": False
}
Path("DEVNET_DEPLOYMENT.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record, indent=2))
PY

echo
echo "== SMART VAULT DEVNET DEPLOY VERIFIED =="
echo "Program ID: $PROGRAM_ID"
echo "Record: $ROOT/$RECORD"
echo
echo "Safety state:"
echo "  Production manual LIVE: unchanged"
echo "  AUTO LIVE 24/7:         still locked"
echo "  Mainnet deployment:     none"
echo "  Real-money transaction: none"
echo
echo "STOP HERE. Do not switch production to this program yet."
