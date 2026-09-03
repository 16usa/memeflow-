#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

TARGETS=(
  memeflow-app/app-server.mjs
  memeflow-app/src/manual-scan.mjs
  memeflow-app/system-tokens.js
  memeflow-app/index.html
)

echo "Restoring only target files to current committed HEAD..."
git restore --source=HEAD -- "${TARGETS[@]}"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-remove-dexscreener-v4-$STAMP"
mkdir -p "$BACKUP"
for f in "${TARGETS[@]}"; do
  cp "$f" "$BACKUP/$(echo "$f" | tr '/' '_')"
done

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
# 1) app-server.mjs
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
    "app standalone Dex helper region"
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
    "app standalone Dex market block"
)

old = """ }else if(buyPressure==null&&pair){
  const w=mf49TxnWindow(pair);
  if(w.buys!=null||w.sells!=null){
   buyPressure=w.sells?w.buys/w.sells:(w.buys||null)
  }
 }"""
if old not in c:
    raise SystemExit("ERROR: app Dex buy-pressure fallback not found")
c = c.replace(old, " }", 1)

repls = {
"  volume24hUsd:mf49Num(pair?.volume?.h24),":
"  volume24hUsd:mf49Num(known?.market?.volume24hUsd)??mf49Num(known.volume24hUsd),",

"  buyTransactions:mf49Num(pair?.txns?.h24?.buys)??buys5m,":
"  buyTransactions:mf49Num(known?.market?.buyTransactions)??mf49Num(known.buyTransactions)??buys5m,",

"  sellTransactions:mf49Num(pair?.txns?.h24?.sells)??sells5m,":
"  sellTransactions:mf49Num(known?.market?.sellTransactions)??mf49Num(known.sellTransactions)??sells5m,",

"  totalTransactions:(()=>{const b=mf49Num(pair?.txns?.h24?.buys)??buys5m,s=mf49Num(pair?.txns?.h24?.sells)??sells5m;return b!=null&&s!=null?b+s:null})(),":
"  totalTransactions:(()=>{const b=mf49Num(known?.market?.buyTransactions)??mf49Num(known.buyTransactions)??buys5m,s=mf49Num(known?.market?.sellTransactions)??mf49Num(known.sellTransactions)??sells5m;return b!=null&&s!=null?b+s:null})(),",

" if(!pair&&priceSol==null)warnings.push('No DEX or bonding-curve price was available.');":
" if(priceSol==null&&priceUsd==null)warnings.push('No MEMEFLOW or bonding-curve price was available.');",

"""   priceChange5mPct:mf49Num(pair?.priceChange?.m5),
   pairAddress:pair?.pairAddress||null,
   dexId:pair?.dexId||null,
   pairUrl:pair?.url||null""":
"""   priceChange5mPct:mf49Num(known?.market?.priceChange5mPct)??mf49Num(known.priceChange5mPct)"""
}
for old,new in repls.items():
    if old not in c:
        raise SystemExit("ERROR: expected app-server Dex anchor missing")
    c = c.replace(old,new,1)

c = c.replace(
    "const MF48_NATIVE_SYMBOLS=new Set(['SOL','WSOL','USDC','USDT']);\n",
    "",
    1
)

if re.search(r"dexscreener|api\.dexscreener\.com|mf49DexPairForMint|mf49PairToken|mf49TxnWindow", c, re.I):
    raise SystemExit("ERROR: DexScreener code still remains in app-server.mjs")
p.write_text(c)

# ============================================================
# 2) manual-scan.mjs
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

a = c.find("  const liquidityUsd = firstFinite(")
b = c.find("  /*\n   * IMPORTANT:", a)
if a < 0 or b < 0:
    raise SystemExit("ERROR: manual Dex market block markers not found")

c = c[:a] + """  const liquidityUsd = firstFinite(existing.liquidityUsd);
  const marketCapUsd = firstFinite(existing.marketCapUsd);
  const priceUsd = firstFinite(existing.priceUsd);

  let priceSol = firstFinite(existing.priceSol);
  let liquiditySol = firstFinite(existing.liquiditySol, existing.liquidity);

  const curveAddress =
    creatorResolution.curve ||
    existing.curve ||
    existing.bondingCurve ||
    null;

  if (curveAddress) {
    try {
      const curveInfo = await rpc.call(
        'getAccountInfo',
        [curveAddress, { encoding: 'base64', commitment: 'confirmed' }]
      );

      if (curveInfo?.value?.data?.[0]) {
        const decodedCurve = decodeCurve(curveInfo.value.data[0], decimals);
        priceSol = firstFinite(decodedCurve?.priceSol, priceSol);
        liquiditySol = firstFinite(decodedCurve?.liquiditySol, liquiditySol);
      }
    } catch {
      // Optional curve evidence; holder/supply analysis continues.
    }
  }

  const buyPressure = firstFinite(existing.buyPressure);

""" + c[b:]

old = """    name:
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
new = """    name:
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
if old not in c:
    raise SystemExit("ERROR: manual Dex source block not found")
c = c.replace(old,new,1)

if """    priceSol,
    priceUsd,
    liquidityUsd,
    marketCapUsd,""" not in c:
    raise SystemExit("ERROR: manual liquidity insertion anchor not found")
c = c.replace(
"""    priceSol,
    priceUsd,
    liquidityUsd,
    marketCapUsd,""",
"""    priceSol,
    priceUsd,
    liquidityUsd,
    liquiditySol,
    marketCapUsd,""",
1
)

c = c.replace("\n      dexAvailable: Boolean(pair),\n", "\n", 1)

if re.search(r"dexscreener|api\.dexscreener\.com|dexToken|dexBuyPressure|pair\?\.", c, re.I):
    raise SystemExit("ERROR: DexScreener code still remains in manual-scan.mjs")
p.write_text(c)

# ============================================================
# 3) system-tokens.js
# ============================================================
p = Path("memeflow-app/system-tokens.js")
c = p.read_text()

line = "  const dex = safeExternalUrl(row?.dexUrl ?? row?.market?.dexUrl);\n"
if line not in c:
    raise SystemExit("ERROR: system-tokens dexUrl line not found")
c = c.replace(line, "", 1)

if "  return { dex, pump };" not in c:
    raise SystemExit("ERROR: system-tokens return { dex, pump } not found")
c = c.replace("  return { dex, pump };", "  return { pump };", 1)

a = c.find("  if (links.dex) {")
b = c.find("\n  if (links.pump) {", a)
if a < 0 or b < 0:
    raise SystemExit("ERROR: system-tokens Dex link block not found")
c = c[:a] + c[b:]

if re.search(r"dexscreener|links\.dex|dexUrl", c, re.I):
    raise SystemExit("ERROR: DexScreener code still remains in system-tokens.js")
p.write_text(c)

# ============================================================
# 4) index.html
# ============================================================
p = Path("memeflow-app/index.html")
c = p.read_text()

# Evidence pane: remove DexScreener row.
c = c.replace(
"""      upsert('Pump.fun',`<a href="https://pump.fun/coin/${encoded}" target="_blank" rel="noopener noreferrer">Open</a>`);
      upsert('DexScreener',`<a href="https://dexscreener.com/solana/${encoded}" target="_blank" rel="noopener noreferrer">Open</a>`);
      upsert('Bubble map',`<a href="https://app.bubblemaps.io/sol/token/${encoded}" target="_blank" rel="noopener noreferrer">Open</a>`);""",
"""      upsert('Pump.fun',`<a href="https://pump.fun/coin/${encoded}" target="_blank" rel="noopener noreferrer">Open</a>`);
      upsert('Bubble map',`<a href="https://app.bubblemaps.io/sol/token/${encoded}" target="_blank" rel="noopener noreferrer">Open</a>`);""",
1
)
c = c.replace(
"      upsert('Pump.fun','Unavailable');upsert('DexScreener','Unavailable');upsert('Bubble map','Unavailable');",
"      upsert('Pump.fun','Unavailable');upsert('Bubble map','Unavailable');",
1
)

c = c.replace(
'            placeholder="Paste mint, Pump.fun or DexScreener link"',
'            placeholder="Paste mint or Pump.fun link"',
1
)

# Manual analysis result links: remove DexScreener anchor.
dex_link = """        <a href="${esc(external.dexscreener)}"
           target="_blank"
           rel="noopener">
          DexScreener
        </a>

"""
if dex_link not in c:
    raise SystemExit("ERROR: index manual DexScreener link not found")
c = c.replace(dex_link, "", 1)

# Remove three DexScreener image/network fallback blocks.
# Block 1: inline manual result logo fallback.
a = c.find("      }else if(d?.mint){\n        fetch(\n          'https://api.dexscreener.com/token-pairs/v1/solana/' +")
b = c.find("      }else{\n        showImage('');\n      }\n", a)
if a < 0 or b < 0:
    raise SystemExit("ERROR: index manual-logo Dex block not found")
replacement = """      }else{
        showImage('');
      }
"""
c = c[:a] + replacement + c[b+len("      }else{\n        showImage('');\n      }\n"):]

# Block 2: candidate/primary logo async Dex fetch.
a = c.find("    try{\n      const r=await fetch(\n        'https://api.dexscreener.com/token-pairs/v1/solana/' +")
b = c.find("    }catch{\n      showImage('');\n    }\n", a)
if a < 0 or b < 0:
    raise SystemExit("ERROR: index primary-logo Dex block not found")
replacement = """    showImage('');
"""
c = c[:a] + replacement + c[b+len("    }catch{\n      showImage('');\n    }\n"):]

# Block 3: MEMEFLOW_CANDIDATE_CARD_LOGOS_V1 getImage() Dex provider.
start_marker = "<script id=\"MEMEFLOW_CANDIDATE_CARD_LOGOS_V1\">"
s = c.find(start_marker)
if s < 0:
    raise SystemExit("ERROR: candidate-card logo script not found")
a = c.find("  async function getImage(mint){", s)
b = c.find("\n  function ", a)
if a < 0 or b < 0:
    raise SystemExit("ERROR: candidate-card getImage block boundaries not found")
c = c[:a] + """  async function getImage(mint){
    void mint;
    return '';
  }

""" + c[b+1:]

if re.search(r"dexscreener|api\.dexscreener\.com|external\.dexscreener", c, re.I):
    raise SystemExit("ERROR: DexScreener code still remains in active index.html")
p.write_text(c)

PY

node --check memeflow-app/app-server.mjs
node --check memeflow-app/src/manual-scan.mjs
node --check memeflow-app/system-tokens.js

echo
echo "=== Active-file DexScreener verification ==="
FAIL=0
for f in "${TARGETS[@]}"; do
  if grep -niI "dexscreener" "$f"; then
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo "ERROR: DexScreener still exists in active target files. Nothing committed."
  exit 1
fi

echo "OK: DexScreener removed from active runtime/page files."
echo
echo "NOTE: old hidden backup folders may still contain historical copies; they are not served or executed."

echo
echo "=== Diff summary ==="
git diff --stat -- "${TARGETS[@]}"

git add "${TARGETS[@]}"
git commit -m "remove: DexScreener from MEMEFLOW active runtime and UI"
git push origin HEAD

echo
echo "DONE"
echo "Backup of pre-patch target files: $BACKUP"
