#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Smart Vault — PHASE B / DEVNET DEPLOY V1 =="
echo "DEVNET ONLY. No Mainnet assets. No production AUTO LIVE unlock."

if [[ -d "memeflow-app/smart-vault" ]]; then
  cd memeflow-app/smart-vault
elif [[ -f "Anchor.toml" && -f "programs/memeflow_smart_vault/src/lib.rs" ]]; then
  :
elif [[ -d "smart-vault" && -f "smart-vault/Anchor.toml" ]]; then
  cd smart-vault
else
  echo "ERROR: smart-vault project not found." >&2
  exit 1
fi

# shellcheck disable=SC1091
source "./scripts/toolchain-env.sh"

SO="target/deploy/memeflow_smart_vault.so"
PROGRAM_KEYPAIR="target/deploy/memeflow_smart_vault-keypair.json"
IDL="target/idl/memeflow_smart_vault.json"
PAYER="$HOME/.config/solana/id.json"
RPC="https://api.devnet.solana.com"

[[ -s "$SO" ]] || { echo "ERROR: build artifact missing: $SO"; exit 2; }
[[ -s "$PROGRAM_KEYPAIR" ]] || { echo "ERROR: program keypair missing: $PROGRAM_KEYPAIR"; exit 2; }
[[ -s "$IDL" ]] || { echo "ERROR: Anchor IDL missing: $IDL"; exit 2; }

echo
echo "== Preflight =="

# Hard fail if workspace provider is not Devnet.
python3 - <<'PY'
from pathlib import Path
import re

a = Path("Anchor.toml").read_text()

if not re.search(r'(?mi)^\s*cluster\s*=\s*"devnet"\s*$', a):
    raise SystemExit("ERROR: Anchor.toml provider cluster is not Devnet")

if re.search(r'(?mi)^\s*cluster\s*=\s*"mainnet(?:-beta)?"\s*$', a):
    raise SystemExit("ERROR: Mainnet provider detected")

if "[programs.devnet]" not in a:
    raise SystemExit("ERROR: [programs.devnet] section missing")

print("Anchor provider: DEVNET ONLY [OK]")
PY

PROGRAM_ID="$(solana-keygen pubkey "$PROGRAM_KEYPAIR")"

DECLARE_ID="$(
  sed -n 's/.*declare_id!("\([^"]*\)").*/\1/p' \
    programs/memeflow_smart_vault/src/lib.rs | head -n1
)"

ANCHOR_ID="$(
  awk '
    /^\[programs\.devnet\]$/ {in_dev=1; next}
    /^\[/ && in_dev {exit}
    in_dev && $1=="memeflow_smart_vault" {
      gsub(/"/,"",$3); print $3; exit
    }
  ' Anchor.toml
)"

FILE_ID=""
[[ -f DEVNET_PROGRAM_ID.txt ]] && FILE_ID="$(tr -d '\r\n ' < DEVNET_PROGRAM_ID.txt)"

echo "Program keypair ID : $PROGRAM_ID"
echo "declare_id         : $DECLARE_ID"
echo "Anchor.toml ID     : $ANCHOR_ID"
[[ -n "$FILE_ID" ]] && echo "DEVNET_PROGRAM_ID  : $FILE_ID"

[[ "$PROGRAM_ID" == "$DECLARE_ID" ]] || {
  echo "ERROR: program keypair and declare_id mismatch." >&2
  exit 3
}
[[ "$PROGRAM_ID" == "$ANCHOR_ID" ]] || {
  echo "ERROR: program keypair and Anchor.toml mismatch." >&2
  exit 3
}
if [[ -n "$FILE_ID" && "$PROGRAM_ID" != "$FILE_ID" ]]; then
  echo "ERROR: DEVNET_PROGRAM_ID.txt mismatch." >&2
  exit 3
fi

echo "Program ID consistency: [OK]"

ARTIFACT_BYTES="$(wc -c < "$SO" | tr -d ' ')"
ARTIFACT_SHA256="$(sha256sum "$SO" | awk '{print $1}')"

echo "Program artifact      : $SO"
echo "Artifact bytes        : $ARTIFACT_BYTES"
echo "Artifact SHA-256      : $ARTIFACT_SHA256"
echo "IDL                   : $IDL"

echo
echo "== Dedicated DEVNET deploy wallet =="

mkdir -p "$(dirname "$PAYER")"

if [[ ! -s "$PAYER" ]]; then
  solana-keygen new \
    --no-bip39-passphrase \
    --silent \
    --outfile "$PAYER" >/dev/null
  chmod 600 "$PAYER"
  echo "Created project-local DEVNET payer."
else
  echo "Using existing project-local DEVNET payer."
fi

PAYER_ADDRESS="$(solana-keygen pubkey "$PAYER")"
echo "DEVNET payer address: $PAYER_ADDRESS"

solana config set \
  --url "$RPC" \
  --keypair "$PAYER" >/dev/null

echo "RPC: $RPC"
echo "Current cluster check:"
solana genesis-hash --url "$RPC" >/dev/null
echo "DEVNET RPC reachable: [OK]"

BALANCE_SOL="$(solana balance "$PAYER_ADDRESS" --url "$RPC" 2>/dev/null | awk '{print $1}' || echo "0")"
echo "Current devnet balance: ${BALANCE_SOL:-0} SOL"

echo
echo "Requesting DEVNET SOL if balance is low..."
python3 - "$BALANCE_SOL" <<'PY' >/tmp/mf_need_airdrop
import sys
try:
    b=float(sys.argv[1])
except Exception:
    b=0
print("yes" if b < 2.0 else "no")
PY

if [[ "$(cat /tmp/mf_need_airdrop)" == "yes" ]]; then
  if solana airdrop 2 "$PAYER_ADDRESS" --url "$RPC"; then
    echo "Devnet airdrop request succeeded."
  else
    echo
    echo "WARNING: CLI airdrop was rate-limited or unavailable."
    echo "No deployment has happened."
    echo
    echo "DEVNET payer address:"
    echo "  $PAYER_ADDRESS"
    echo
    echo "Fund this address with DEVNET SOL only, then rerun this same script."
    echo "Official faucet: https://faucet.solana.com/"
    exit 20
  fi
fi

BALANCE_SOL="$(solana balance "$PAYER_ADDRESS" --url "$RPC" | awk '{print $1}')"
echo "Balance before deployment: $BALANCE_SOL SOL"

echo
echo "== FINAL DEVNET GATE =="
echo "Program ID : $PROGRAM_ID"
echo "Cluster    : DEVNET"
echo "RPC        : $RPC"
echo "Payer      : $PAYER_ADDRESS"
echo "Artifact   : $ARTIFACT_BYTES bytes"
echo
echo "This next action will DEPLOY THE SMART VAULT PROGRAM TO SOLANA DEVNET."
echo "Devnet SOL has no real-world value."
echo "It will NOT modify MEMEFLOW production settings or unlock AUTO LIVE."
echo
read -r -p "Type exactly DEPLOY DEVNET to continue: " CONFIRM

if [[ "$CONFIRM" != "DEPLOY DEVNET" ]]; then
  echo "Cancelled. Nothing deployed."
  exit 0
fi

echo
echo "Deploying to DEVNET..."
anchor deploy

echo
echo "== On-chain verification =="

SHOW_OUTPUT="$(solana program show "$PROGRAM_ID" --url "$RPC")"
printf '%s\n' "$SHOW_OUTPUT"

if ! grep -q "$PROGRAM_ID" <<<"$SHOW_OUTPUT"; then
  echo "ERROR: deployed program could not be verified by expected program ID." >&2
  exit 30
fi

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
    "deployedAt": deployed_at,
    "productionAutoLiveUnlocked": False,
    "mainnetDeployment": False,
}

Path("DEVNET_DEPLOYMENT.json").write_text(
    json.dumps(record, indent=2) + "\n"
)
print(json.dumps(record, indent=2))
PY

echo
echo "== SMART VAULT DEVNET DEPLOYED =="
echo "Program ID: $PROGRAM_ID"
echo "Deployment record: $PWD/DEVNET_DEPLOYMENT.json"
echo
echo "Production safety state:"
echo "  Existing manual LIVE: UNCHANGED"
echo "  AUTO LIVE 24/7:       STILL LOCKED"
echo "  Mainnet deployment:   NONE"
echo "  Real-money trade:     NONE"
echo
echo "STOP HERE."
echo "Next phase is Devnet policy/vault initialization and owner-signed testing."
