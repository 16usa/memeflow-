
from pathlib import Path
import re

ROOT = Path("memeflow-app")
feed = ROOT / "src/pump-live-trade-feed.mjs"
archive = ROOT / "src/chart-history-archive.mjs"
history = ROOT / "src/pump-history-backfill.mjs"
server = ROOT / "app-server.mjs"
trading = ROOT / "trading.js"

required = {
    feed: "MEMEFLOW_EXECUTION_PRICE_AUTHORITY_V16",
    archive: "MEMEFLOW_CHART_EXECUTION_PRICE_AUTHORITY_V16",
    history: "MEMEFLOW_PUMP_UNIT_NORMALIZATION_V16",
}
for path, marker in required.items():
    text = path.read_text()
    if marker not in text:
        raise SystemExit(
            f"ERROR: expected partial V16 marker missing in {path}: {marker}"
        )

s = server.read_text()

if "MEMEFLOW_REFERENCE_REPAIR_AND_CIRCUIT_BREAKER_V16_1" not in s:
    pattern = re.compile(
        r"\n\s*if\(Number\.isFinite\(Number\(token\?\.marketCapUsd\)\)\)\{\s*"
        r"referencePatch\.pumpReportedMarketCapUsd=Number\(token\.marketCapUsd\);\s*"
        r"\}\s*"
        r"\n\s*store\.setToken\(token\.mint,referencePatch\);",
        re.S,
    )

    replacement = """        // MEMEFLOW_REFERENCE_REPAIR_AND_CIRCUIT_BREAKER_V16_1
        if(token?.quoteMint){
          referencePatch.quoteMint=String(token.quoteMint);
        }
        if(Number.isFinite(Number(token?.quoteDecimals))){
          referencePatch.quoteDecimals=Number(token.quoteDecimals);
        }
        if(Number.isFinite(Number(token?.tokenDecimals))){
          referencePatch.tokenDecimals=Number(token.tokenDecimals);
        }
        if(token?.virtualQuoteReservesRaw!=null){
          referencePatch.virtualQuoteReservesRaw=
            String(token.virtualQuoteReservesRaw);
        }
        if(token?.realQuoteReservesRaw!=null){
          referencePatch.realQuoteReservesRaw=
            String(token.realQuoteReservesRaw);
        }

        const pumpMcUsd=Number(token?.marketCapUsd);
        const pumpMcSol=Number(token?.marketCapSol);
        const liveSolUsd=Number(solUsdOracle.get());

        const referenceMc=
          Number.isFinite(pumpMcUsd)&&pumpMcUsd>0
            ? pumpMcUsd
            : (
                Number.isFinite(pumpMcSol)&&pumpMcSol>0&&
                Number.isFinite(liveSolUsd)&&liveSolUsd>0
                  ? pumpMcSol*liveSolUsd
                  : null
              );

        if(Number.isFinite(referenceMc)&&referenceMc>0){
          referencePatch.pumpReportedMarketCapUsd=referenceMc;

          const localMc=Number(current?.marketCapUsd);
          if(Number.isFinite(localMc)&&localMc>0){
            const ratio=
              Math.max(localMc,referenceMc)/
              Math.min(localMc,referenceMc);

            if(ratio>20){
              referencePatch.quotePricingReady=false;
              referencePatch.quotePricingMode='REFERENCE_MISMATCH';
              referencePatch.marketSanityRatio=ratio;
              referencePatch.priceSol=null;
              referencePatch.marketCapSol=null;
              referencePatch.marketCapUsd=referenceMc;
              referencePatch.liquiditySol=null;
              referencePatch.liquidityUsd=null;
            }
          }
        }

        store.setToken(token.mint,referencePatch);"""

    s, n = pattern.subn(replacement, s, count=1)
    if n != 1:
        raise SystemExit(
            "ERROR: V16.1 server anchor not found. Nothing was committed."
        )

    server.write_text(s)

s = trading.read_text()

if "MEMEFLOW_REFERENCE_MC_DISPLAY_FALLBACK_V16" not in s:
    pattern = re.compile(
        r"function marketCapUsdForPrice\(priceUsd, candidate = state\.selected\) \{\s*"
        r"const px = num\(priceUsd\);\s*"
        r"if \(!\(px > 0\)\) return null;\s*"
        r"\n\s*const supply = tokenSupply\(candidate\);",
        re.S,
    )

    replacement = """function marketCapUsdForPrice(priceUsd, candidate = state.selected) {
  const px = num(priceUsd);

  // MEMEFLOW_REFERENCE_MC_DISPLAY_FALLBACK_V16
  if (!(px > 0)) {
    const storedUsd=num(candidate?.marketCapUsd??candidate?.marketCapUSD);
    return storedUsd>0?storedUsd:null;
  }

  const supply = tokenSupply(candidate);"""

    s, n = pattern.subn(replacement, s, count=1)
    if n != 1:
        raise SystemExit(
            "ERROR: V16.1 trading market-cap anchor not found. Nothing was committed."
        )

    trading.write_text(s)

print("V16.1 REPAIR PATCH APPLIED")
