import { enrichHolders } from './enrich.mjs';
import { decodeCurve, decodePumpCreate } from './solana.mjs';

const finite = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const firstFinite = (...values) => {
  for (const value of values) {
    const n = finite(value);
    if (n !== null) return n;
  }
  return null;
};


const PUMP_PROGRAM =
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

/*
 * Find creator for an arbitrary Pump.fun mint.
 *
 * IMPORTANT:
 * Read-only RPC lookup only.
 * Does NOT write to MEMEFLOW store, decisions, Candidate Feed,
 * Paper Engine or LIVE execution.
 */
async function resolvePumpCreator(mint, rpc) {
  /*
   * Manual scan must never hang because creator history is expensive.
   * Creator is optional evidence; holders/top10/market analysis must
   * still complete if creator cannot be resolved quickly.
   */
  const deadline = Date.now() + 5500;

  const timed = async promise => {
    const left = deadline - Date.now();

    if (left <= 0) {
      throw new Error('creatorLookupTimeout');
    }

    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('creatorLookupTimeout')),
          Math.min(left, 2500)
        )
      )
    ]);
  };

  let rows = [];

  try {
    /*
     * Keep this intentionally small.
     * Do NOT walk thousands of mint transactions.
     */
    rows = await timed(
      rpc.call(
        'getSignaturesForAddress',
        [
          mint,
          {
            limit: 80,
            commitment: 'confirmed'
          }
        ]
      )
    );
  } catch (error) {
    return {
      creator: null,
      curve: null,
      createSignature: null,
      reason:
        error?.message === 'creatorLookupTimeout'
          ? 'creatorLookupTimeout'
          : 'signatureLookupFailed'
    };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      creator: null,
      curve: null,
      createSignature: null,
      reason: 'noMintSignatures'
    };
  }

  /*
   * Only inspect a small tail of the oldest transactions returned.
   * Never let creator lookup dominate Manual AI Scan latency.
   */
  const candidates = rows
    .filter(x => x?.signature)
    .slice(-8)
    .reverse();

  for (const row of candidates) {
    if (Date.now() >= deadline) break;

    let tx;

    try {
      tx = await timed(
        rpc.call(
          'getTransaction',
          [
            row.signature,
            {
              encoding: 'jsonParsed',
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            }
          ]
        )
      );
    } catch {
      continue;
    }

    if (!tx?.transaction?.message) continue;

    const message = tx.transaction.message;

    const keys = (message.accountKeys || []).map(key =>
      typeof key === 'string'
        ? key
        : key?.pubkey || ''
    );

    const outer = Array.isArray(message.instructions)
      ? message.instructions
      : [];

    const inner = Array.isArray(tx.meta?.innerInstructions)
      ? tx.meta.innerInstructions.flatMap(group =>
          Array.isArray(group?.instructions)
            ? group.instructions
            : []
        )
      : [];

    for (const ix of [...outer, ...inner]) {
      const programId =
        typeof ix?.programId === 'string'
          ? ix.programId
          : ix?.programId?.toString?.() ||
            (
              Number.isInteger(ix?.programIdIndex)
                ? keys[ix.programIdIndex]
                : ''
            );

      if (programId !== PUMP_PROGRAM) continue;

      let decoded;

      try {
        decoded = decodePumpCreate(ix, keys);
      } catch {
        continue;
      }

      if (
        decoded?.ok === true &&
        decoded?.mint === mint
      ) {
        return {
          creator: decoded.creator || null,
          curve: decoded.curve || null,
          createSignature: row.signature,
          kind: decoded.kind || null,
          launchMode: decoded.launchMode || null,
          name: decoded.name || null,
          symbol: decoded.symbol || null,
          uri: decoded.uri || null,
          reason:
            decoded.creator
              ? null
              : 'creatorMissingFromCreate'
        };
      }
    }
  }

  return {
    creator: null,
    curve: null,
    createSignature: null,
    reason:
      Date.now() >= deadline
        ? 'creatorLookupTimeout'
        : 'pumpCreateNotResolved'
  };
}

export async function manualAnalyze({
  mint,
  rpc,
  existing = {},
  settings,
  evaluate
}) {
  const startedAt = Date.now();

  let supplyResult = null;
  let rpcError = null;

  try {
    supplyResult = await rpc.call(
      'getTokenSupply',
      [mint, { commitment: 'confirmed' }]
    );
  } catch (error) {
    rpcError =
      error?.message ||
      'Solana RPC supply lookup unavailable';
  }


  /*
   * Reuse creator if MEMEFLOW already knows it.
   * Otherwise resolve it from the original Pump create transaction.
   */
  let creatorResolution = {
    creator:
      existing.creator ||
      existing.creatorWallet ||
      existing.developer ||
      existing.developerWallet ||
      null,
    curve:
      existing.curve ||
      existing.bondingCurve ||
      existing.associatedBondingCurve ||
      null,
    createSignature:
      existing.signature ||
      null,
    reason: null
  };

  if (!creatorResolution.creator) {
    try {
      const resolved = await resolvePumpCreator(mint, rpc);

      creatorResolution = {
        ...creatorResolution,
        ...resolved,
        creator:
          resolved?.creator ||
          creatorResolution.creator ||
          null,
        curve:
          resolved?.curve ||
          creatorResolution.curve ||
          null
      };
    } catch (error) {
      creatorResolution.reason =
        error?.message ||
        'creator lookup failed';
    }
  }

  const decimals =
    firstFinite(
      supplyResult?.value?.decimals,
      existing.decimals
    ) ?? 6;

  const totalSupply = firstFinite(
    supplyResult?.value?.uiAmountString,
    existing.totalSupply
  );

  const liquidityUsd = firstFinite(existing.liquidityUsd);
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

  /*
   * IMPORTANT:
   * This is an isolated in-memory token/store.
   *
   * enrichHolders() gets the exact same token structure it uses
   * in the automatic MEMEFLOW pipeline, but it cannot modify the
   * real application store.
   */
  const manualToken = {
    ...existing,

    mint,

    decimals,
    totalSupply,

    creator:
      creatorResolution.creator ||
      null,

    creatorWallet:
      creatorResolution.creator ||
      null,

    curve:
      creatorResolution.curve ||
      existing.curve ||
      existing.bondingCurve ||
      null,

    associatedBondingCurve:
      existing.associatedBondingCurve ||
      null,

    name:
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
    marketCapUsd,

    buyPressure,

    manualScan: true,
    manualScannedAt: Date.now()
  };

  const tempStore = {
    state: {
      tokens: {
        [mint]: { ...manualToken }
      }
    },

    setToken(targetMint, patch) {
      const current =
        this.state.tokens[targetMint] || {};

      this.state.tokens[targetMint] = {
        ...current,
        ...patch,
        updatedAt: Date.now()
      };

      return this.state.tokens[targetMint];
    }
  };

  let holderError = null;
  let holderRateLimited = false;

  try {
    const holderResult = await enrichHolders(
      mint,
      {
        rpc,

        /*
         * ISOLATED STORE ONLY.
         * Nothing goes into the real MEMEFLOW state.
         */
        store: tempStore,

        /*
         * Critical isolation:
         * no automatic decisions
         * no Candidate Feed publishing
         */
        evaluateAll: async () => {},
        publish: () => {},

        enrichDiag: null
      }
    );

    if (holderResult?.rateLimited) {
      holderRateLimited = true;
      holderError = 'Holder RPC temporarily rate limited';
    }

  } catch (error) {
    holderError =
      error?.message ||
      'MEMEFLOW holder scan failed';
  }

  /*
   * Exact result produced by the SAME holder algorithm used
   * by the automatic system.
   */
  const holderToken =
    tempStore.state.tokens[mint] || manualToken;

  const holderCount =
    firstFinite(holderToken.holderCount);

  const top10Pct =
    firstFinite(holderToken.top10Pct);

  const developerPct =
    firstFinite(
      holderToken.developerPct,
      holderToken.developerSharePct
    );

  const holderFresh =
    holderToken.holderFresh === true
      ? true
      : holderToken.holderFresh === false
        ? false
        : null;

  /*
   * NOTE:
   * Developer % requires the creator wallet.
   * If this mint was never previously seen by MEMEFLOW and
   * creator cannot be established from the mint itself,
   * developerPct correctly remains null instead of fake 0%.
   */

  const factual = [
    priceSol !== null || priceUsd !== null,
    totalSupply !== null,
    holderCount !== null,
    top10Pct !== null,
    developerPct !== null,
    buyPressure !== null,
    liquidityUsd !== null,
    holderFresh === true
  ];

  const dataQuality =
    factual.filter(Boolean).length / factual.length;

  const token = {
    ...holderToken,

    mint,

    decimals,
    totalSupply,

    priceSol,
    priceUsd,
    liquidityUsd,
    marketCapUsd,

    buyPressure,

    holderCount,
    top10Pct,
    developerPct,
    holderFresh,

    dataQuality,

    manualScan: true,
    manualScannedAt: Date.now()
  };

  /*
   * SAME AI evaluator.
   * SAME authenticated user Settings.
   * This happens only AFTER holder enrichment.
   */
  const decision = evaluate(token, settings);

  return {
    ok: true,
    manual: true,

    mint,
    token,
    decision,

    evidence: {
      rpcAvailable: !rpcError,
      rpcError,


      holderScanAvailable:
        holderFresh === true,

      holderScanError:
        holderError,

      holderRateLimited,

      holdersAvailable:
        holderCount !== null,

      top10Available:
        top10Pct !== null,

      developerAvailable:
        developerPct !== null,

      creatorAvailable:
        Boolean(creatorResolution.creator),

      creator:
        creatorResolution.creator || null,

      createSignature:
        creatorResolution.createSignature || null,

      creatorLookupReason:
        creatorResolution.reason || null,

      holderFresh,

      completeness:
        Math.round(dataQuality * 100)
    },

    settingsApplied: {
      minScore:
        settings?.minScore ?? null,

      minConfidence:
        settings?.minConfidence ?? null,

      minHolders:
        settings?.minHolders ?? null,

      maxTop10Pct:
        settings?.maxTop10Pct ?? null,

      maxDeveloperPct:
        settings?.maxDeveloperPct ?? null,

      minBuyPressure:
        settings?.minBuyPressure ?? null,

      requireFreshHolderSnapshot:
        settings?.requireFreshHolderSnapshot ?? null
    },

    durationMs:
      Date.now() - startedAt
  };
}
