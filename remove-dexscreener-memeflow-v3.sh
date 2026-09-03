#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "Restoring the three target files to current committed HEAD..."
git restore --source=HEAD -- \
  memeflow-app/app-server.mjs \
  memeflow-app/src/manual-scan.mjs \
  memeflow-app/system-tokens.js

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-dex-remove-v3-$STAMP"
mkdir -p "$BACKUP"
cp memeflow-app/app-server.mjs "$BACKUP/app-server.mjs"
cp memeflow-app/src/manual-scan.mjs "$BACKUP/manual-scan.mjs"
cp memeflow-app/system-tokens.js "$BACKUP/system-tokens.js"

python3 - <<'PY'
from pathlib import Path
import re

def cut_between(text, start_marker, end_marker, replacement, label):
    a = text.find(start_marker)
    if a < 0:
        raise SystemExit(f"ERROR: {label}: start marker not found")
    b = text.find(end_marker, a)
    if b < 0:
        raise SystemExit(f"ERROR: {label}: end marker not found")
    return text[:a] + replacement + text[b:]

# ============================================================
# app-server.mjs
# ============================================================
p = Path("memeflow-app/app-server.mjs")
c = p.read_text()

c = cut_between(
    c,
    "async function mf49FetchJson(",
    "async function mf49DeveloperPct(",
    """async function mf49ResolveInput(raw){
 const input=String(raw||'').trim();
 if(!input)throw mf49Err('Paste a Solana mint or Pump.fun link.',400,'TOKEN_INPUT_REQUIRED');
 const matches=input.match(MF48_KEY_RE)||[];
 const mint=matches.find(x=>validPubkey(x));
 if(!mint)throw mf49Err('A valid Solana mint address was not found in that value.',400,'INVALID_SOLANA_MINT');
 return {mint,inputKind:/pump\\.fun/i.test(input)?'pump-fun':'mint'}
}
""",
    "app standalone helper region"
)

c = cut_between(
    c,
    " let pair=resolved.pair||null;",
    " let priceSol=",
    """ const name=canonicalToken.name||known.name||known.symbol||null;
 const symbol=canonicalToken.symbol||known.symbol||null;
 const priceUsd=mf49Num(canonicalToken.priceUsd)??mf49Num(known.priceUsd);
 const liquidityUsd=mf49Num(canonicalToken.liquidityUsd)??mf49Num(known.liquidityUsd);
 const marketCapUsd=mf49Num(canonicalToken.marketCapUsd)??mf49Num(known.marketCapUsd);
 const volume5mUsd=mf49Num(known?.market?.volume5mUsd)??mf49Num(known.volume5mUsd);
 const buys5m=mf49Num(known?.market?.buys5m)??mf49Num(known.buys5m);
 const sells5m=mf49Num(known?.market?.sells5m)??mf49Num(known.sells5m);

""",
    "app standalone market block"
)

# Remove Dex-only buy-pressure fallback.
pattern = re.compile(
    r"\}else if\(buyPressure==null&&pair\)\{\n"
    r"  const w=mf49TxnWindow\(pair\);\n"
    r"  if\(w\.buys!=null\|\|w\.sells!=null\)\{\n"
    r"   buyPressure=w\.sells\?w\.buys/w\.sells:\(w\.buys\|\|null\)\n"
    r"  \}\n"
    r" \}"
)
c, n = pattern.subn("}", c, count=1)
if n != 1:
    raise SystemExit("ERROR: app buy-pressure Dex fallback not found")

c = c.replace(
    "  volume24hUsd:mf49Num(pair?.volume?.h24),",
    "  volume24hUsd:mf49Num(known?.market?.volume24hUsd)??mf49Num(known.volume24hUsd),",
    1
)
c = c.replace(
    "  buyTransactions:mf49Num(pair?.txns?.h24?.buys)??buys5m,",
    "  buyTransactions:mf49Num(known?.market?.buyTransactions)??mf49Num(known.buyTransactions)??buys5m,",
    1
)
c = c.replace(
    "  sellTransactions:mf49Num(pair?.txns?.h24?.sells)??sells5m,",
    "  sellTransactions:mf49Num(known?.market?.sellTransactions)??mf49Num(known.sellTransactions)??sells5m,",
    1
)
old_total = "  totalTransactions:(()=>{const b=mf49Num(pair?.txns?.h24?.buys)??buys5m,s=mf49Num(pair?.txns?.h24?.sells)??sells5m;return b!=null&&s!=null?b+s:null})(),"
new_total = "  totalTransactions:(()=>{const b=mf49Num(known?.market?.buyTransactions)??mf49Num(known.buyTransactions)??buys5m,s=mf49Num(known?.market?.sellTransactions)??mf49Num(known.sellTransactions)??sells5m;return b!=null&&s!=null?b+s:null})(),"
if old_total not in c:
    raise SystemExit("ERROR: app totalTransactions Dex expression not found")
c = c.replace(old_total, new_total, 1)

c = c.replace(
    " if(!pair&&priceSol==null)warnings.push('No DEX or bonding-curve price was available.');",
    " if(priceSol==null&&priceUsd==null)warnings.push('No MEMEFLOW or bonding-curve price was available.');",
    1
)

old_fields = """   priceChange5mPct:mf49Num(pair?.priceChange?.m5),
   pairAddress:pair?.pairAddress||null,
   dexId:pair?.dexId||null,
   pairUrl:pair?.url||null"""
new_fields = """   priceChange5mPct:mf49Num(known?.market?.priceChange5mPct)??mf49Num(known.priceChange5mPct)"""
if old_fields not in c:
    raise SystemExit("ERROR: app Dex response fields not found")
c = c.replace(old_fields, new_fields, 1)

c = c.replace(
    "const MF48_NATIVE_SYMBOLS=new Set(['SOL','WSOL','USDC','USDT']);\n",
    "",
    1
)

if re.search(r"dexscreener|api\.dexscreener\.com|mf49DexPairForMint|mf49PairToken|mf49TxnWindow", c, re.I):
    raise SystemExit("ERROR: DexScreener code still remains in app-server.mjs")
p.write_text(c)

# ============================================================
# manual-scan.mjs
# ============================================================
p = Path("memeflow-app/src/manual-scan.mjs")
c = p.read_text()

c = c.replace(
    "import { decodePumpCreate } from './solana.mjs';",
    "import { decodeCurve, decodePumpCreate } from './solana.mjs';",
    1
)

c = cut_between(
    c,
    "async function dexToken(mint) {",
    "export async function manualAnalyze({",
    "",
    "manual Dex helper region"
)

c = c.replace("\n  const pair = await dexToken(mint);\n", "\n", 1)

start = c.find("  const liquidityUsd = firstFinite(")
end = c.find("  /*\n   * IMPORTANT:", start)
if start < 0 or end < 0:
    raise SystemExit("ERROR: manual market-data block markers not found")

manual_market = """  const liquidityUsd = firstFinite(existing.liquidityUsd);
  const marketCapUsd = firstFinite(existing.marketCapUsd);
  const priceUsd = firstFinite(existing.priceUsd);

  let priceSol = firstFinite(existing.priceSol);
  let liquiditySol = firstFinite(
    existing.liquiditySol,
    existing.liquidity
  );

  const curveAddress =
    creatorResolution.curve ||
    existing.curve ||
    existing.bondingCurve ||
    null;

  if (curveAddress) {
    try {
      const curveInfo = await rpc.call(
        'getAccountInfo',
        [
          curveAddress,
          {
            encoding: 'base64',
            commitment: 'confirmed'
          }
        ]
      );

      if (curveInfo?.value?.data?.[0]) {
        const decodedCurve =
          decodeCurve(curveInfo.value.data[0], decimals);

        priceSol = firstFinite(
          decodedCurve?.priceSol,
          priceSol
        );

        liquiditySol = firstFinite(
          decodedCurve?.liquiditySol,
          liquiditySol
        );
      }
    } catch {
      // Optional curve evidence; holder/supply analysis continues.
    }
  }

  const buyPressure = firstFinite(existing.buyPressure);

"""
c = c[:start] + manual_market + c[end:]

old_identity = """    name:
      pair?.baseToken?.name ||
      existing.name ||
      existing.symbol ||
      mint.slice(0, 8),

    symbol:
      pair?.baseToken?.symbol ||
      existing.symbol ||
      'TOKEN',

    source:
      pair
        ? 'Solana RPC + MEMEFLOW holder engine + DexScreener'
        : 'Solana RPC + MEMEFLOW holder engine',"""
new_identity = """    name:
      existing.name ||
      existing.symbol ||
      mint.slice(0, 8),

    symbol:
      existing.symbol ||
      'TOKEN',

    source:
      curveAddress
        ? 'Solana RPC + MEMEFLOW holder engine + Pump curve'
        : 'Solana RPC + MEMEFLOW holder engine',"""
if old_identity not in c:
    raise SystemExit("ERROR: manual Dex identity/source block not found")
c = c.replace(old_identity, new_identity, 1)

old_liq = """    priceSol,
    priceUsd,
    liquidityUsd,
    marketCapUsd,"""
new_liq = """    priceSol,
    priceUsd,
    liquidityUsd,
    liquiditySol,
    marketCapUsd,"""
if old_liq not in c:
    raise SystemExit("ERROR: manual liquidity insertion point not found")
c = c.replace(old_liq, new_liq, 1)

c = c.replace("\n      dexAvailable: Boolean(pair),\n", "\n", 1)

if re.search(r"dexscreener|api\.dexscreener\.com|dexToken|dexBuyPressure|pair\?\.", c, re.I):
    raise SystemExit("ERROR: DexScreener code still remains in manual-scan.mjs")
p.write_text(c)

# ============================================================
# system-tokens.js
# ============================================================
p = Path("memeflow-app/system-tokens.js")
c = p.read_text()

old_line = "  const dex = safeExternalUrl(row?.dexUrl ?? row?.market?.dexUrl);\n"
if old_line not in c:
    raise SystemExit("ERROR: UI dexUrl line not found")
c = c.replace(old_line, "", 1)

if "  return { dex, pump };" not in c:
    raise SystemExit("ERROR: UI return dex,pump not found")
c = c.replace("  return { dex, pump };", "  return { pump };", 1)

a = c.find("  if (links.dex) {")
b = c.find("\n  if (links.pump) {", a)
if a < 0 or b < 0:
    raise SystemExit("ERROR: UI DexScreener link block markers not found")
c = c[:a] + c[b:]

if re.search(r"dexscreener|links\.dex|dexUrl", c, re.I):
    raise SystemExit("ERROR: DexScreener UI code still remains in system-tokens.js")
p.write_text(c)
PY

node --check memeflow-app/app-server.mjs
node --check memeflow-app/src/manual-scan.mjs
node --check memeflow-app/system-tokens.js

echo
echo "=== DexScreener verification ==="
if grep -RniI \
  --exclude-dir=node_modules \
  --exclude-dir=data \
  --exclude='*.map' \
  -i "dexscreener" memeflow-app
then
  echo "ERROR: references remain in active memeflow-app. Nothing committed."
  exit 1
else
  echo "OK: no DexScreener references remain in active memeflow-app."
fi

echo
echo "=== Changes ==="
git diff --stat -- \
  memeflow-app/app-server.mjs \
  memeflow-app/src/manual-scan.mjs \
  memeflow-app/system-tokens.js

git add \
  memeflow-app/app-server.mjs \
  memeflow-app/src/manual-scan.mjs \
  memeflow-app/system-tokens.js

git commit -m "remove: DexScreener from active MEMEFLOW runtime"
git push origin HEAD

echo
echo "DONE"
echo "Backup: $BACKUP"
