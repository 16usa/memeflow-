#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/runner/workspace/memeflow-app/smart-vault"
D2="$ROOT/devnet-executor-d2"
RT="$D2/roundtrip.mjs"

echo "== MEMEFLOW Smart Vault — D2 FIX 2 / detect mint token program on-chain =="
echo "DEVNET TEST HARNESS ONLY. No Mainnet. No production AUTO LIVE changes."
echo

if [ ! -f "$RT" ]; then
  echo "ERROR: missing $RT" >&2
  exit 1
fi

BACKUP="$D2/.state/roundtrip-before-token-program-fix-$(date +%Y%m%d-%H%M%S).mjs"
mkdir -p "$D2/.state"
cp "$RT" "$BACKUP"
echo "Backup: $BACKUP"

python3 - "$RT" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

# 1) Import both supported SPL token program IDs.
if "TOKEN_PROGRAM_ID" not in s:
    needle = '  NATIVE_MINT,\n} from "@solana/spl-token";'
    repl = (
        '  NATIVE_MINT,\n'
        '  TOKEN_PROGRAM_ID,\n'
        '  TOKEN_2022_PROGRAM_ID,\n'
        '} from "@solana/spl-token";'
    )
    if needle not in s:
        raise SystemExit("ERROR: could not locate @solana/spl-token import block")
    s = s.replace(needle, repl, 1)
elif "TOKEN_2022_PROGRAM_ID" not in s:
    needle = "  TOKEN_PROGRAM_ID,\n"
    if needle not in s:
        raise SystemExit("ERROR: TOKEN_PROGRAM_ID import shape is unexpected")
    s = s.replace(needle, needle + "  TOKEN_2022_PROGRAM_ID,\n", 1)

# 2) Official @pump-fun/pump-sdk does not guarantee tokenProgram
#    in fetchBuyState(). The authoritative source is the mint account owner.
old = '''const tokenProgram = buyState.tokenProgram;
if (!tokenProgram) throw new Error("Pump SDK did not return tokenProgram");'''

new = '''const mintAccountInfoForTokenProgram = await connection.getAccountInfo(
  mint.publicKey,
  "confirmed"
);
if (!mintAccountInfoForTokenProgram) {
  throw new Error("D2 test mint disappeared before token-program detection");
}

const tokenProgram = mintAccountInfoForTokenProgram.owner;
if (
  !tokenProgram.equals(TOKEN_PROGRAM_ID) &&
  !tokenProgram.equals(TOKEN_2022_PROGRAM_ID)
) {
  throw new Error(
    `Unsupported mint owner / token program: ${tokenProgram.toBase58()}`
  );
}

console.log(
  "Detected base token program:",
  tokenProgram.equals(TOKEN_2022_PROGRAM_ID)
    ? `Token-2022 (${TOKEN_2022_PROGRAM_ID.toBase58()})`
    : `SPL Token (${TOKEN_PROGRAM_ID.toBase58()})`
);'''

if old in s:
    s = s.replace(old, new, 1)
elif "Detected base token program:" not in s:
    raise SystemExit("ERROR: expected old tokenProgram guard was not found")

# 3) Pass the detected program explicitly into Pump instruction builders.
buy_old = '''const buyIxs = await sdk.buyInstructions({
  ...buyState,
  mint: mint.publicKey,'''
buy_new = '''const buyIxs = await sdk.buyInstructions({
  ...buyState,
  tokenProgram,
  mint: mint.publicKey,'''

if buy_old in s:
    s = s.replace(buy_old, buy_new, 1)
elif "...buyState,\n  tokenProgram," not in s:
    raise SystemExit("ERROR: buyInstructions block was not found")

sell_old = '''const sellIxs = await sdk.sellInstructions({
  ...sellState,
  mint: mint.publicKey,'''
sell_new = '''const sellIxs = await sdk.sellInstructions({
  ...sellState,
  tokenProgram,
  mint: mint.publicKey,'''

if sell_old in s:
    s = s.replace(sell_old, sell_new, 1)
elif "...sellState,\n  tokenProgram," not in s:
    raise SystemExit("ERROR: sellInstructions block was not found")

p.write_text(s)
print("roundtrip.mjs token-program detection patch: OK")
PY

echo
echo "Syntax check..."
node --check "$RT"
echo "Syntax: OK"

echo
echo "Safety check..."
grep -q 'DEVNET_GENESIS' "$RT"
grep -q 'HARD STOP: not Devnet' "$RT"
echo "DEVNET hard-stop still present: OK"

echo
echo "Re-running D2 REAL DEVNET round-trip..."
cd "$D2"
node roundtrip.mjs

echo
echo "== D2 FIX 2 COMPLETE =="
echo "If you see PHASE D2 REAL DEVNET ROUND-TRIP PASSED, send me the final screen."
