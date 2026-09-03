#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/tmp/memeflow-remove-dexscreener-$STAMP"
mkdir -p "$BACKUP_DIR"

for f in \
  memeflow-app/app-server.mjs \
  memeflow-app/src/manual-scan.mjs \
  memeflow-app/system-tokens.js
do
  cp "$f" "$BACKUP_DIR/$(basename "$f")"
done

python3 - <<'PY'
from pathlib import Path
import re

# ---------------- app-server.mjs ----------------
p = Path("memeflow-app/app-server.mjs")
c = p.read_text()

# Remove DexScreener-only helpers, and make input mint/Pump.fun only.
start = c.index("async function mf49FetchJson(")
end = c.index("async function mf49DeveloperPct(", start)

replacement = r"""async function mf49ResolveInput(raw){
 const input=String(raw||'').trim();
 if(!input)throw mf49Err('Paste a Solana mint or Pump.fun link.',400,'TOKEN_INPUT_REQUIRED');
 const matches=input.match(MF48_KEY_RE)||[];
 const mint=matches.find(x=>validPubkey(x));
 if(!mint)throw mf49Err('A valid Solana mint address was not found in that value.',400,'INVALID_SOLANA_MINT');
 return {mint,inputKind:/pump\.fun/i.test(input)?'pump-fun':'mint'}
}
"""
c = c[:start] + replacement + c[end:]

old = r""" let pair=resolved.pair||null;
 if(!pair){
  try{pair=await mf49DexPairForMint(mint);if(pair)sources.add('DexScreener')}
  catch(e){warnings.push(`DEX: ${e.message}`)}
 }else sources.add('DexScreener');

 const side=pair?mf49PairToken(pair,mint):null;
 const name=side?.name||known.name||null,symbol=side?.symbol||known.symbol||null;
 const priceUsd=mf49Num(pair?.priceUsd)??mf49Num(canonicalToken.priceUsd);
 const liquidityUsd=mf49Num(pair?.liquidity?.usd)??mf49Num(canonicalToken.liquidityUsd);
 const marketCapUsd=mf49Num(pair?.marketCap)??mf49Num(pair?.fdv)??mf49Num(canonicalToken.marketCapUsd)??(priceUsd!=null&&total!=null?priceUsd*total:null);
 const volume5mUsd=mf49Num(pair?.volume?.m5);
 const tx5=pair?.txns?.m5||null;
 const buys5m=mf49Num(tx5?.buys),sells5m=mf49Num(tx5?.sells);
"""
new = r""" const name=canonicalToken.name||known.name||known.symbol||null;
 const symbol=canonicalToken.symbol||known.symbol||null;
 const priceUsd=mf49Num(canonicalToken.priceUsd)??mf49Num(known.priceUsd);
 const liquidityUsd=mf49Num(canonicalToken.liquidityUsd)??mf49Num(known.liquidityUsd);
 const marketCapUsd=mf49Num(canonicalToken.marketCapUsd)??mf49Num(known.marketCapUsd);
 const volume5mUsd=mf49Num(known?.market?.volume5mUsd)??mf49Num(known.volume5mUsd);
 const buys5m=mf49Num(known?.market?.buys5m)??mf49Num(known.buys5m);
 const sells5m=mf49Num(known?.market?.sells5m)??mf49Num(known.sells5m);
"""
if old not in c:
    raise SystemExit("app-server: standalone DexScreener market block not found")
c = c.replace(old, new, 1)

old = r""" }else if(buyPressure==null&&pair){
  const w=mf49TxnWindow(pair);
  if(w.buys!=null||w.sells!=null){
   buyPressure=w.sells?w.buys/w.sells:(w.buys||null)
  }
 }
"""
if old not in c:
    raise SystemExit("app-server: DexScreener buy-pressure fallback not found")
c = c.replace(old, " }\n", 1)

c = c.replace(
"""  volume24hUsd:mf49Num(pair?.volume?.h24),
  buyTransactions:mf49Num(pair?.txns?.h24?.buys)??buys5m,
  sellTransactions:mf49Num(pair?.txns?.h24?.sells)??sells5m,
  totalTransactions:(()=>{const b=mf49Num(pair?.txns?.h24?.buys)??buys5m,s=mf49Num(pair?.txns?.h24?.sells)??sells5m;return b!=null&&s!=null?b+s:null})(),""",
"""  volume24hUsd:mf49Num(known?.market?.volume24hUsd)??mf49Num(known.volume24hUsd),
  buyTransactions:mf49Num(known?.market?.buyTransactions)??mf49Num(known.buyTransactions)??buys5m,
  sellTransactions:mf49Num(known?.market?.sellTransactions)??mf49Num(known.sellTransactions)??sells5m,
  totalTransactions:(()=>{const b=mf49Num(known?.market?.buyTransactions)??mf49Num(known.buyTransactions)??buys5m,s=mf49Num(known?.market?.sellTransactions)??mf49Num(known.sellTransactions)??sells5m;return b!=null&&s!=null?b+s:null})(),""",
1
)

c = c.replace(
" if(!pair&&priceSol==null)warnings.push('No DEX or bonding-curve price was available.');",
" if(priceSol==null&&priceUsd==null)warnings.push('No MEMEFLOW or bonding-curve price was available.');",
1
)

c = c.replace(
"""   priceChange5mPct:mf49Num(pair?.priceChange?.m5),
   pairAddress:pair?.pairAddress||null,
   dexId:pair?.dexId||null,
   pairUrl:pair?.url||null""",
"""   priceChange5mPct:mf49Num(known?.market?.priceChange5mPct)??mf49Num(known.priceChange5mPct)""",
1
)

# Remove now-unused native symbol set if present.
c = re.sub(r"\nconst MF48_NATIVE_SYMBOLS=new Set\(\['SOL','WSOL','USDC','USDT'\]\);", "", c, count=1)

if re.search(r"dexscreener", c, re.I):
    raise SystemExit("app-server: DexScreener reference still remains")

p.write_text(c)

# ---------------- manual-scan.mjs ----------------
p = Path("memeflow-app/src/manual-scan.mjs")
c = p.read_text()

c = c.replace(
"import { decodePumpCreate } from './solana.mjs';",
"import { decodeCurve, decodePumpCreate } from './solana.mjs';",
1
)

start = c.index("async function dexToken(")
end = c.index("export async function manualAnalyze(", start)
c = c[:start] + c[end:]

c = c.replace("\n  const pair = await dexToken(mint);\n", "\n", 1)

old = r"""  const liquidityUsd = firstFinite(
    pair?.liquidity?.usd,
    existing.liquidityUsd
  );

  const marketCapUsd = firstFinite(
    pair?.marketCap,
    pair?.fdv,
    existing.marketCapUsd
  );

  const priceUsd = firstFinite(
    pair?.priceUsd,
    existing.priceUsd
  );

  let priceSol = firstFinite(existing.priceSol);

  const quoteSymbol =
    String(pair?.quoteToken?.symbol || '').toUpperCase();

  if (
    priceSol === null &&
    (quoteSymbol === 'SOL' || quoteSymbol === 'WSOL')
  ) {
    priceSol = firstFinite(pair?.priceNative);
  }

  const buyPressure = firstFinite(
    existing.buyPressure,
    dexBuyPressure(pair)
  );
"""
new = r"""  const liquidityUsd = firstFinite(
    existing.liquidityUsd
  );

  const marketCapUsd = firstFinite(
    existing.marketCapUsd
  );

  const priceUsd = firstFinite(
    existing.priceUsd
  );

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
          decodeCurve(
            curveInfo.value.data[0],
            decimals
          );

        priceSol =
          firstFinite(
            decodedCurve?.priceSol,
            priceSol
          );

        liquiditySol =
          firstFinite(
            decodedCurve?.liquiditySol,
            liquiditySol
          );
      }
    } catch {
      // Curve evidence is optional; holder/supply analysis continues.
    }
  }

  const buyPressure = firstFinite(
    existing.buyPressure
  );
"""
if old not in c:
    raise SystemExit("manual-scan: DexScreener market block not found")
c = c.replace(old, new, 1)

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
        : 'Solana RPC + MEMEFLOW holder engine',

    priceSol,
    priceUsd,
    liquidityUsd,
    marketCapUsd,""",
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
        : 'Solana RPC + MEMEFLOW holder engine',

    priceSol,
    priceUsd,
    liquidityUsd,
    liquiditySol,
    marketCapUsd,""",
1
)

# dexAvailable evidence is no longer meaningful.
c = c.replace(
"""      dexAvailable: Boolean(pair),

      holderScanAvailable:""",
"""      holderScanAvailable:""",
1
)

if re.search(r"dexscreener|dexToken|dexBuyPressure", c, re.I):
    raise SystemExit("manual-scan: DexScreener reference still remains")

p.write_text(c)

# ---------------- system-tokens.js ----------------
p = Path("memeflow-app/system-tokens.js")
c = p.read_text()

c = c.replace(
"""  const dex = safeExternalUrl(row?.dexUrl ?? row?.market?.dexUrl);
  let pump = safeExternalUrl(row?.pumpUrl);""",
"""  let pump = safeExternalUrl(row?.pumpUrl);""",
1
)

c = c.replace(
"""  return { dex, pump };""",
"""  return { pump };""",
1
)

dex_link_block = r"""
  if (links.dex) {
    out.push(`
      <a class="token-source-link dex" href="${escapeHtml(links.dex)}" target="_blank"
         rel="noopener noreferrer" aria-label="Open on DexScreener" title="DexScreener">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10" cy="10" r="5.1"></circle>
          <path d="M13.8 13.8L19 19"></path>
          <path d="M7.2 11.2L9.2 9.1L10.8 10.2L13 7.5"></path>
        </svg>
      </a>`);
  }
"""
if dex_link_block not in c:
    raise SystemExit("system-tokens.js: DexScreener link block not found")
c = c.replace(dex_link_block, "\n", 1)

if re.search(r"dexscreener", c, re.I):
    raise SystemExit("system-tokens.js: DexScreener reference still remains")

p.write_text(c)
PY

node --check memeflow-app/app-server.mjs
node --check memeflow-app/src/manual-scan.mjs
node --check memeflow-app/system-tokens.js

echo
echo "=== Active runtime DexScreener check ==="
if grep -Rni --exclude-dir=node_modules --exclude-dir=.git -i "dexscreener" memeflow-app; then
  echo
  echo "ERROR: DexScreener references still exist in active memeflow-app."
  echo "Nothing was committed."
  exit 1
else
  echo "OK: no DexScreener references remain in active memeflow-app."
fi

echo
echo "=== Diff summary ==="
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
echo "Local backup: $BACKUP_DIR"
echo "Restart the Replit project before testing Analyze."
