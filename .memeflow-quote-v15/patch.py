from pathlib import Path
import re, sys, shutil, datetime

ROOT = Path('memeflow-app')
FILES = {
    'server': ROOT/'app-server.mjs',
    'feed': ROOT/'src/pump-live-trade-feed.mjs',
    'archive': ROOT/'src/chart-history-archive.mjs',
    'market': ROOT/'src/live-card-market.mjs',
    'mark': ROOT/'src/paper-position-mark-v81.mjs',
    'paper': ROOT/'src/paper-engine.mjs',
}

for name, path in FILES.items():
    if not path.exists():
        raise SystemExit(f'ERROR: missing {path}')

stamp = datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
backup = Path('.memeflow-backups')/f'quote-aware-v15-{stamp}'
backup.mkdir(parents=True, exist_ok=True)
for path in FILES.values():
    dst = backup/path
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dst)


def sub_once(text, pattern, repl, label, flags=0):
    new, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f'ERROR: {label}: expected 1 match, got {n}')
    return new

# ------------------------------------------------------------------
# 1) Live Pump feed: trusted quote-mint priority + stale-price invalidation
# ------------------------------------------------------------------
p = FILES['feed']
s = p.read_text()
if 'MEMEFLOW_QUOTE_AWARE_PUMP_PRICE_V15' not in s:
    s = s.replace("const VERSION='V14.0';", "const VERSION='V15.0';", 1)
    s = s.replace('// MEMEFLOW_QUOTE_AWARE_PUMP_PRICE_V14', '// MEMEFLOW_QUOTE_AWARE_PUMP_PRICE_V14\n// MEMEFLOW_QUOTE_AWARE_PUMP_PRICE_V15', 1)

    old = """function marketFromEvent(e,token,solUsd){
  const quoteMint=String(e?.quoteMint||token?.quoteMint||'').trim();

  const quoteKind=
    !quoteMint||quoteMint===DEFAULT_PUBKEY||quoteMint===WSOL_MINT
      ? 'SOL'
      : quoteMint===USDC_MINT
        ? 'USDC'
        : 'UNSUPPORTED';"""
    new = """function marketFromEvent(e,token,solUsd){
  // V15: CreateEvent quoteMint is canonical when already known. A partially
  // decoded newer TradeEvent must never override it with garbage/stale bytes.
  const tokenQuoteMint=String(token?.quoteMint||'').trim();
  const eventQuoteMint=String(e?.quoteMint||'').trim();
  const quoteMint=tokenQuoteMint||eventQuoteMint;
  const hasQuoteTail=Boolean(
    e?.quoteAmount!==null&&e?.quoteAmount!==undefined ||
    e?.virtualQuoteReserves!==null&&e?.virtualQuoteReserves!==undefined ||
    e?.realQuoteReserves!==null&&e?.realQuoteReserves!==undefined
  );

  const quoteKind=
    !quoteMint
      ? (hasQuoteTail?'UNSUPPORTED':'SOL')
      : quoteMint===DEFAULT_PUBKEY||quoteMint===WSOL_MINT
        ? 'SOL'
        : quoteMint===USDC_MINT
          ? 'USDC'
          : 'UNSUPPORTED';"""
    if old not in s:
        raise SystemExit('ERROR: feed marketFromEvent V14 block not found')
    s = s.replace(old, new, 1)

    anchor = """      if(Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;
      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;
      if(Number.isFinite(m.liquidityUsd)&&m.liquidityUsd>=0)patch.liquidityUsd=m.liquidityUsd;
      if(Number.isFinite(liveSupply)&&liveSupply>0)patch.totalSupply=liveSupply;
      if(Number.isFinite(liveMarketCapSol)&&liveMarketCapSol>0)patch.marketCapSol=liveMarketCapSol;
      if(Number.isFinite(liveMarketCapUsd)&&liveMarketCapUsd>0)patch.marketCapUsd=liveMarketCapUsd;"""
    repl = """      if(Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;
      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;
      if(Number.isFinite(m.liquidityUsd)&&m.liquidityUsd>=0)patch.liquidityUsd=m.liquidityUsd;
      if(Number.isFinite(liveSupply)&&liveSupply>0)patch.totalSupply=liveSupply;
      if(Number.isFinite(liveMarketCapSol)&&liveMarketCapSol>0)patch.marketCapSol=liveMarketCapSol;
      if(Number.isFinite(liveMarketCapUsd)&&liveMarketCapUsd>0)patch.marketCapUsd=liveMarketCapUsd;

      // MEMEFLOW_QUOTE_STALE_MARK_PURGE_V15
      // V14 correctly blocked unsafe execution but an old V13 price could
      // survive in persisted token state and still be displayed. Explicitly
      // invalidate those fields. Store may retain historical peak internally,
      // but every market/display/trading consumer below is now fail-closed.
      if(m.quotePricingReady!==true){
        patch.priceSol=null;
        patch.marketCapSol=null;
        patch.marketCapUsd=null;
        patch.liquiditySol=null;
        patch.liquidityUsd=null;
      }"""
    if anchor not in s:
        raise SystemExit('ERROR: feed price patch anchor not found')
    s = s.replace(anchor, repl, 1)
    p.write_text(s)

# ------------------------------------------------------------------
# 2) Chart history: rebuild in a fresh archive with quote-aware decoding
# ------------------------------------------------------------------
p = FILES['archive']
s = p.read_text()
if 'MEMEFLOW_CHART_QUOTE_BACKFILL_V15' not in s:
    s = s.replace(
        "import crypto from 'node:crypto';",
        "import crypto from 'node:crypto';\nimport {decodeTradeEvent as decodePumpTradeEvent} from './pump-live-trade-feed.mjs'; // MEMEFLOW_CHART_QUOTE_BACKFILL_V15",
        1
    )
    s = s.replace(
        "const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';",
        "const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';\nconst DEFAULT_PUBKEY='11111111111111111111111111111111';\nconst WSOL_MINT='So11111111111111111111111111111111111111112';\nconst USDC_MINT='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';",
        1
    )

    market_old = re.compile(r"function marketPriceSol\(event\) \{.*?\n\}\n\nfunction cleanMint", re.S)
    market_new = r"""function tokenDecimalsFromTx(tx,mint,fallback=6){
  const rows=[
    ...(tx?.meta?.preTokenBalances||[]),
    ...(tx?.meta?.postTokenBalances||[])
  ];
  for(const row of rows){
    if(String(row?.mint||'')!==String(mint||''))continue;
    const d=Number(row?.uiTokenAmount?.decimals);
    if(Number.isInteger(d)&&d>=0&&d<=12)return d;
  }
  const n=Number(fallback);
  return Number.isInteger(n)&&n>=0&&n<=12?n:6;
}

function marketPoint(event,{token={},solUsd=null,decimals=6}={}){
  const tokenQuote=String(token?.quoteMint||'').trim();
  const eventQuote=String(event?.quoteMint||'').trim();
  const quoteMint=tokenQuote||eventQuote;
  const hasQuoteTail=Boolean(
    event?.quoteAmount!==null&&event?.quoteAmount!==undefined ||
    event?.virtualQuoteReserves!==null&&event?.virtualQuoteReserves!==undefined ||
    event?.realQuoteReserves!==null&&event?.realQuoteReserves!==undefined
  );

  const kind=
    !quoteMint
      ? (hasQuoteTail?'UNSUPPORTED':'SOL')
      : quoteMint===DEFAULT_PUBKEY||quoteMint===WSOL_MINT
        ? 'SOL'
        : quoteMint===USDC_MINT
          ? 'USDC'
          : 'UNSUPPORTED';

  const rate=Number(solUsd);

  if(kind==='SOL'){
    if(!(event?.virtualSolReserves>0n&&event?.virtualTokenReserves>0n))return null;
    const priceSol=
      (Number(event.virtualSolReserves)/1e9)/
      (Number(event.virtualTokenReserves)/(10**decimals));
    if(!(Number.isFinite(priceSol)&&priceSol>0))return null;
    return {
      priceSol,
      solAmount:Number(event.solAmount||0n)/1e9,
      source:'pump-history-backfill'
    };
  }

  if(kind==='USDC'){
    const quoteRaw=event?.quoteAmount??event?.solAmount;
    const tokenRaw=event?.tokenAmount;
    if(!(quoteRaw>0n&&tokenRaw>0n&&Number.isFinite(rate)&&rate>0))return null;
    const quoteUsd=Number(quoteRaw)/1e6;
    const tokenUi=Number(tokenRaw)/(10**decimals);
    if(!(quoteUsd>0&&tokenUi>0))return null;
    const priceUsd=quoteUsd/tokenUi;
    const priceSol=priceUsd/rate;
    if(!(Number.isFinite(priceSol)&&priceSol>0))return null;
    return {
      priceSol,
      priceUsd,
      solAmount:quoteUsd/rate,
      source:'pump-history-backfill-quote-aware'
    };
  }

  return null;
}

function cleanMint"""
    s, n = market_old.subn(market_new, s, count=1)
    if n != 1:
        raise SystemExit(f'ERROR: archive marketPriceSol replacement count={n}')

    s = s.replace(
        "constructor({ dataDir, rpc, pageSize = 1000, txConcurrency = 1 } = {}) {\n    this.root = path.join(String(dataDir || 'data'), 'chart-history-v30-10');\n    this.rpc = rpc;",
        "constructor({ dataDir, rpc, pageSize = 1000, txConcurrency = 1, getToken = null, getSolUsd = null } = {}) {\n    // Fresh namespace guarantees that pre-V15 wrong non-SOL candles/meta are never reused.\n    this.root = path.join(String(dataDir || 'data'), 'chart-history-v30-10-quote-v15');\n    this.rpc = rpc;\n    this.getToken = typeof getToken==='function'?getToken:()=>null;\n    this.getSolUsd = typeof getSolUsd==='function'?getSolUsd:()=>null;",
        1
    )

    s = s.replace('const event = decodeTradeEvent(buf);', 'const event = decodePumpTradeEvent(buf);', 1)

    old = """        const priceSol = marketPriceSol(event);
        if (!(Number.isFinite(priceSol) && priceSol > 0)) continue;

        const eventAt = ("""
    new = """        const token=this.getToken?.(mint)||{};
        const decimals=tokenDecimalsFromTx(
          tx,
          mint,
          token?.tokenDecimals??token?.decimals??6
        );
        const market=marketPoint(event,{
          token,
          solUsd:this.getSolUsd?.(),
          decimals
        });
        if(!market)continue;
        const priceSol=market.priceSol;

        const eventAt = ("""
    if old not in s:
        raise SystemExit('ERROR: archive transaction price block not found')
    s = s.replace(old, new, 1)

    old = """          source: 'pump-history-backfill',
          isBuy: event.isBuy === true,
          solAmount: Number(event.solAmount) / 1e9,
          tokenAmount: Number(event.tokenAmount) / 1e6"""
    new = """          source: market.source,
          isBuy: event.isBuy === true,
          solAmount: market.solAmount,
          tokenAmount: Number(event.tokenAmount) / (10**decimals)"""
    if old not in s:
        raise SystemExit('ERROR: archive point block not found')
    s = s.replace(old, new, 1)
    p.write_text(s)

# ------------------------------------------------------------------
# 3) Server: re-enable quote-aware backfill + never expose persisted bad price
# ------------------------------------------------------------------
p = FILES['server']
s = p.read_text()
if 'MEMEFLOW_QUOTE_STALE_DISPLAY_GUARD_V15' not in s:
    ctor_old = """const __mfChartArchive=new ChartHistoryArchive({
  dataDir,
  rpc:__mfChartHistoryRpc,
  pageSize:250,
  txConcurrency:1
});"""
    ctor_new = """const __mfChartArchive=new ChartHistoryArchive({
  dataDir,
  rpc:__mfChartHistoryRpc,
  pageSize:250,
  txConcurrency:1,
  getToken:mint=>store.state.tokens?.[String(mint||'')]||null,
  getSolUsd:()=>solUsdOracle.get()
});"""
    if ctor_old not in s:
        raise SystemExit('ERROR: chart archive constructor block not found')
    s = s.replace(ctor_old, ctor_new, 1)

    old_guard = """  // Historical pre-V14 non-SOL points were priced with SOL semantics.
  // Do not backfill them into the canonical chart.
  if(__mfChartQuoteKindV14(mint)!=='SOL')return;
"""
    if old_guard not in s:
        raise SystemExit('ERROR: V14 non-SOL backfill guard not found')
    s = s.replace(old_guard, "  // V15 backfill is quote-aware for SOL and USDC.\n", 1)

    old_progress = """  const job=__mfChartArchive.ensureBackfill(mint,{
    onProgress:()=>__mfBroadcastChartSnapshot(mint)
  })"""
    new_progress = """  const job=__mfChartArchive.ensureBackfill(mint,{
    onProgress:()=>{
      __mfOpenPositionArchiveWarmedV22.delete(mint);
      __mfBroadcastChartSnapshot(mint);
    }
  })"""
    if old_progress not in s:
        raise SystemExit('ERROR: chart onProgress block not found')
    s = s.replace(old_progress, new_progress, 1)

    old = "  const livePriceSol=finite(market5m.currentPriceSol)??finite(t.priceSol);"
    new = """  // MEMEFLOW_QUOTE_STALE_DISPLAY_GUARD_V15
  // A persisted pre-fix price is never allowed to leak into the UI.
  // Correct quote-aware archive/live TradeEvents remain valid.
  const livePriceSol=
    finite(market5m.currentPriceSol) ??
    (t?.quotePricingReady===false?null:finite(t.priceSol));"""
    if old not in s:
        raise SystemExit('ERROR: candidate livePriceSol line not found')
    s = s.replace(old, new, 1)

    s = s.replace(
        "    protocol:t.protocol||t.launchPlatform||null,\n    price:livePriceSol,",
        "    protocol:t.protocol||t.launchPlatform||null,\n    quoteMint:t.quoteMint||null,\n    quotePricingReady:t.quotePricingReady!==false,\n    quotePricingMode:t.quotePricingMode||null,\n    price:livePriceSol,",
        1
    )
    s = s.replace(
        "    routeApproved:t.priceSol!=null,",
        "    routeApproved:t.quotePricingReady!==false&&livePriceSol!=null,",
        1
    )

    old = """  const priceSol=
    finite(t?.priceSol??t?.price);"""
    new = """  const priceSol=
    finite(market5m?.currentPriceSol) ??
    (t?.quotePricingReady===false
      ? null
      : finite(t?.priceSol??t?.price));"""
    if old not in s:
        raise SystemExit('ERROR: live card priceSol block not found')
    s = s.replace(old, new, 1)

    # add quote fields to live-card payload (second occurrence after __mfLiveCardViewV14)
    marker = "function __mfLiveCardViewV14"
    idx = s.find(marker)
    if idx < 0:
        raise SystemExit('ERROR: live card function not found')
    tail = s[idx:]
    old2 = "    protocol:t?.protocol||t?.launchPlatform||'pump',\n    source:t?.source||null,"
    new2 = "    protocol:t?.protocol||t?.launchPlatform||'pump',\n    source:t?.source||null,\n    quoteMint:t?.quoteMint||null,\n    quotePricingReady:t?.quotePricingReady!==false,\n    quotePricingMode:t?.quotePricingMode||null,"
    if old2 not in tail:
        raise SystemExit('ERROR: live card protocol/source block not found')
    tail = tail.replace(old2, new2, 1)
    s = s[:idx] + tail

    p.write_text(s)

# ------------------------------------------------------------------
# 4) Market snapshot: archive points are valid; stale token fallback is not
# ------------------------------------------------------------------
p = FILES['market']
s = p.read_text()
if 'MEMEFLOW_QUOTE_STALE_MARK_GUARD_V15' not in s:
    old = """  const tokenHasTradeEvidence=Boolean(
    tokenPrice!==null&&
    tokenPrice>0&&"""
    new = """  // MEMEFLOW_QUOTE_STALE_MARK_GUARD_V15
  const quoteTokenPriceTrusted=token?.quotePricingReady!==false;

  const tokenHasTradeEvidence=Boolean(
    quoteTokenPriceTrusted&&
    tokenPrice!==null&&
    tokenPrice>0&&"""
    if old not in s:
        raise SystemExit('ERROR: live-card tokenHasTradeEvidence block not found')
    s = s.replace(old, new, 1)
    p.write_text(s)

# ------------------------------------------------------------------
# 5) Paper mark: fail closed on persisted bad quote price
# ------------------------------------------------------------------
p = FILES['mark']
s = p.read_text()
if 'MEMEFLOW_QUOTE_MARK_FAIL_CLOSED_V15' not in s:
    old = """  const openedAtMs = finiteTime(position?.openedAtMs);
  const entryPriceSol = finitePositive(position?.entryPriceSol);"""
    new = """  const openedAtMs = finiteTime(position?.openedAtMs);
  const entryPriceSol = finitePositive(position?.entryPriceSol);
  // MEMEFLOW_QUOTE_MARK_FAIL_CLOSED_V15
  const quotePriceBlocked=token?.quotePricingReady===false;"""
    if old not in s:
        raise SystemExit('ERROR: paper mark opening block not found')
    s = s.replace(old, new, 1)

    s = s.replace(
        """  if (
    tokenPriceSol !== null &&
    hasTradeEvidence &&""",
        """  if (
    !quotePriceBlocked &&
    tokenPriceSol !== null &&
    hasTradeEvidence &&""",
        1
    )
    s = s.replace(
        """  if (
    tokenPriceSol !== null &&
    usableFreshTimestamp(""",
        """  if (
    !quotePriceBlocked &&
    tokenPriceSol !== null &&
    usableFreshTimestamp(""",
        1
    )
    s = s.replace(
        """  if (
    enginePriceSol !== null &&
    usableFreshTimestamp(""",
        """  if (
    !quotePriceBlocked &&
    enginePriceSol !== null &&
    usableFreshTimestamp(""",
        1
    )
    p.write_text(s)

# ------------------------------------------------------------------
# 6) Paper entry: central fail-closed guard, including copy trading
# ------------------------------------------------------------------
p = FILES['paper']
s = p.read_text()
if 'MEMEFLOW_QUOTE_ENTRY_FAIL_CLOSED_V15' not in s:
    old = """  openPosition(userId, token, decision, rawSettings = {}, idempotencyKey = null) {
    const settings = this.settings(rawSettings);"""
    new = """  openPosition(userId, token, decision, rawSettings = {}, idempotencyKey = null) {
    const settings = this.settings(rawSettings);

    // MEMEFLOW_QUOTE_ENTRY_FAIL_CLOSED_V15
    // Applies to normal automation AND copy trading. Never size a position
    // from an unresolved/non-canonical quote price.
    if(token?.quotePricingReady===false){
      return {
        ok:false,
        code:'QUOTE_PRICE_NOT_READY'
      };
    }"""
    if old not in s:
        raise SystemExit('ERROR: paper openPosition anchor not found')
    s = s.replace(old, new, 1)
    p.write_text(s)

print('OK: MEMEFLOW quote-aware V15 patch applied')
print(f'Backup: {backup}')
print('Changed files:')
for path in FILES.values():
    print(' -', path)
