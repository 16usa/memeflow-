import crypto from 'node:crypto';

const GAME_VERSION = '5.7.1';
const HISTORY_LIMIT = 60;

const envNumber = (name, fallback, min = -Infinity, max = Infinity) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};
const envBool = (name, fallback = true) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return !['0','false','off','no'].includes(String(raw).trim().toLowerCase());
};

const DEFAULTS = Object.freeze({
  startingBalance: envNumber('GAME_PAPER_STARTING_BALANCE', 10000, 100, 10_000_000),
  maxRoundMs: envNumber('GAME_PAPER_MAX_ROUND_MS', 20 * 60_000, 60_000, 6 * 60 * 60_000),
  startPriceMaxAgeMs: envNumber('GAME_START_PRICE_MAX_AGE_MS', 10_000, 2_000, 60_000),
  decisionMaxAgeMs: envNumber('GAME_DECISION_MAX_AGE_MS', 45_000, 5_000, 5 * 60_000),
  holderMaxAgeMs: envNumber('GAME_HOLDER_MAX_AGE_MS', 90_000, 10_000, 10 * 60_000),
  decisionCoherenceToleranceMs: envNumber('GAME_DECISION_COHERENCE_TOLERANCE_MS', 4_000, 0, 30_000),
  livePriceMaxAgeMs: envNumber('GAME_LIVE_PRICE_MAX_AGE_MS', 15_000, 4_000, 120_000),
  cashoutPriceMaxAgeMs: envNumber('GAME_CASHOUT_PRICE_MAX_AGE_MS', 20_000, 4_000, 120_000),
  marketLossAbortMs: envNumber('GAME_MARKET_LOSS_ABORT_MS', 90_000, 30_000, 10 * 60_000),
  futurePriceToleranceMs: envNumber('GAME_FUTURE_PRICE_TOLERANCE_MS', 5_000, 0, 30_000),
  recentMintPenaltyCount: envNumber('GAME_RECENT_MINT_PENALTY_COUNT', 4, 0, 10),
  sweepIntervalMs: envNumber('GAME_SWEEP_INTERVAL_MS', 2_000, 1_000, 10_000),
  requireHolderFresh: envBool('GAME_REQUIRE_HOLDER_FRESH', true),
});

const finite = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const now = () => Date.now();
const roundMoney = (v) => { const n=Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const tokenPrice = (t) => { const p = finite(t?.priceSol ?? t?.price); return p !== null && p > 0 ? p : null; };
// Only a timestamp tied to an actual accepted price may establish quote freshness.
// Generic token.updatedAt can change because of holders/metadata and must not revive an old price.
const tokenPriceAt = (t) => finite(t?.lastPriceAt ?? t?.priceUpdatedAt ?? t?.lastPriceChangeAt);
const holderAt = (t) => finite(t?.holderScannedAt ?? t?.holderUpdatedAt ?? t?.holderSnapshotAt);
const decisionAt = (d) => finite(d?.updatedAt ?? d?.reevaluatedAt ?? d?.decisionUpdatedAt ?? d?.createdAt);
const ageMs = (ts, at = now()) => { const n = finite(ts); return n === null ? null : Math.max(0, at - n); };
const bool = (v) => v === true;

function recentMarketShape(token) {
  const rows = (Array.isArray(token?.antiRugHistory) ? token.antiRugHistory : [])
    .map(row => ({
      at: finite(row?.at),
      price: finite(row?.priceSol),
      liquidity: finite(row?.liquiditySol),
      pressure: finite(row?.buyPressure),
    }))
    .filter(row => row.price !== null && row.price > 0)
    .slice(-12);
  const currentPrice = tokenPrice(token), currentAt = tokenPriceAt(token);
  if (currentPrice !== null && currentAt !== null) {
    const last = rows.at(-1);
    if (!last || currentAt > (last.at ?? 0) || Math.abs(currentPrice - last.price) > Math.max(1e-18, Math.abs(last.price) * 1e-9)) {
      rows.push({ at: currentAt, price: currentPrice, liquidity: finite(token?.liquiditySol ?? token?.liquidity), pressure: finite(token?.buyPressure ?? token?.momentum) });
      if (rows.length > 12) rows.splice(0, rows.length - 12);
    }
  }

  if (rows.length < 2) {
    return {
      samples: rows.length, quality: 60, volatilityPct: null, drawdownPct: null,
      liquidityDropPct: null, chasePct: null, pressureDelta: null,
    };
  }

  const returns = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].price, b = rows[i].price;
    if (a > 0 && b > 0) returns.push(Math.log(b / a));
  }
  const mean = returns.length ? returns.reduce((sum, x) => sum + x, 0) / returns.length : 0;
  const variance = returns.length ? returns.reduce((sum, x) => sum + (x - mean) ** 2, 0) / returns.length : 0;
  const volatilityPct = Math.sqrt(Math.max(0, variance)) * 100;

  let peak = rows[0].price, maxDrawdownPct = 0;
  for (const row of rows) {
    peak = Math.max(peak, row.price);
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, (peak - row.price) / peak * 100);
  }

  const first = rows[0], last = rows.at(-1);
  const chasePct = first.price > 0 ? (last.price / first.price - 1) * 100 : 0;
  const liquidityRows = rows.filter(row => row.liquidity !== null && row.liquidity > 0);
  const liquidityDropPct = liquidityRows.length >= 2
    ? Math.max(0, (liquidityRows[0].liquidity - liquidityRows.at(-1).liquidity) / liquidityRows[0].liquidity * 100)
    : null;
  const pressureRows = rows.filter(row => row.pressure !== null);
  const pressureDelta = pressureRows.length >= 2 ? pressureRows.at(-1).pressure - pressureRows[0].pressure : null;

  let quality = 82;
  quality -= Math.min(24, volatilityPct * 1.45);
  quality -= Math.min(24, maxDrawdownPct * 0.8);
  if (liquidityDropPct !== null) quality -= Math.min(18, liquidityDropPct * 0.55);
  if (chasePct > 70) quality -= Math.min(12, (chasePct - 70) * 0.12);
  if (pressureDelta !== null) quality += Math.max(-5, Math.min(5, pressureDelta * 2));
  quality = Math.max(20, Math.min(96, quality));

  return {
    samples: rows.length,
    quality: Math.round(quality * 10) / 10,
    volatilityPct: Math.round(volatilityPct * 10) / 10,
    drawdownPct: Math.round(maxDrawdownPct * 10) / 10,
    liquidityDropPct: liquidityDropPct === null ? null : Math.round(liquidityDropPct * 10) / 10,
    chasePct: Math.round(chasePct * 10) / 10,
    pressureDelta: pressureDelta === null ? null : Math.round(pressureDelta * 100) / 100,
  };
}


/* === MF_GAME_TOKEN_IMAGE_V1 START === */

function gameTokenImageUrl(...sources) {
  const IMAGE_KEYS = [
    'imageUrl',
    'imageURL',
    'image_url',
    'imageUri',
    'imageURI',
    'image_uri',
    'image',
    'logoUrl',
    'logoURL',
    'logo_url',
    'logoUri',
    'logoURI',
    'logo_uri',
    'logo',
    'iconUrl',
    'iconURL',
    'icon_url',
    'icon'
  ];

  const normalize = value => {
    if (typeof value !== 'string') return null;

    let url = value.trim();
    if (!url) return null;

    if (url.startsWith('ipfs://')) {
      url = 'https://ipfs.io/ipfs/' + url.slice(7);
    }

    if (
      /^https?:\/\//i.test(url) ||
      /^data:image\//i.test(url)
    ) {
      return url;
    }

    return null;
  };

  const search = (value, depth = 0, seen = new Set()) => {
    if (value == null || depth > 4) return null;

    const direct = normalize(value);
    if (direct) return direct;

    if (typeof value !== 'object') return null;
    if (seen.has(value)) return null;
    seen.add(value);

    /*
      First inspect known image fields.
    */
    for (const key of IMAGE_KEYS) {
      const found = normalize(value?.[key]);
      if (found) return found;
    }

    /*
      Common metadata / pair containers.
    */
    const preferred = [
      value?.metadata,
      value?.meta,
      value?.info,
      value?.token,
      value?.pair?.info,
      value?.pair,
      value?.pairs?.[0]?.info,
      value?.pairs?.[0],
      value?.dex,
      value?.market
    ];

    for (const child of preferred) {
      const found = search(child, depth + 1, seen);
      if (found) return found;
    }

    /*
      Final bounded deep scan. This matches the fact that
      MEMEFLOW already receives image fields in different
      provider-specific shapes.
    */
    if (Array.isArray(value)) {
      for (const child of value.slice(0, 8)) {
        const found = search(child, depth + 1, seen);
        if (found) return found;
      }
    } else {
      for (const [key, child] of Object.entries(value)) {
        if (
          /image|logo|icon|metadata|info/i.test(key)
        ) {
          const found = search(child, depth + 1, seen);
          if (found) return found;
        }
      }
    }

    return null;
  };

  for (const source of sources) {
    const found = search(source);
    if (found) return found;
  }

  return null;
}

/* === MF_GAME_TOKEN_IMAGE_V1 END === */


function safeTokenView(token, decision, selection = null) {
  return {
    mint: token?.mint || decision?.mint || '',
    name: token?.name || decision?.name || null,
    symbol: token?.symbol || decision?.symbol || null,
    imageUrl: gameTokenImageUrl(
      token,
      decision,
      selection,
      selection?.token,
      selection?.decision
    ),
    score: finite(decision?.score),
    confidence: finite(decision?.confidence),
    holderCount: finite(token?.holderCount ?? token?.holders ?? decision?.holderCount),
    top10Pct: finite(token?.top10Pct ?? token?.top10 ?? decision?.top10Pct),
    developerPct: finite(token?.developerPct ?? token?.developerSharePct ?? decision?.developerPct),
    buyPressure: finite(token?.buyPressure ?? token?.momentum ?? decision?.buyPressure),
    liquiditySol: finite(token?.liquiditySol ?? token?.liquidity),
    marketCapSol: finite(token?.marketCapSol ?? token?.marketCap),
    holderFresh: bool(token?.holderFresh),
    holderScannedAt: holderAt(token),
    source: token?.source || decision?.source || 'MEMEFLOW',
    decisionState: decision?.state || null,
    primaryReason: decision?.primaryReason || null,
    launchQuality: finite(selection?.marketShape?.quality),
    volatilityPct: finite(selection?.marketShape?.volatilityPct),
    recentDrawdownPct: finite(selection?.marketShape?.drawdownPct),
    liquidityDropPct: finite(selection?.marketShape?.liquidityDropPct),
    crowdingAtEntry: finite(selection?.crowding),
    launchBand: (() => { const q=finite(selection?.marketShape?.quality); return q===null?null:q>=82?'STRONG':q>=68?'BALANCED':'CAUTION'; })(),
  };
}

export class GameEngine {
  constructor(store, options = {}) {
    if (!store?.state) throw new TypeError('GameEngine requires a JsonStore-compatible store.');
    this.store = store;
    this.startingBalance = Math.max(100, finite(options.startingBalance) ?? DEFAULTS.startingBalance);
    this.maxRoundMs = Math.max(60_000, finite(options.maxRoundMs) ?? DEFAULTS.maxRoundMs);
    this.startPriceMaxAgeMs = Math.max(2_000, finite(options.startPriceMaxAgeMs) ?? DEFAULTS.startPriceMaxAgeMs);
    this.decisionMaxAgeMs = Math.max(5_000, finite(options.decisionMaxAgeMs) ?? DEFAULTS.decisionMaxAgeMs);
    this.holderMaxAgeMs = Math.max(10_000, finite(options.holderMaxAgeMs) ?? DEFAULTS.holderMaxAgeMs);
    this.decisionCoherenceToleranceMs = Math.max(0, finite(options.decisionCoherenceToleranceMs) ?? DEFAULTS.decisionCoherenceToleranceMs);
    this.livePriceMaxAgeMs = Math.max(4_000, finite(options.livePriceMaxAgeMs) ?? DEFAULTS.livePriceMaxAgeMs);
    this.cashoutPriceMaxAgeMs = Math.max(4_000, finite(options.cashoutPriceMaxAgeMs) ?? DEFAULTS.cashoutPriceMaxAgeMs);
    this.marketLossAbortMs = Math.max(30_000, finite(options.marketLossAbortMs) ?? DEFAULTS.marketLossAbortMs);
    this.futurePriceToleranceMs = Math.max(0, finite(options.futurePriceToleranceMs) ?? DEFAULTS.futurePriceToleranceMs);
    this.recentMintPenaltyCount = Math.max(0, Math.min(10, finite(options.recentMintPenaltyCount) ?? DEFAULTS.recentMintPenaltyCount));
    this.sweepIntervalMs = Math.max(1_000, finite(options.sweepIntervalMs) ?? DEFAULTS.sweepIntervalMs);
    this.requireHolderFresh = options.requireHolderFresh ?? DEFAULTS.requireHolderFresh;
    this.epoch = crypto.randomBytes(6).toString('hex');
    this.activeByMint = new Map();
    this.listeners = new Map();
    this.eventSeqByUser = new Map();
    this.lastSelectorByUser = new Map();
    this.ensureRoot();
    this.rebuildActiveIndex();
    this.startSweeper();
  }

  ensureRoot() {
    const state = this.store.state;
    state.gamePaper ||= { version: GAME_VERSION, users: {} };
    state.gamePaper.version = GAME_VERSION;
    state.gamePaper.users ||= {};
    return state.gamePaper;
  }

  ensureUser(uid) {
    const root = this.ensureRoot();
    if (!root.users[uid]) {
      root.users[uid] = { balance: this.startingBalance, session: null, history: [], stateRevision: 1, createdAt: now() };
      this.store.save?.();
    }
    const user = root.users[uid];
    const balance = finite(user.balance);
    user.balance = balance === null ? this.startingBalance : Math.max(0, roundMoney(balance));
    if (!Array.isArray(user.history)) user.history = [];
    user.history = user.history.slice(0, HISTORY_LIMIT);
    if (user.session && typeof user.session !== 'object') user.session = null;
    const revision = finite(user.stateRevision);
    user.stateRevision = revision === null ? 1 : Math.max(1, Math.floor(revision));
    if (user.session && finite(user.session.revision) === null) user.session.revision = 1;
    return user;
  }

  rebuildActiveIndex() {
    this.activeByMint.clear();
    for (const [uid, user] of Object.entries(this.ensureRoot().users || {})) {
      const s = user?.session;
      if (s?.state === 'LIVE' && s?.mint) this.indexActive(uid, s.mint);
    }
  }

  bumpUser(user) {
    user.stateRevision = Math.max(1, Math.floor(finite(user.stateRevision) ?? 1)) + 1;
    return user.stateRevision;
  }

  bumpSession(session) {
    session.revision = Math.max(0, Math.floor(finite(session.revision) ?? 0)) + 1;
    return session.revision;
  }

  nextEventSeq(uid) {
    const next = (this.eventSeqByUser.get(uid) || 0) + 1;
    this.eventSeqByUser.set(uid, next);
    return next;
  }

  startSweeper() {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      try { this.sweep(); } catch {}
    }, this.sweepIntervalMs);
    this.sweeper.unref?.();
  }

  destroy() {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
    this.listeners.clear();
  }

  sweep() {
    let checked = 0;
    for (const [uid, user] of Object.entries(this.ensureRoot().users || {})) {
      if (user?.session?.state !== 'LIVE') continue;
      this.syncSession(uid);
      checked++;
    }
    return checked;
  }

  indexActive(uid, mint) {
    if (!mint) return;
    if (!this.activeByMint.has(mint)) this.activeByMint.set(mint, new Set());
    this.activeByMint.get(mint).add(uid);
  }

  unindexActive(uid, mint) {
    const users = this.activeByMint.get(mint);
    if (!users) return;
    users.delete(uid);
    if (!users.size) this.activeByMint.delete(mint);
  }

  activeRoundCount() {
    let count = 0;
    for (const users of this.activeByMint.values()) count += users.size;
    return count;
  }

  subscribe(uid, callback) {
    if (typeof callback !== 'function') return () => {};
    if (!this.listeners.has(uid)) this.listeners.set(uid, new Set());
    this.listeners.get(uid).add(callback);
    return () => {
      const set = this.listeners.get(uid);
      set?.delete(callback);
      if (!set?.size) this.listeners.delete(uid);
    };
  }

  emit(uid, type = 'state', payload = null) {
    const set = this.listeners.get(uid);
    if (!set?.size) return;
    const data = payload || (type === 'tick' ? this.tick(uid) : this.status(uid, { sync: false }));
    const eventSeq = this.nextEventSeq(uid);
    for (const callback of [...set]) {
      try { callback({ type, eventSeq, ...data }); } catch {}
    }
  }

  selectorDiagnostics(uid) {
    return this.lastSelectorByUser.get(uid) || null;
  }

  pickCandidate(uid) {
    // SITE-ENGINE AUTHORITY POLICY (V5.7.1)
    // -------------------------------------
    // MEMEFLOW's per-user decision engine already evaluates the token with
    // store.settings(uid) and only emits BUY READY after the configured user
    // gates pass. Game must NOT create a second set of trading filters.
    //
    // Game therefore requires only:
    //   1) the current per-user decision is BUY READY and not terminal;
    //   2) the referenced token exists;
    //   3) the token has a valid positive price so a 1.00x entry can be formed.
    //
    // Price/holder/decision ages, timestamp coherence, antiRugHistory shape and
    // same-mint crowding remain diagnostics/telemetry only. They never veto or
    // down-rank a site-approved BUY READY candidate here.
    const decisions = this.store.decisions?.(uid) || [];
    const diag = {
      policy: 'MEMEFLOW_SETTINGS_ONLY',
      seen: decisions.length,
      buyReady: 0,
      terminal: 0,
      noMint: 0,
      noToken: 0,
      noPrice: 0,
      eligible: 0,
      selectedMint: null,
      selectedScore: null,
      selectedQuality: null,
      selectedCrowding: 0,
      // Legacy diagnostic keys are retained at zero so older V5.x UI builds
      // can consume the payload without interpreting them as blockers.
      stalePrice: 0,
      futurePrice: 0,
      staleDecision: 0,
      futureDecision: 0,
      staleHolders: 0,
      staleHolderAge: 0,
      futureHolder: 0,
      decisionBehindPrice: 0,
      decisionBehindHolder: 0,
    };
    const rows = [];

    for (const decision of decisions) {
      if (String(decision?.state || '').toUpperCase() !== 'BUY READY') continue;
      diag.buyReady++;
      if (decision?.terminal === true || String(decision?.lifecycle || '').toLowerCase() === 'closed') {
        diag.terminal++;
        continue;
      }

      const mint = String(decision?.mint || '').trim();
      if (!mint) { diag.noMint++; continue; }
      const token = this.store.state.tokens?.[mint];
      if (!token) { diag.noToken++; continue; }
      const price = tokenPrice(token);
      if (price === null) { diag.noPrice++; continue; }

      const score=finite(decision?.score);
      if(score===null)continue;
      const dAt = decisionAt(decision);
      const pAt = tokenPriceAt(token);
      const hAt = holderAt(token);
      const marketShape = recentMarketShape(token); // display/telemetry only
      const crowding = this.activeByMint.get(mint)?.size || 0; // telemetry only

      rows.push({
        decision,
        token,
        mint,
        price,
        score,
        selectorScore: score,
        marketShape,
        crowding,
        priceAt: pAt,
        holderAt: hAt,
        decisionAt: dAt,
        priceAgeMs: ageMs(pAt),
        holderAgeMs: ageMs(hAt),
        decisionAgeMs: ageMs(dAt),
      });
      diag.eligible++;
    }

    // Selection preference is based only on the score produced by MEMEFLOW's
    // own decision plus recency as a tie-breaker. No Game-specific risk score
    // or hidden filter participates in trade eligibility.
    rows.sort((a, b) =>
      (b.score - a.score) ||
      ((b.decisionAt ?? 0) - (a.decisionAt ?? 0)) ||
      ((b.priceAt ?? 0) - (a.priceAt ?? 0))
    );

    diag.selectedMint = rows[0]?.mint || null;
    diag.selectedScore = rows[0]?.score ?? null;
    diag.selectedQuality = rows[0]?.marketShape?.quality ?? null;
    diag.selectedCrowding = rows[0]?.crowding || 0;
    this.lastSelectorByUser.set(uid, diag);
    return rows[0] || null;
  }

  validateStart(user, input = {}) {
    const bet = roundMoney(finite(input.bet) ?? finite(input.betAmount) ?? 0);
    const autoCashout = finite(input.autoCashout) ?? 0;
    const stopLoss = finite(input.stopLoss) ?? 0;
    if (!(bet >= 1)) return { ok: false, code: 'INVALID_BET', message: 'Paper stake must be at least $1.' };
    if (bet > user.balance) return { ok: false, code: 'INSUFFICIENT_PAPER_BALANCE', message: 'Paper stake exceeds the virtual balance.' };
    if (autoCashout !== 0 && (autoCashout < 1.01 || autoCashout > 100)) return { ok: false, code: 'INVALID_AUTO_CASHOUT', message: 'Auto cash out must be off or between 1.01× and 100×.' };
    if (stopLoss !== 0 && (stopLoss <= 0 || stopLoss >= 1)) return { ok: false, code: 'INVALID_STOP_LOSS', message: 'Stop loss must be off or below 1.00×.' };
    return { ok: true, bet, autoCashout, stopLoss };
  }

  start(uid, input = {}) {
    const user = this.ensureUser(uid);
    const account = this.store.state.users?.[uid] || {};
    if (account.killSwitch === true) return { ok: false, code: 'KILL_SWITCH', message: 'MEMEFLOW kill switch is active. Paper Game launch is blocked.' };
    const requestId = String(input.requestId || '').trim().slice(0, 100) || crypto.randomUUID();
    const existing = user.session;

    if (existing?.state === 'LIVE') {
      if (existing.requestId === requestId) return { ok: true, resumed: true, ...this.status(uid) };
      return { ok: false, code: 'ACTIVE_ROUND_EXISTS', message: 'Finish the active paper round before starting another.', status: this.status(uid) };
    }
    if (existing?.state === 'COMPLETE') return { ok: false, code: 'ROUND_RESULT_PENDING', message: 'Acknowledge the completed round before starting another.', status: this.status(uid) };

    const checked = this.validateStart(user, input);
    if (!checked.ok) return checked;
    const candidate = this.pickCandidate(uid);
    if (!candidate) return { ok: false, code: 'NO_CANDIDATE', message: 'No current MEMEFLOW BUY READY candidate with a valid price is available yet.', selector: this.selectorDiagnostics(uid) };

    const startedAt = now();
    const session = {
      id: crypto.randomBytes(5).toString('hex').toUpperCase(),
      requestId,
      state: 'LIVE',
      mint: candidate.mint,
      token: safeTokenView(candidate.token, candidate.decision, candidate),
      bet: checked.bet,
      autoCashout: checked.autoCashout,
      stopLoss: checked.stopLoss,
      entryPrice: candidate.price,
      currentPrice: candidate.price,
      multiplier: 1,
      peak: 1,
      trough: 1,
      peakAt: startedAt,
      troughAt: startedAt,
      maxDrawdownPct: 0,
      maxAdverseExcursionPct: 0,
      priceUpdateCount: 1,
      entryTelemetry: {
        buyPressure: finite(candidate.token?.buyPressure ?? candidate.token?.momentum),
        liquiditySol: finite(candidate.token?.liquiditySol ?? candidate.token?.liquidity),
        holderCount: finite(candidate.token?.holderCount ?? candidate.token?.holders),
        top10Pct: finite(candidate.token?.top10Pct ?? candidate.token?.top10),
      },
      startedAt,
      updatedAt: startedAt,
      lastPriceAt: candidate.priceAt,
      priceAtEntryAt: candidate.priceAt,
      decisionAtEntryAt: candidate.decisionAt,
      holderAtEntryAt: candidate.holderAt,
      holderAgeAtEntryMs: candidate.holderAgeMs,
      selectionScore: candidate.selectorScore,
      marketShapeAtEntry: candidate.marketShape,
      crowdingAtEntry: candidate.crowding,
      timeoutPending: false,
      reason: null,
      payout: null,
      profit: null,
      completedAt: null,
      settledPriceAt: null,
      voided: false,
      revision: 1,
    };

    user.balance = roundMoney(Math.max(0, user.balance - checked.bet));
    user.session = session;
    this.bumpUser(user);
    this.indexActive(uid, session.mint);
    this.store.save?.();
    const result = { ok: true, resumed: false, ...this.status(uid, { sync: false }) };
    this.emit(uid, 'state', result);
    return result;
  }

  updateSessionFromToken(session, token) {
    if (!session || session.state !== 'LIVE') return false;
    const price = tokenPrice(token);
    const pAt = tokenPriceAt(token);
    if (price === null || pAt === null || session.entryPrice <= 0) return false;
    const previousAt = finite(session.lastPriceAt) ?? 0;
    const previousPrice = finite(session.currentPrice);
    const at = now();
    if (pAt > at + this.futurePriceToleranceMs) return false; // reject implausible future-dated quotes
    if (pAt < previousAt) return false; // reject out-of-order market snapshots
    if (pAt === previousAt && previousPrice !== null && Math.abs(price - previousPrice) <= Math.max(1e-18, Math.abs(previousPrice) * 1e-9)) return false; // exact duplicate snapshot
    const rawMultiplier = price / session.entryPrice;
    if (!Number.isFinite(rawMultiplier) || rawMultiplier < 0) return false;
    const multiplier = rawMultiplier;
    session.currentPrice = price;
    session.multiplier = multiplier;
    const previousPeak = finite(session.peak) ?? 1;
    const previousTrough = finite(session.trough) ?? 1;
    if (multiplier > previousPeak) { session.peak = multiplier; session.peakAt = pAt; }
    else session.peak = previousPeak;
    if (multiplier < previousTrough) { session.trough = multiplier; session.troughAt = pAt; }
    else session.trough = previousTrough;
    const drawdown = session.peak > 0 ? Math.max(0, (session.peak - multiplier) / session.peak * 100) : 0;
    session.maxDrawdownPct = Math.max(finite(session.maxDrawdownPct) ?? 0, drawdown);
    session.maxAdverseExcursionPct = Math.max(finite(session.maxAdverseExcursionPct) ?? 0, Math.max(0, (1 - multiplier) * 100));
    session.priceUpdateCount = Math.max(1, Math.floor(finite(session.priceUpdateCount) ?? 1)) + 1;
    session.updatedAt = at;
    session.lastPriceAt = pAt;
    this.bumpSession(session);
    return true;
  }

  syncSession(uid, explicitToken = null) {
    const user = this.ensureUser(uid);
    const session = user.session;
    if (!session || session.state !== 'LIVE') return session;
    const token = explicitToken?.mint === session.mint ? explicitToken : this.store.state.tokens?.[session.mint];
    const changed = this.updateSessionFromToken(session, token);
    if (changed) this.bumpUser(user);

    // Freshness is based only on a price snapshot the session actually accepted.
    // Unrelated token metadata updates must never make a stale quote look fresh.
    const pAge = ageMs(session.lastPriceAt);
    const fresh = pAge !== null && pAge <= this.livePriceMaxAgeMs;
    const elapsed = now() - Number(session.startedAt || now());

    // A completely dead market feed must never trap the user's reserved paper stake.
    // After a bounded outage, void the round and return the stake with zero P&L.
    if (pAge === null || pAge > this.marketLossAbortMs) return this.voidRound(uid, 'MARKET_DATA_LOST_REFUND');

    if (fresh && session.autoCashout > 0 && session.multiplier >= session.autoCashout) return this.settle(uid, 'AUTO_CASH_OUT');
    if (fresh && session.stopLoss > 0 && session.multiplier <= session.stopLoss) return this.settle(uid, 'STOP_LOSS');

    if (elapsed >= this.maxRoundMs) {
      if (fresh) return this.settle(uid, 'ROUND_TIMEOUT');
      if (!session.timeoutPending) {
        session.timeoutPending = true;
        this.bumpSession(session);
        this.bumpUser(user);
      }
    }
    if (session.timeoutPending && fresh) return this.settle(uid, 'ROUND_TIMEOUT');
    return session;
  }

  voidRound(uid, reason = 'MARKET_DATA_LOST_REFUND') {
    const user = this.ensureUser(uid);
    const session = user.session;
    if (!session || session.state !== 'LIVE') return session || null;
    session.state = 'COMPLETE';
    session.reason = reason;
    session.voided = true;
    session.payout = roundMoney(session.bet);
    session.profit = 0;
    session.completedAt = now();
    session.updatedAt = session.completedAt;
    session.settledPriceAt = finite(session.lastPriceAt);
    this.bumpSession(session);
    this.bumpUser(user);
    user.balance = roundMoney(user.balance + session.bet);
    user.history.unshift(this.historyRow(session));
    user.history = user.history.slice(0, HISTORY_LIMIT);
    this.unindexActive(uid, session.mint);
    this.store.save?.();
    this.emit(uid, 'state', { ...this.status(uid, { sync: false }) });
    return session;
  }

  settle(uid, reason = 'MANUAL_CASH_OUT') {
    const user = this.ensureUser(uid);
    const session = user.session;
    if (!session || session.state !== 'LIVE') return session || null;
    const token = this.store.state.tokens?.[session.mint];
    this.updateSessionFromToken(session, token);

    const multiplier = Math.max(0, finite(session.multiplier) ?? 0);
    const payout = roundMoney(session.bet * multiplier);
    const profit = roundMoney(payout - session.bet);
    session.state = 'COMPLETE';
    session.reason = reason;
    session.voided = false;
    session.payout = payout;
    session.profit = profit;
    session.completedAt = now();
    session.updatedAt = session.completedAt;
    session.settledPriceAt = finite(session.lastPriceAt);
    this.bumpSession(session);
    this.bumpUser(user);
    user.balance = roundMoney(user.balance + payout);
    user.history.unshift(this.historyRow(session));
    user.history = user.history.slice(0, HISTORY_LIMIT);
    this.unindexActive(uid, session.mint);
    this.store.save?.();
    this.emit(uid, 'state', { ...this.status(uid, { sync: false }) });
    return session;
  }

  cashout(uid) {
    const user = this.ensureUser(uid);
    if (user.session?.state === 'COMPLETE') return { ok: true, idempotent: true, ...this.status(uid, { sync: false }) };
    if (!user.session || user.session.state !== 'LIVE') return { ok: false, code: 'NO_ACTIVE_ROUND', message: 'There is no live paper round to cash out.', status: this.status(uid) };
    this.syncSession(uid);
    if (user.session.state !== 'LIVE') return { ok: true, ...this.status(uid, { sync: false }) };
    const pAge = ageMs(user.session.lastPriceAt);
    if (pAge === null || pAge > this.cashoutPriceMaxAgeMs) {
      return { ok: false, code: 'PRICE_STALE', message: 'The latest MEMEFLOW price is stale. Cash out unlocks automatically when a fresh quote arrives.', status: this.status(uid, { sync: false }) };
    }
    this.settle(uid, 'MANUAL_CASH_OUT');
    return { ok: true, ...this.status(uid, { sync: false }) };
  }

  reset(uid) {
    const user = this.ensureUser(uid);
    if (user.session?.state === 'LIVE') return { ok: false, code: 'ACTIVE_ROUND_EXISTS', message: 'Cash out the active round before resetting.', status: this.status(uid) };
    user.session = null;
    this.bumpUser(user);
    this.store.save?.();
    const result = { ok: true, ...this.status(uid, { sync: false }) };
    this.emit(uid, 'state', result);
    return result;
  }

  clearHistory(uid) {
    const user = this.ensureUser(uid);
    user.history = [];
    this.bumpUser(user);
    this.store.save?.();
    const result = { ok: true, ...this.status(uid, { sync: false }) };
    this.emit(uid, 'state', result);
    return result;
  }

  publicSession(session) {
    // lastPriceAt advances only after updateSessionFromToken accepts a valid,
    // monotonic market price. It is therefore the authoritative quote timestamp.
    const latestPriceAt = finite(session.lastPriceAt);
    const priceAgeMs = latestPriceAt !== null ? Math.max(0, now() - latestPriceAt) : null;
    const decisionAgeMs = session.decisionAtEntryAt ? Math.max(0, session.startedAt - session.decisionAtEntryAt) : null;
    const holderAgeAtEntryMs = finite(session.holderAgeAtEntryMs) ?? (session.holderAtEntryAt ? Math.max(0, session.startedAt - session.holderAtEntryAt) : null);
    const feedFresh = priceAgeMs !== null && priceAgeMs <= this.livePriceMaxAgeMs;
    const canCashout = session.state === 'LIVE' && priceAgeMs !== null && priceAgeMs <= this.cashoutPriceMaxAgeMs;
    const drawdownPct = session.peak > 0 ? Math.max(0, (session.peak - session.multiplier) / session.peak * 100) : 0;
    const liveToken = this.store.state.tokens?.[session.mint] || null;
    const liveTokenView = liveToken ? {
      ...session.token,
      holderCount: finite(liveToken?.holderCount ?? liveToken?.holders) ?? session.token?.holderCount ?? null,
      top10Pct: finite(liveToken?.top10Pct ?? liveToken?.top10) ?? session.token?.top10Pct ?? null,
      developerPct: finite(liveToken?.developerPct ?? liveToken?.developerSharePct) ?? session.token?.developerPct ?? null,
      buyPressure: finite(liveToken?.buyPressure ?? liveToken?.momentum) ?? session.token?.buyPressure ?? null,
      liquiditySol: finite(liveToken?.liquiditySol ?? liveToken?.liquidity) ?? session.token?.liquiditySol ?? null,
      holderFresh: liveToken?.holderFresh === true,
      holderScannedAt: holderAt(liveToken),
    } : session.token;
    return {
      id: session.id, state: session.state, mint: session.mint, token: liveTokenView,
      bet: session.bet, autoCashout: session.autoCashout, stopLoss: session.stopLoss,
      entryPrice: session.entryPrice, currentPrice: session.currentPrice, multiplier: session.multiplier,
      peak: session.peak, trough: session.trough, drawdownPct, maxDrawdownPct: session.maxDrawdownPct,
      peakAt: session.peakAt ?? null, troughAt: session.troughAt ?? null,
      timeToPeakMs: session.peakAt && session.startedAt ? Math.max(0, session.peakAt - session.startedAt) : null,
      maxAdverseExcursionPct: finite(session.maxAdverseExcursionPct) ?? Math.max(0, (1 - (finite(session.trough) ?? 1)) * 100),
      priceUpdateCount: Math.max(1, Math.floor(finite(session.priceUpdateCount) ?? 1)),
      entryTelemetry: session.entryTelemetry ?? null,
      startedAt: session.startedAt, updatedAt: session.updatedAt, completedAt: session.completedAt,
      reason: session.reason, payout: session.payout, profit: session.profit, voided: session.voided === true,
      revision: Math.max(1, Math.floor(finite(session.revision) ?? 1)),
      latestPriceAt, priceAgeMs, decisionAgeMs, holderAgeAtEntryMs, feedFresh, canCashout,
      timeoutPending: session.timeoutPending === true,
      selectionScore: session.selectionScore ?? null,
      marketShapeAtEntry: session.marketShapeAtEntry ?? null,
      crowdingAtEntry: session.crowdingAtEntry ?? 0,
      settledPriceAt: session.settledPriceAt ?? null,
    };
  }

  tick(uid) {
    const user = this.ensureUser(uid);
    const session = user.session ? this.publicSession(user.session) : null;
    return { version: GAME_VERSION, engineEpoch: this.epoch, paperOnly: true, stateRevision: user.stateRevision, balance: roundMoney(user.balance), session, serverTime: now() };
  }

  status(uid, options = {}) {
    const sync = options.sync !== false;
    const user = this.ensureUser(uid);
    if (sync) this.syncSession(uid);
    const session = user.session ? this.publicSession(user.session) : null;
    return {
      version: GAME_VERSION,
      engineEpoch: this.epoch,
      paperOnly: true,
      stateRevision: user.stateRevision,
      balance: roundMoney(user.balance),
      session,
      /*
        MF_V67:
        Old rounds created before imageUrl was stored can
        recover their token avatar from the current token store.
      */
      history: user.history
        .slice(0, HISTORY_LIMIT)
        .map(row => {
          const liveToken =
            this.store.state.tokens?.[row?.mint] || null;

          return {
            ...row,

            imageUrl:
              row?.imageUrl ||
              gameTokenImageUrl(liveToken) ||
              null,
          };
        }),

      stats: this.stats(uid),
      selector: this.selectorDiagnostics(uid),
      activeRounds: this.activeRoundCount(),
      limits: {
        maxRoundMs: this.maxRoundMs,
        startPriceMaxAgeMs: this.startPriceMaxAgeMs,
        decisionMaxAgeMs: this.decisionMaxAgeMs,
        holderMaxAgeMs: this.holderMaxAgeMs,
        decisionCoherenceToleranceMs: this.decisionCoherenceToleranceMs,
        livePriceMaxAgeMs: this.livePriceMaxAgeMs,
        cashoutPriceMaxAgeMs: this.cashoutPriceMaxAgeMs,
        marketLossAbortMs: this.marketLossAbortMs,
        futurePriceToleranceMs: this.futurePriceToleranceMs,
        requireHolderFresh: this.requireHolderFresh,
      },
      serverTime: now(),
    };
  }

  stats(uid) {
    const user = this.ensureUser(uid);
    const rows = user.history || [];
    const settled = rows.filter(r => !r?.voided);
    const wins = settled.filter(r => (finite(r?.profit) ?? 0) > 0).length;
    const losses = settled.filter(r => (finite(r?.profit) ?? 0) < 0).length;
    const pushes = settled.length - wins - losses;
    const netProfit = roundMoney(rows.reduce((sum, r) => sum + (finite(r?.profit) ?? 0), 0));
    const bestMultiplier = rows.reduce((best, r) => Math.max(best, finite(r?.multiplier) ?? 0), 0);
    const avgRoiPct = settled.length ? settled.reduce((sum, r) => sum + (finite(r?.roiPct) ?? 0), 0) / settled.length : 0;
    return {
      rounds: rows.length,
      settledRounds: settled.length,
      voidedRounds: rows.length - settled.length,
      wins, losses, pushes,
      winRatePct: wins + losses > 0 ? wins / (wins + losses) * 100 : 0,
      netProfit,
      bestMultiplier,
      avgRoiPct,
    };
  }

  health() {
    return { ok: true, version: GAME_VERSION, engineEpoch: this.epoch, paperOnly: true, selectorPolicy: 'MEMEFLOW_SETTINGS_ONLY', activeRounds: this.activeRoundCount(), listeners: [...this.listeners.values()].reduce((n, s) => n + s.size, 0), sweeper: Boolean(this.sweeper), marketLossAbortMs: this.marketLossAbortMs, holderMaxAgeMs: this.holderMaxAgeMs, decisionCoherenceToleranceMs: this.decisionCoherenceToleranceMs };
  }

  onTokenUpdate(mint, token) {
    const users = this.activeByMint.get(mint);
    if (!users?.size) return 0;
    let updated = 0;
    for (const uid of [...users]) {
      const before = this.ensureUser(uid).session?.state;
      this.syncSession(uid, token);
      const after = this.ensureUser(uid).session?.state;
      updated++;
      if (after === 'LIVE') this.emit(uid, 'tick');
      // A LIVE -> COMPLETE transition is emitted by settle() itself, so do not duplicate it here.
    }
    return updated;
  }

  historyRow(session) {
    const durationMs = session.completedAt && session.startedAt ? Math.max(0, session.completedAt - session.startedAt) : null;
    const roiPct = session.bet > 0 ? (session.profit / session.bet) * 100 : 0;
    return {
      id: session.id,
      symbol: session.token?.symbol || session.token?.name || 'TOKEN',
      mint: session.mint,

      // MF_V67_HISTORY_TOKEN_IMAGE
      imageUrl:
        session.token?.imageUrl ||
        gameTokenImageUrl(session.token) ||
        null,

      reason: session.reason,
      voided: session.voided === true,
      stake: session.bet,
      payout: session.payout,
      profit: session.profit,
      roiPct: session.voided ? 0 : roiPct,
      multiplier: session.voided ? 1 : session.multiplier,
      observedMultiplier: session.multiplier,
      entryPrice: session.entryPrice,
      exitPrice: session.currentPrice,
      peak: session.peak,
      maxDrawdownPct: session.maxDrawdownPct ?? null,
      maxAdverseExcursionPct: finite(session.maxAdverseExcursionPct) ?? Math.max(0, (1 - (finite(session.trough) ?? 1)) * 100),
      timeToPeakMs: session.peakAt && session.startedAt ? Math.max(0, session.peakAt - session.startedAt) : null,
      priceUpdateCount: Math.max(1, Math.floor(finite(session.priceUpdateCount) ?? 1)),
      launchQuality: finite(session.token?.launchQuality ?? session.marketShapeAtEntry?.quality),
      durationMs,
      at: session.completedAt,
    };
  }
}
