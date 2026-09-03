#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-dex-remove-v2-$STAMP"
mkdir -p "$BACKUP"
cp memeflow-app/app-server.mjs "$BACKUP/app-server.mjs"
cp memeflow-app/src/manual-scan.mjs "$BACKUP/manual-scan.mjs"
cp memeflow-app/system-tokens.js "$BACKUP/system-tokens.js"

python3 - <<'PY'
from pathlib import Path
import re

def sub1(text, pattern, repl, label):
    new, n = re.subn(pattern, repl, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f"ERROR: {label} not found ({n})")
    return new

# ---------- app-server.mjs ----------
p = Path("memeflow-app/app-server.mjs")
c = p.read_text()

c = sub1(
    c,
    r"async function mf49FetchJson\(url,timeoutMs=8000\)\{.*?(?=async function mf49DeveloperPct\()",
    """async function mf49ResolveInput(raw){
 const input=String(raw||'').trim();
 if(!input)throw mf49Err('Paste a Solana mint or Pump.fun link.',400,'TOKEN_INPUT_REQUIRED');
 const matches=input.match(MF48_KEY_RE)||[];
 const mint=matches.find(x=>validPubkey(x));
 if(!mint)throw mf49Err('A valid Solana mint address was not found in that value.',400,'INVALID_SOLANA_MINT');
 return {mint,inputKind:/pump\\.fun/i.test(input)?'pump-fun':'mint'}
}
""",
    "standalone Dex helper region"
)

c = sub1(
    c,
    r""" let pair=resolved\.pair\|\|null;.*?(?= let priceSol=)""",
    """ const name=canonicalToken.name||known.name||known.symbol||null;
 const symbol=canonicalToken.symbol||known.symbol||null;
 const priceUsd=mf49Num(canonicalToken.priceUsd)??mf49Num(known.priceUsd);
 const liquidityUsd=mf49Num(canonicalToken.liquidityUsd)??mf49Num(known.liquidityUsd);
 const marketCapUsd=mf49Num(canonicalToken.marketCapUsd)??mf49Num(known.marketCapUsd);
 const volume5mUsd=mf49Num(known?.market?.volume5mUsd)??mf49Num(known.volume5mUsd);
 const buys5m=mf49Num(known?.market?.buys5m)??mf49Num(known.buys5m);
 const sells5m=mf49Num(known?.market?.sells5m)??mf49Num(known.sells5m);

""",
    "standalone Dex market block"
)

c = re.sub(
    r"\}else if\(buyPressure==null&&pair\)\{.*?\n \}",
    "}",
    c,
    count=1,
    flags=re.S
)

c = c.replace(
    "  volume24hUsd:mf49Num(pair?.volume?.h24),",
    "  volume24hUsd:mf49Num(known?.market?.volume24hUsd)??mf49Num(known.volume24hUsd),"
)
c = c.replace(
    "  buyTransactions:mf49Num(pair?.txns?.h24?.buys)??buys5m,",
    "  buyTransactions:mf49Num(known?.market?.buyTransactions)??mf49Num(known.buyTransactions)??buys5m,"
)
c = c.replace(
    "  sellTransactions:mf49Num(pair?.txns?.h24?.sells)??sells5m,",
    "  sellTransactions:mf49Num(known?.market?.sellTransactions)??mf49Num(known.sellTransactions)??sells5m,"
)
c = re.sub(
    r"  totalTransactions:\(\(\)=>\{const b=mf49Num\(pair\?\.txns\?\.h24\?\.buys\)\?\?buys5m,s=mf49Num\(pair\?\.txns\?\.h24\?\.sells\)\?\?sells5m;return b!=null&&s!=null\?b\+s:null\}\)\(\),",
    "  totalTransactions:(()=>{const b=mf49Num(known?.market?.buyTransactions)??mf49Num(known.buyTransactions)??buys5m,s=mf49Num(known?.market?.sellTransactions)??mf49Num(known.sellTransactions)??sells5m;return b!=null&&s!=null?b+s:null})(),",
    c,
    count=1
)
c = c.replace(
    " if(!pair&&priceSol==null)warnings.push('No DEX or bonding-curve price was available.');",
    " if(priceSol==null&&priceUsd==null)warnings.push('No MEMEFLOW or bonding-curve price was available.');"
)
c = sub1(
    c,
    r"""   priceChange5mPct:mf49Num\(pair\?\.priceChange\?\.m5\),\n   pairAddress:pair\?\.pairAddress\|\|null,\n   dexId:pair\?\.dexId\|\|null,\n   pairUrl:pair\?\.url\|\|null""",
    "   priceChange5mPct:mf49Num(known?.market?.priceChange5mPct)??mf49Num(known.priceChange5mPct)",
    "Dex response fields"
)
c = re.sub(
    r"\nconst MF48_NATIVE_SYMBOLS=new Set\(\['SOL','WSOL','USDC','USDT'\]\);",
    "",
    c,
    count=1
)

if re.search(r"dexscreener|api\.dexscreener\.com|mf49DexPairForMint|mf49PairToken|mf49TxnWindow", c, re.I):
    raise SystemExit("ERROR: DexScreener code still remains in app-server.mjs")
p.write_text(c)

# ---------- manual-scan.mjs ----------
p = Path("memeflow-app/src/manual-scan.mjs")
c = p.read_text()

if "decodeCurve" not in c.splitlines()[0:5].__str__():
    c = c.replace(
        "import { decodePumpCreate } from './solana.mjs';",
        "import { decodeCurve, decodePumpCreate } from './solana.mjs';",
        1
    )

c = sub1(
    c,
    r"async function dexToken\(mint\) \{.*?(?=export async function manualAnalyze\()",
    "",
    "manual Dex helper region"
)
c = c.replace("\n  const pair = await dexToken(mint);\n", "\n", 1)

c = sub1(
    c,
    r"""  const liquidityUsd = firstFinite\(.*?(?=  /\*\n   \* IMPORTANT:)""",
    """  const liquidityUsd = firstFinite(existing.liquidityUsd);
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
        const decodedCurve = decodeCurve(
          curveInfo.value.data[0],
          decimals
        );
        priceSol = firstFinite(decodedCurve?.priceSol, priceSol);
        liquiditySol = firstFinite(decodedCurve?.liquiditySol, liquiditySol);
      }
    } catch {
      // Optional curve evidence; holder/supply analysis must continue.
    }
  }

  const buyPressure = firstFinite(existing.buyPressure);

""",
    "manual Dex market-data block"
)

c = c.replace(
    """    name:
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
        : 'Solana RPC + MEMEFLOW holder engine',""",
    """    name:
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
)

c = c.replace(
    """    liquidityUsd,
    marketCapUsd,""",
    """    liquidityUsd,
    liquiditySol,
    marketCapUsd,""",
    1
)

c = re.sub(
    r"\n\s*dexAvailable:\s*Boolean\(pair\),\n",
    "\n",
    c,
    count=1
)

if re.search(r"dexscreener|api\.dexscreener\.com|dexToken|dexBuyPressure|\bpair\?\.", c, re.I):
    raise SystemExit("ERROR: DexScreener code still remains in manual-scan.mjs")
p.write_text(c)

# ---------- system-tokens.js ----------
p = Path("memeflow-app/system-tokens.js")
c = p.read_text()

c = c.replace(
    "  const dex = safeExternalUrl(row?.dexUrl ?? row?.market?.dexUrl);\n",
    "",
    1
)
c = c.replace("  return { dex, pump };", "  return { pump };", 1)

c = sub1(
    c,
    r"""\n  if \(links\.dex\) \{\n    out\.push\(`.*?</a>`\);\n  \}\n""",
    "\n",
    "DexScreener card link"
)

if re.search(r"dexscreener|links\.dex|dexUrl", c, re.I):
    raise SystemExit("ERROR: DexScreener UI reference still remains in system-tokens.js")
p.write_text(c)
PY

node --check memeflow-app/app-server.mjs
node --check memeflow-app/src/manual-scan.mjs
node --check memeflow-app/system-tokens.js

echo
echo "=== DexScreener verification ==="
if grep -RniI --exclude-dir=node_modules --exclude-dir=data --exclude='*.map' -i "dexscreener" memeflow-app; then
  echo "ERROR: references remain in active memeflow-app; nothing committed."
  exit 1
else
  echo "OK: no DexScreener references remain in active memeflow-app."
fi

echo
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
echo "Backup is in $BACKUP"
