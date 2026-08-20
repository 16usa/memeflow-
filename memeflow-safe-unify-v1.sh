#!/usr/bin/env bash
set -euo pipefail

PATCH_ID="MEMEFLOW_SAFE_UNIFY_V1_2026_08_20"
EXPECTED_EVAL_BLOB="12b4089bcd09f3fc9e9cdcf13d0b1126d544c9c1"

if [[ -f "memeflow-app/src/evaluate.mjs" ]]; then
  cd memeflow-app
elif [[ -f "src/evaluate.mjs" && -f "app-server.mjs" ]]; then
  :
else
  echo "[PATCH] Run this from the repository root or memeflow-app directory."
  exit 2
fi

for f in src/evaluate.mjs src/settings.mjs src/openai-intelligence.mjs app-server.mjs src/filter-upgrade.test.mjs package.json; do
  [[ -f "$f" ]] || { echo "[PATCH] Missing required file: $f"; exit 2; }
done

echo "[PATCH] Preflight..."
CURRENT_EVAL_BLOB="$(git hash-object src/evaluate.mjs 2>/dev/null || true)"
if [[ "$CURRENT_EVAL_BLOB" != "$EXPECTED_EVAL_BLOB" ]] && ! grep -q "MEMEFLOW_INDEPENDENT_AI_V2_CANONICAL" src/evaluate.mjs; then
  if [[ "${MEMEFLOW_PATCH_FORCE:-0}" != "1" ]]; then
    echo "[PATCH] STOP: src/evaluate.mjs differs from the audited GitHub baseline."
    echo "[PATCH] Current blob: $CURRENT_EVAL_BLOB"
    echo "[PATCH] Expected:     $EXPECTED_EVAL_BLOB"
    echo "[PATCH] Nothing was changed."
    echo "[PATCH] If you intentionally want to overwrite a newer local evaluator, run:"
    echo "        MEMEFLOW_PATCH_FORCE=1 bash $0"
    exit 3
  fi
fi

node --input-type=commonjs <<'NODE'
const fs=require('fs');

const app=fs.readFileSync('app-server.mjs','utf8');
const ai=fs.readFileSync('src/openai-intelligence.mjs','utf8');

if(!app.includes('MEMEFLOW_FEED_LIFECYCLE_V1')){
  const helperAnchor='/* MEMEFLOW_CANONICAL_CANDIDATE_PAYLOAD_V1 */\nfunction candidateView(d){';
  const routeAnchor="  const _all=store.decisions(u.id);\n  const _selected=candidateFeed(_all,_scope);\n  const _counts=candidateVisibilityCounts(_all);";
  if(!app.includes(helperAnchor)) throw new Error('app-server helper anchor not found');
  if(!app.includes(routeAnchor)) throw new Error('app-server decisions route anchor not found');
}
if(!ai.includes('MEMEFLOW_ARCHIVE_STRATEGY_V1')){
  if(!ai.includes("enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:true"))
    throw new Error('OpenAI defaults anchor not found');
  if(!ai.includes('async applyProposal(uid,proposal)'))
    throw new Error('OpenAI applyProposal anchor not found');
  if(!ai.includes('const recent=ai.outcomes.slice(0,250);if(recent.length<5'))
    throw new Error('OpenAI strategy anchor not found');
}
NODE

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".memeflow-patch-backup-$STAMP"
mkdir -p "$BACKUP_DIR/src"
cp src/evaluate.mjs "$BACKUP_DIR/src/evaluate.mjs"
cp src/openai-intelligence.mjs "$BACKUP_DIR/src/openai-intelligence.mjs"
cp app-server.mjs "$BACKUP_DIR/app-server.mjs"

restore() {
  echo "[PATCH] Restoring backup..."
  cp "$BACKUP_DIR/src/evaluate.mjs" src/evaluate.mjs
  cp "$BACKUP_DIR/src/openai-intelligence.mjs" src/openai-intelligence.mjs
  cp "$BACKUP_DIR/app-server.mjs" app-server.mjs
}

trap 'echo "[PATCH] Failed."; restore' ERR

cat > src/evaluate.mjs <<'EOF_EVALUATE'
const clampScore = value =>
  Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const finite = value =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  Number.isFinite(Number(value));

const numberOrNull = (...values) => {
  for (const value of values) {
    if (finite(value)) return Number(value);
  }
  return null;
};

const hasNumericSetting = value => finite(value);

const text = value => String(value ?? '').trim();

const firstText = (...values) => {
  for (const value of values) {
    const v = text(value);
    if (v) return v;
  }
  return '';
};

const listFromSetting = value => {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  return text(value).split(/[\n,]+/).map(x => x.trim()).filter(Boolean);
};

function independentAiScore(token = {}) {
  let score = 0;
  const quality = [];

  const holders = numberOrNull(token.holderCount, token.holders);
  if (holders !== null) {
    let pts = 0;
    if (holders >= 100) pts = 20;
    else if (holders >= 60) pts = 17;
    else if (holders >= 30) pts = 13;
    else if (holders >= 15) pts = 7;
    else if (holders > 0) pts = 3;

    score += pts;
    quality.push({ key: 'holders', value: holders, points: pts, maxPoints: 20 });
  }

  const top10 = numberOrNull(token.top10Pct, token.top10);
  if (top10 !== null) {
    let pts = 0;
    if (top10 <= 15) pts = 20;
    else if (top10 <= 25) pts = 17;
    else if (top10 <= 35) pts = 12;
    else if (top10 <= 50) pts = 6;

    score += pts;
    quality.push({ key: 'top10', value: top10, points: pts, maxPoints: 20 });
  }

  const developer = numberOrNull(
    token.developerPct,
    token.developerSharePct,
    token.creatorPct
  );
  if (developer !== null) {
    let pts = 0;
    if (developer <= 5) pts = 20;
    else if (developer <= 10) pts = 18;
    else if (developer <= 20) pts = 14;
    else if (developer <= 30) pts = 7;

    score += pts;
    quality.push({ key: 'developer', value: developer, points: pts, maxPoints: 20 });
  }

  const pressure = numberOrNull(token.buyPressure, token.momentum);
  if (pressure !== null) {
    let pts = 0;
    if (pressure >= 3) pts = 20;
    else if (pressure >= 2) pts = 17;
    else if (pressure >= 1.5) pts = 13;
    else if (pressure >= 1.2) pts = 9;
    else if (pressure >= 1) pts = 4;

    score += pts;
    quality.push({ key: 'buyPressure', value: pressure, points: pts, maxPoints: 20 });
  }

  const price = numberOrNull(token.priceSol);
  const hasPrice = price !== null && price > 0;
  if (hasPrice) score += 10;

  quality.push({
    key: 'verifiedPrice',
    value: hasPrice,
    points: hasPrice ? 10 : 0,
    maxPoints: 10
  });

  const freshHolders = token.holderFresh === true;
  if (freshHolders) score += 10;

  quality.push({
    key: 'freshHolders',
    value: freshHolders,
    points: freshHolders ? 10 : 0,
    maxPoints: 10
  });

  return { score: clampScore(score), quality };
}

export function tokenAgeMinutes(token = {}, now = Date.now()) {
  const createdAt = numberOrNull(
    token.discoveredAt,
    token.createdAt,
    token.firstSeenAt,
    token.created_at,
    token.timestamp
  );

  if (createdAt === null || createdAt <= 0) return null;

  const createdMs = createdAt < 1e12 ? createdAt * 1000 : createdAt;
  return Math.max(0, (Number(now) - createdMs) / 60000);
}

function platformText(token = {}) {
  return [
    token.launchPlatform,
    token.protocol,
    token.source
  ].map(x => text(x).toLowerCase().replaceAll('_', ' ')).filter(Boolean).join(' ');
}

function keywordHaystack(token = {}) {
  return [
    token.name,
    token.symbol,
    token.uri,
    token.metadataUri,
    token.description,
    token.metadata?.name,
    token.metadata?.symbol,
    token.metadata?.description
  ].map(x => text(x).toLowerCase()).filter(Boolean).join(' ');
}

function socialEvidence(token = {}) {
  const socials = token.socials && typeof token.socials === 'object'
    ? token.socials
    : {};

  const twitter = firstText(
    token.twitter,
    token.twitterUrl,
    token.x,
    token.xUrl,
    socials.twitter,
    socials.x
  );
  const website = firstText(
    token.website,
    token.websiteUrl,
    token.externalUrl,
    socials.website
  );
  const telegram = firstText(
    token.telegram,
    token.telegramUrl,
    token.tg,
    socials.telegram
  );

  return {
    twitter,
    website,
    telegram,
    any: Boolean(twitter || website || telegram)
  };
}

export function evaluate(token = {}, s = {}) {
  const reasons = [];
  const gates = [];

  let waiting = false;
  let blocked = false;

  const addGate = (name, result, reason, extra = {}) => {
    const status =
      result === null || result === undefined
        ? 'WAITING'
        : result
          ? 'PASS'
          : 'FAIL';

    gates.push({
      name,
      status,
      pass: status === 'PASS',
      ...extra
    });

    if (status === 'WAITING') {
      waiting = true;
      reasons.push('Waiting: ' + reason);
    } else if (status === 'FAIL') {
      blocked = true;
      reasons.push(reason);
    }
  };

  const addRange = ({
    name,
    value,
    min,
    max,
    pendingReason,
    belowReason,
    aboveReason,
    unit = ''
  }) => {
    const minEnabled = hasNumericSetting(min);
    const maxEnabled = hasNumericSetting(max);
    if (!minEnabled && !maxEnabled) return;

    if (value === null) {
      addGate(name, null, pendingReason, {
        value: null,
        min: minEnabled ? Number(min) : null,
        max: maxEnabled ? Number(max) : null
      });
      return;
    }

    if (minEnabled) {
      const threshold = Number(min);
      addGate(
        `${name} minimum`,
        value >= threshold,
        belowReason ?? `${name.toLowerCase()} ${value}${unit} below minimum ${threshold}${unit}`,
        { value, threshold, operator: '>=' }
      );
    }

    if (maxEnabled) {
      const threshold = Number(max);
      addGate(
        `${name} maximum`,
        value <= threshold,
        aboveReason ?? `${name.toLowerCase()} ${value}${unit} above maximum ${threshold}${unit}`,
        { value, threshold, operator: '<=' }
      );
    }
  };

  // Independent score is intentionally local and synchronous.
  // User settings never modify the score formula; they only gate the decision.
  const ai = independentAiScore(token);
  const score = ai.score;

  const confidence = clampScore(
    (finite(token.dataQuality) ? Number(token.dataQuality) : 0) * 100
  );

  const holders = numberOrNull(token.holderCount, token.holders);
  addRange({
    name: 'Holders',
    value: holders,
    min: s.minHolders,
    max: s.maxHolders,
    pendingReason: 'holder count data pending',
    belowReason: hasNumericSetting(s.minHolders)
      ? `holders below minimum ${Number(s.minHolders)}`
      : undefined,
    aboveReason: hasNumericSetting(s.maxHolders)
      ? `holders above maximum ${Number(s.maxHolders)}`
      : undefined
  });

  const top10 = numberOrNull(token.top10Pct, token.top10);
  addRange({
    name: 'Top-10 concentration',
    value: top10,
    min: s.minTop10Pct,
    max: s.maxTop10Pct,
    pendingReason: 'Top 10 concentration data pending',
    belowReason: hasNumericSetting(s.minTop10Pct)
      ? `Top 10 below ${Number(s.minTop10Pct)}%`
      : undefined,
    aboveReason: hasNumericSetting(s.maxTop10Pct)
      ? `Top 10 above ${Number(s.maxTop10Pct)}%`
      : undefined,
    unit: '%'
  });

  const developer = numberOrNull(
    token.developerPct,
    token.developerSharePct,
    token.creatorPct
  );
  addRange({
    name: 'Developer concentration',
    value: developer,
    min: s.minDeveloperPct,
    max: s.maxDeveloperPct,
    pendingReason: 'developer concentration data pending',
    belowReason: hasNumericSetting(s.minDeveloperPct)
      ? `developer below ${Number(s.minDeveloperPct)}%`
      : undefined,
    aboveReason: hasNumericSetting(s.maxDeveloperPct)
      ? `developer above ${Number(s.maxDeveloperPct)}%`
      : undefined,
    unit: '%'
  });

  if (hasNumericSetting(s.minBuyPressure) && Number(s.minBuyPressure) > 0) {
    const pressure = numberOrNull(token.buyPressure, token.momentum);
    addGate(
      'Buy pressure',
      pressure === null ? null : pressure >= Number(s.minBuyPressure),
      pressure === null
        ? 'buy pressure data pending'
        : `buy pressure below ${Number(s.minBuyPressure)}×`,
      {
        value: pressure,
        threshold: Number(s.minBuyPressure),
        operator: '>='
      }
    );
  }

  if (hasNumericSetting(s.minLiquidityUsd) && Number(s.minLiquidityUsd) > 0) {
    const liquidityUsd = numberOrNull(token.liquidityUsd, token.liquidityUSD);
    addGate(
      'Minimum liquidity',
      liquidityUsd === null ? null : liquidityUsd >= Number(s.minLiquidityUsd),
      liquidityUsd === null
        ? 'liquidity USD data pending'
        : `liquidity below $${Number(s.minLiquidityUsd)}`,
      {
        value: liquidityUsd,
        threshold: Number(s.minLiquidityUsd),
        operator: '>='
      }
    );
  }

  addRange({
    name: 'Market cap',
    value: numberOrNull(token.marketCapUsd, token.marketCapUSD),
    min: s.minMarketCapUsd,
    max: s.maxMarketCapUsd,
    pendingReason: 'market cap USD data pending',
    unit: ' USD'
  });

  addRange({
    name: 'Bonding curve',
    value: numberOrNull(
      token.bondingCurvePct,
      token.bondingCurveProgressPct,
      token.curveProgressPct,
      token.bondingCurveProgress
    ),
    min: s.minBondingCurvePct,
    max: s.maxBondingCurvePct,
    pendingReason: 'bonding curve data pending',
    unit: '%'
  });

  addRange({
    name: '24h volume',
    value: numberOrNull(
      token.volume24hUsd,
      token.volume24hUSD,
      token.volumeUsd24h
    ),
    min: s.minVolume24hUsd,
    max: s.maxVolume24hUsd,
    pendingReason: '24h volume data pending',
    unit: ' USD'
  });

  const buys = numberOrNull(
    token.buyTransactions,
    token.buyTxns,
    token.buys24h,
    token.transactions24h?.buys
  );
  const sells = numberOrNull(
    token.sellTransactions,
    token.sellTxns,
    token.sells24h,
    token.transactions24h?.sells
  );
  const totalTransactions = numberOrNull(
    token.totalTransactions,
    token.totalTxns,
    token.transactions24h?.total,
    buys !== null && sells !== null ? buys + sells : null
  );

  addRange({
    name: 'Buy transactions',
    value: buys,
    min: s.minBuyTransactions,
    max: s.maxBuyTransactions,
    pendingReason: 'buy transaction data pending'
  });

  addRange({
    name: 'Sell transactions',
    value: sells,
    min: s.minSellTransactions,
    max: s.maxSellTransactions,
    pendingReason: 'sell transaction data pending'
  });

  addRange({
    name: 'Total transactions',
    value: totalTransactions,
    min: s.minTotalTransactions,
    max: s.maxTotalTransactions,
    pendingReason: 'total transaction data pending'
  });

  addRange({
    name: 'Total fees',
    value: numberOrNull(token.totalFeesSol, token.feesSol),
    min: s.minTotalFeesSol,
    max: s.maxTotalFeesSol,
    pendingReason: 'total fee data pending',
    unit: ' SOL'
  });

  addRange({
    name: 'Bundle share',
    value: numberOrNull(
      token.bundlePct,
      token.bundledPct,
      token.bundlePercentage
    ),
    min: s.minBundlePct,
    max: s.maxBundlePct,
    pendingReason: 'bundle data pending',
    unit: '%'
  });

  addRange({
    name: 'Sniper share',
    value: numberOrNull(
      token.sniperPct,
      token.snipersPct,
      token.sniperPercentage
    ),
    min: s.minSniperPct,
    max: s.maxSniperPct,
    pendingReason: 'sniper data pending',
    unit: '%'
  });

  const ageMinutes = tokenAgeMinutes(token);
  const minAgeEnabled =
    hasNumericSetting(s.minTokenAgeMinutes) &&
    Number(s.minTokenAgeMinutes) > 0;
  const maxAgeEnabled =
    hasNumericSetting(s.maxTokenAgeMinutes) &&
    Number(s.maxTokenAgeMinutes) >= 0;

  if (minAgeEnabled || maxAgeEnabled) {
    if (ageMinutes === null) {
      addGate('Token age', null, 'token age data pending', {
        value: null,
        min: minAgeEnabled ? Number(s.minTokenAgeMinutes) : null,
        max: maxAgeEnabled ? Number(s.maxTokenAgeMinutes) : null
      });
    } else {
      if (minAgeEnabled) {
        addGate(
          'Token age minimum',
          ageMinutes >= Number(s.minTokenAgeMinutes),
          `token age below minimum ${Number(s.minTokenAgeMinutes)} minutes`,
          {
            value: ageMinutes,
            threshold: Number(s.minTokenAgeMinutes),
            operator: '>='
          }
        );
      }
      if (maxAgeEnabled) {
        addGate(
          'Token age maximum',
          ageMinutes <= Number(s.maxTokenAgeMinutes),
          `token age above maximum ${Number(s.maxTokenAgeMinutes)} minutes`,
          {
            value: ageMinutes,
            threshold: Number(s.maxTokenAgeMinutes),
            operator: '<='
          }
        );
      }
    }
  }

  const platforms = Array.isArray(s.launchPlatforms)
    ? s.launchPlatforms.map(x => text(x).toLowerCase()).filter(Boolean)
    : [];

  if (platforms.length) {
    const observedPlatform = platformText(token);
    addGate(
      'Launch platform',
      observedPlatform
        ? platforms.some(platform => {
            const normalized = platform.replaceAll('_', ' ');
            return observedPlatform.includes(normalized) ||
              (normalized === 'pump' && observedPlatform.includes('pump'));
          })
        : null,
      observedPlatform
        ? `launch platform does not match ${platforms.join(', ')}`
        : 'launch platform data pending',
      { value: observedPlatform || null, allowed: platforms }
    );
  }

  const socials = socialEvidence(token);
  if (s.requireTwitter === true) {
    addGate('Twitter/X', Boolean(socials.twitter), 'Twitter/X required');
  }
  if (s.requireWebsite === true) {
    addGate('Website', Boolean(socials.website), 'Website required');
  }
  if (s.requireTelegram === true) {
    addGate('Telegram', Boolean(socials.telegram), 'Telegram required');
  }
  if (s.requireAnySocial === true) {
    addGate('Any social link', socials.any, 'at least one social link is required');
  }
  if (s.requireWebsiteOrX === true) {
    addGate(
      'Website or X',
      Boolean(socials.website || socials.twitter),
      'website or Twitter/X is required'
    );
  }

  const haystack = keywordHaystack(token);
  const includeKeywords = listFromSetting(s.includeKeywords).map(x => x.toLowerCase());
  const excludeKeywords = listFromSetting(s.excludeKeywords).map(x => x.toLowerCase());

  if (includeKeywords.length) {
    addGate(
      'Include keywords',
      haystack
        ? includeKeywords.some(keyword => haystack.includes(keyword))
        : null,
      haystack
        ? `none of the required keywords matched: ${includeKeywords.join(', ')}`
        : 'token metadata pending for include-keyword filter'
    );
  }

  if (excludeKeywords.length && haystack) {
    const hit = excludeKeywords.find(keyword => haystack.includes(keyword));
    addGate(
      'Exclude keywords',
      !hit,
      hit ? `excluded keyword matched: ${hit}` : 'excluded keyword matched'
    );
  }

  const developerWallet = firstText(
    token.creator,
    token.developerWallet,
    token.devWallet
  );
  const blacklist = Array.isArray(s.developerBlacklistWallets)
    ? s.developerBlacklistWallets.map(text).filter(Boolean)
    : listFromSetting(s.developerBlacklistWallets);
  if (blacklist.length) {
    const blacklistSet = new Set(blacklist);
    addGate(
      'Developer blacklist',
      developerWallet ? !blacklistSet.has(developerWallet) : null,
      developerWallet
        ? `Developer wallet ${developerWallet} is blacklisted`
        : 'developer wallet data pending'
    );
  }

  const price = numberOrNull(token.priceSol);
  addGate(
    'Verified price',
    price === null ? null : price > 0,
    'price unavailable',
    { value: price }
  );

  if (s.requireFreshHolderSnapshot === true) {
    addGate(
      'Fresh holder snapshot',
      token.holderFresh == null ? null : token.holderFresh === true,
      'holder snapshot unavailable'
    );
  }

  const minimumAiScore = finite(s.minScore) ? Number(s.minScore) : null;
  const minimumConfidence =
    finite(s.minConfidence) ? Number(s.minConfidence) : null;

  const aiScorePass =
    minimumAiScore === null ? true : score >= minimumAiScore;
  const confidencePass =
    minimumConfidence === null ? true : confidence >= minimumConfidence;

  gates.push({
    name: 'Minimum AI score',
    status: aiScorePass ? 'PASS' : 'FAIL',
    pass: aiScorePass,
    value: score,
    threshold: minimumAiScore
  });

  gates.push({
    name: 'Minimum confidence',
    status: confidencePass ? 'PASS' : 'FAIL',
    pass: confidencePass,
    value: confidence,
    threshold: minimumConfidence
  });

  if (minimumAiScore !== null && !aiScorePass) {
    reasons.push(
      `AI score ${score} below configured minimum ${minimumAiScore}`
    );
  }

  if (minimumConfidence !== null && !confidencePass) {
    reasons.push(
      `confidence ${confidence}% below configured minimum ${minimumConfidence}%`
    );
  }

  // Preserve current MEMEFLOW semantics: incomplete enabled evidence remains
  // WAITING even when another known gate already fails. This prevents early
  // false terminal decisions while enrichment is still arriving.
  let state;
  if (waiting) {
    state = 'WAITING';
  } else if (blocked) {
    state = 'BLOCKED';
  } else if (aiScorePass && confidencePass) {
    state = 'BUY READY';
  } else {
    state = 'WATCH';
  }

  return {
    state,
    score,
    confidence,
    reasons,

    primaryReason:
      reasons[0] ||
      'Independent AI quality and all configured user gates passed',

    aiQuality: {
      model: 'MEMEFLOW_INDEPENDENT_AI_V2_CANONICAL',
      score,
      components: ai.quality
    },

    settingsEvaluation: {
      minScore: minimumAiScore,
      minConfidence: minimumConfidence,
      gates
    }
  };
}
EOF_EVALUATE

node --input-type=commonjs <<'NODE'
const fs=require('fs');

// 1) UI/API feed lifecycle cleanup. This runs only when /api/ai/decisions is read.
// It is deliberately outside discovery/enrichment/evaluation hot paths.
{
  const file='app-server.mjs';
  let s=fs.readFileSync(file,'utf8');

  if(!s.includes('MEMEFLOW_FEED_LIFECYCLE_V1')){
    const anchor='/* MEMEFLOW_CANONICAL_CANDIDATE_PAYLOAD_V1 */\nfunction candidateView(d){';
    const helper=`/* MEMEFLOW_FEED_LIFECYCLE_V1
   Read-time lifecycle only. No RPC, disk I/O, timers, OpenAI or awaits.
   Stale rows stay available through scope=audit/archive, but disappear from
   normal/all UI feeds so dead tokens do not accumulate on screen. */
function decisionFeedLifecycle(decision={},token={},now=Date.now()){
  const n=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
  const discovered=n(token.discoveredAt??token.createdAt??token.firstSeenAt);
  const ageMs=discovered!==null?Math.max(0,now-discovered):0;
  const activity=n(token.lastMarketActivityAt??token.lastPriceChangeAt??discovered);
  const idleMs=activity!==null?Math.max(0,now-activity):ageMs;
  const current=n(token.priceSol);
  const peak=n(token.peakPriceSol);
  const holders=n(token.holderCount??token.holders);
  const state=String(decision.state||'').trim().toUpperCase();
  const terminal=['BLOCKED','REJECTED','EXPIRED','IGNORED','CLOSED'].includes(state);
  const collapsed=current!==null&&current>0&&peak!==null&&peak>0&&current<=peak*0.10;

  if(collapsed&&ageMs>=5*60_000&&idleMs>=5*60_000)return 'ARCHIVED_COLLAPSED';
  if(terminal&&holders!==null&&holders<=1&&ageMs>=10*60_000&&idleMs>=10*60_000)return 'ARCHIVED_DEAD';
  if(terminal&&ageMs>=15*60_000&&idleMs>=15*60_000)return 'ARCHIVED_STALE';
  if(state==='WAITING'&&ageMs>=30*60_000&&idleMs>=30*60_000)return 'ARCHIVED_STALE';
  return 'ACTIVE';
}

function candidateView(d){`;

    if(!s.includes(anchor)) throw new Error('candidateView anchor disappeared');
    s=s.replace(anchor,helper);

    const routeAnchor="  const _all=store.decisions(u.id);\n  const _selected=candidateFeed(_all,_scope);\n  const _counts=candidateVisibilityCounts(_all);";
    const routeReplacement=`  const _all=store.decisions(u.id);
  const _now=Date.now();
  const _lifecycleRows=_all.map(d=>{
    const lifecycle=decisionFeedLifecycle(d,store.state.tokens?.[d.mint]||{},_now);
    return lifecycle==='ACTIVE'?d:{...d,feedLifecycle:lifecycle};
  });
  const _visibleAll=_lifecycleRows.filter(d=>!d.feedLifecycle);
  const _base=_scope==='archive'?_lifecycleRows:candidateFeed(_lifecycleRows,_scope);
  const _selected=_scope==='audit'
    ? _base
    : _scope==='archive'
      ? _base.filter(d=>Boolean(d.feedLifecycle))
      : _base.filter(d=>!d.feedLifecycle);
  const _counts={
    ...candidateVisibilityCounts(_visibleAll),
    archived:_lifecycleRows.length-_visibleAll.length,
    totalStored:_lifecycleRows.length
  };`;

    if(!s.includes(routeAnchor)) throw new Error('decisions route anchor disappeared');
    s=s.replace(routeAnchor,routeReplacement);

    const candidateStateAnchor="    state:d.state,\n    score:d.score,";
    if(!s.includes(candidateStateAnchor)) throw new Error('candidate state anchor not found');
    s=s.replace(candidateStateAnchor,"    state:d.state,\n    lifecycle:d.feedLifecycle||'ACTIVE',\n    score:d.score,");

    fs.writeFileSync(file,s);
  }
}

// 2) OpenAI remains completely outside realtime evaluation and becomes
// proposal-only. Strategy Coach may inspect compact archived outcomes only
// when strategy() is explicitly requested.
{
  const file='src/openai-intelligence.mjs';
  let s=fs.readFileSync(file,'utf8');

  if(!s.includes('MEMEFLOW_ARCHIVE_STRATEGY_V1')){
    s=s.replace(
      "enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:true",
      "enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:false"
    );

    const safeAnchor="function safeText(v,max=4000){return String(v??'').slice(0,max)}";
    const archiveHelper=`function safeText(v,max=4000){return String(v??'').slice(0,max)}

/* MEMEFLOW_ARCHIVE_STRATEGY_V1
   On-demand only: called from Strategy Coach, never from token discovery or
   deterministic evaluation. Uses already persisted anti-rug snapshots. */
function archivedLearningSample(store,limit=120){
  const round=v=>Number.isFinite(Number(v))?Math.round(Number(v)*10)/10:null;
  const nowMs=Date.now();
  const rows=Object.values(store?.state?.tokens||{});

  return rows.map(token=>{
    const history=Array.isArray(token?.antiRugHistory)?token.antiRugHistory.filter(Boolean):[];
    if(history.length<1)return null;

    const first=history[0],last=history[history.length-1];
    const discovered=Number(token?.discoveredAt||token?.createdAt||0);
    const ageMinutes=discovered>0?Math.max(0,(nowMs-discovered)/60000):null;
    if(ageMinutes===null||ageMinutes<15)return null;

    const activity=Number(token?.lastMarketActivityAt||token?.lastPriceChangeAt||discovered||0);
    const idleMinutes=activity>0?Math.max(0,(nowMs-activity)/60000):ageMinutes;

    const firstPrice=Number(first?.priceSol);
    const currentPrice=Number(token?.priceSol||last?.priceSol);
    const peakPrice=Number(token?.peakPriceSol)||Math.max(
      0,
      ...history.map(x=>Number(x?.priceSol)||0)
    );

    const peakGainPct=firstPrice>0&&peakPrice>0
      ? (peakPrice/firstPrice-1)*100
      : null;
    const drawdownPct=peakPrice>0&&currentPrice>0
      ? (1-currentPrice/peakPrice)*100
      : null;

    let outcome=null;
    if(drawdownPct!==null&&drawdownPct>=90&&idleMinutes>=5)outcome='COLLAPSED';
    else if(peakGainPct!==null&&peakGainPct>=100)outcome='RUNNER';
    else if(idleMinutes>=60)outcome='STALE';
    else if(ageMinutes>=60)outcome='SURVIVED';
    if(!outcome)return null;

    return {
      outcome,
      ageMinutes:round(ageMinutes),
      idleMinutes:round(idleMinutes),
      peakGainPct:round(peakGainPct),
      drawdownPct:round(drawdownPct),
      entry:{
        holderCount:round(first?.holderCount),
        top10Pct:round(first?.top10Pct),
        developerPct:round(first?.developerPct),
        buyPressure:round(first?.buyPressure),
        priceSol:Number.isFinite(firstPrice)?firstPrice:null
      },
      latest:{
        holderCount:round(token?.holderCount??last?.holderCount),
        top10Pct:round(token?.top10Pct??last?.top10Pct),
        developerPct:round(token?.developerPct??last?.developerPct),
        buyPressure:round(token?.buyPressure??last?.buyPressure),
        priceSol:Number.isFinite(currentPrice)?currentPrice:null
      }
    };
  })
  .filter(Boolean)
  .sort((a,b)=>(b.ageMinutes||0)-(a.ageMinutes||0))
  .slice(0,Math.max(1,Math.min(250,Number(limit)||120)));
}`;

    if(!s.includes(safeAnchor)) throw new Error('safeText anchor disappeared');
    s=s.replace(safeAnchor,archiveHelper);

    const userStateAnchor="u.ai.settings={...aiDefaults(),...(u.ai.settings||{})};";
    if(!s.includes(userStateAnchor)) throw new Error('userState settings anchor not found');
    s=s.replace(
      userStateAnchor,
      userStateAnchor+"\n    u.ai.settings.autoOptimize=false; // owner policy is proposal-only"
    );

    const strategyAnchor="const recent=ai.outcomes.slice(0,250);if(recent.length<5)return {enabled:true,insufficientData:true,minimum:5,current:recent.length,proposals:[]};";
    const strategyReplacement="const recent=ai.outcomes.slice(0,250);const archivedTokenOutcomes=archivedLearningSample(this.store,120);if(recent.length<5&&archivedTokenOutcomes.length<20)return {enabled:true,insufficientData:true,minimumTradeOutcomes:5,minimumArchivedOutcomes:20,currentTradeOutcomes:recent.length,currentArchivedOutcomes:archivedTokenOutcomes.length,proposals:[]};";
    if(!s.includes(strategyAnchor)) throw new Error('strategy minimum anchor disappeared');
    s=s.replace(strategyAnchor,strategyReplacement);

    const summaryAnchor="currentSettings:this.store.settings(uid),aiSettings:cfg,recent:recent.slice(0,80)};";
    if(!s.includes(summaryAnchor)) throw new Error('strategy summary anchor not found');
    s=s.replace(
      summaryAnchor,
      "currentSettings:this.store.settings(uid),aiSettings:cfg,recent:recent.slice(0,80),archivedTokenOutcomes};"
    );

    const coachAnchor="instructions:'You are MEMEFLOW Strategy Coach. Analyze only this user\\'s outcomes/settings. Never claim guaranteed profit. Suggest conservative testable changes. Never suggest locked settings.'";
    if(!s.includes(coachAnchor)) throw new Error('strategy coach instruction anchor not found');
    s=s.replace(
      coachAnchor,
      "instructions:'You are MEMEFLOW Strategy Coach. Analyze only this user\\'s outcomes/settings and archivedTokenOutcomes. Archived outcomes are observational evidence, not guaranteed causality. Suggest conservative testable changes only. Never claim guaranteed profit. Never suggest locked settings. Never apply a setting automatically; return proposals only.'"
    );

    const applyAnchor="async applyProposal(uid,proposal){\n    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.autoOptimize)return {applied:false,reason:'AUTO_OPTIMIZE_DISABLED'};";
    const applyReplacement="async applyProposal(uid,proposal){\n    const ownerPolicy=this.store.settings(uid)?.aiChangePolicy||'propose';\n    if(ownerPolicy==='propose')return {applied:false,reason:'PROPOSE_ONLY_POLICY'};\n    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.autoOptimize)return {applied:false,reason:'AUTO_OPTIMIZE_DISABLED'};";
    if(!s.includes(applyAnchor)) throw new Error('applyProposal body anchor not found');
    s=s.replace(applyAnchor,applyReplacement);

    fs.writeFileSync(file,s);
  }
}
NODE

echo "[PATCH] Syntax checks..."
node --check src/evaluate.mjs
node --check src/openai-intelligence.mjs
node --check app-server.mjs

echo "[PATCH] Canonical evaluator tests..."
node --test src/filter-upgrade.test.mjs

echo "[PATCH] Existing integration tests..."
npm test

trap - ERR

echo
echo "[PATCH] SUCCESS: $PATCH_ID"
echo "[PATCH] Backup: $BACKUP_DIR"
echo "[PATCH] No RPC/OpenAI/disk await was added to discovery -> diagnostics -> decision."
echo "[PATCH] Dead/stale rows are hidden at API read time only; scope=audit/archive keeps them inspectable."
echo "[PATCH] Strategy Coach can inspect archived anti-rug outcomes on demand, but cannot auto-change settings."
echo
git diff -- src/evaluate.mjs src/openai-intelligence.mjs app-server.mjs || true
