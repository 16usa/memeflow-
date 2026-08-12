import crypto from 'node:crypto';

const DEFAULT_STARTING_BALANCE = Math.max(100, Number(process.env.GAME_PAPER_STARTING_BALANCE || 10000));
const DEFAULT_MAX_ROUND_MS = Math.max(60_000, Number(process.env.GAME_PAPER_MAX_ROUND_MS || 20 * 60_000));
const MAX_HISTORY = 20;

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function now() {
  return Date.now();
}

function tokenPrice(token) {
  const price = finite(token?.priceSol ?? token?.price);
  return price !== null && price > 0 ? price : null;
}

function tokenView(token, decision) {
  return {
    mint: token?.mint || decision?.mint || '',
    name: token?.name || decision?.name || null,
    symbol: token?.symbol || decision?.symbol || null,
    score: finite(decision?.score ?? decision?.aiScore),
    confidence: finite(decision?.confidence),
    holderCount: finite(token?.holderCount ?? token?.holders ?? decision?.holderCount),
    top10Pct: finite(token?.top10Pct ?? token?.top10 ?? decision?.top10Pct),
    developerPct: finite(token?.developerPct ?? token?.developerSharePct ?? decision?.developerPct),
    buyPressure: finite(token?.buyPressure ?? token?.momentum ?? decision?.buyPressure),
    liquiditySol: finite(token?.liquiditySol ?? token?.liquidity),
    marketCapSol: finite(token?.marketCapSol ?? token?.marketCap),
    source: token?.source || decision?.source || 'MEMEFLOW',
    decisionState: decision?.state || null,
    primaryReason: decision?.primaryReason || null
  };
}

export class GameEngine {
  constructor(store, options = {}) {
    this.store = store;
    this.startingBalance = Math.max(100, finite(options.startingBalance) ?? DEFAULT_STARTING_BALANCE);
    this.maxRoundMs = Math.max(60_000, finite(options.maxRoundMs) ?? DEFAULT_MAX_ROUND_MS);
    this.activeByMint = new Map();
    this.ensureRoot();
    this.rebuildActiveIndex();
  }

  ensureRoot() {
    this.store.state.gamePaper ||= { users: {} };
    this.store.state.gamePaper.users ||= {};
    return this.store.state.gamePaper;
  }

  ensureUser(uid) {
    const root = this.ensureRoot();
    if (!root.users[uid]) {
      root.users[uid] = {
        balance: this.startingBalance,
        session: null,
        history: [],
        createdAt: now()
      };
      this.store.save?.();
    }
    const user = root.users[uid];
    if (!Number.isFinite(Number(user.balance)) || Number(user.balance) < 0) user.balance = this.startingBalance;
    if (!Array.isArray(user.history)) user.history = [];
    return user;
  }

  rebuildActiveIndex() {
    this.activeByMint.clear();
    for (const [uid, user] of Object.entries(this.ensureRoot().users || {})) {
      const session = user?.session;
      if (session?.state === 'LIVE' && session?.mint) this.indexActive(uid, session.mint);
    }
  }

  indexActive(uid, mint) {
    if (!mint) return;
    if (!this.activeByMint.has(mint)) this.activeByMint.set(mint, new Set());
    this.activeByMint.get(mint).add(uid);
  }

  unindexActive(uid, mint) {
    const set = this.activeByMint.get(mint);
    if (!set) return;
    set.delete(uid);
    if (!set.size) this.activeByMint.delete(mint);
  }

  pickCandidate(uid) {
    const decisions = this.store.decisions?.(uid) || [];
    const candidates = [];
    for (const decision of decisions) {
      if (String(decision?.state || '').toUpperCase() !== 'BUY READY') continue;
      if (decision?.terminal === true || String(decision?.lifecycle || '').toLowerCase() === 'closed') continue;
      const mint = String(decision?.mint || '').trim();
      if (!mint) continue;
      const token = this.store.state.tokens?.[mint];
      const price = tokenPrice(token);
      if (!token || price === null) continue;
      candidates.push({
        decision,
        token,
        mint,
        price,
        score: finite(decision?.score ?? decision?.aiScore ?? decision?.priority) ?? 0,
        updatedAt: finite(decision?.updatedAt ?? token?.updatedAt) ?? 0
      });
    }
    candidates.sort((a, b) => (b.score - a.score) || (b.updatedAt - a.updatedAt));
    return candidates[0] || null;
  }

  validateStart(user, input = {}) {
    const bet = Math.round((finite(input.bet) ?? finite(input.betAmount) ?? 0) * 100) / 100;
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
    const requestId = String(input.requestId || '').trim().slice(0, 80) || crypto.randomUUID();
    const existing = user.session;
    if (existing?.state === 'LIVE') {
      if (existing.requestId === requestId) return { ok: true, resumed: true, ...this.status(uid) };
      return { ok: false, code: 'ACTIVE_ROUND_EXISTS', message: 'Finish the active paper round before starting another.', status: this.status(uid) };
    }
    if (existing?.state === 'COMPLETE') {
      return { ok: false, code: 'ROUND_RESULT_PENDING', message: 'Acknowledge the completed round before starting another.', status: this.status(uid) };
    }

    const checked = this.validateStart(user, input);
    if (!checked.ok) return checked;
    const candidate = this.pickCandidate(uid);
    if (!candidate) return { ok: false, code: 'NO_CANDIDATE', message: 'No BUY READY candidate with a live price is available yet.' };

    const startedAt = now();
    const session = {
      id: crypto.randomBytes(4).toString('hex').toUpperCase(),
      requestId,
      state: 'LIVE',
      mint: candidate.mint,
      token: tokenView(candidate.token, candidate.decision),
      bet: checked.bet,
      autoCashout: checked.autoCashout,
      stopLoss: checked.stopLoss,
      entryPrice: candidate.price,
      currentPrice: candidate.price,
      multiplier: 1,
      peak: 1,
      startedAt,
      updatedAt: startedAt,
      priceAtEntryAt: finite(candidate.token?.lastPriceAt ?? candidate.token?.updatedAt),
      reason: null,
      payout: null,
      profit: null,
      completedAt: null
    };
    user.balance = Math.max(0, user.balance - checked.bet);
    user.session = session;
    this.indexActive(uid, session.mint);
    this.store.save?.();
    return { ok: true, resumed: false, ...this.status(uid) };
  }

  syncSession(uid, explicitToken = null) {
    const user = this.ensureUser(uid);
    const session = user.session;
    if (!session || session.state !== 'LIVE') return session;
    const token = explicitToken?.mint === session.mint ? explicitToken : this.store.state.tokens?.[session.mint];
    const price = tokenPrice(token);
    if (price !== null && session.entryPrice > 0) {
      session.currentPrice = price;
      session.multiplier = Math.max(0, price / session.entryPrice);
      session.peak = Math.max(finite(session.peak) ?? 1, session.multiplier);
      session.updatedAt = now();
    }
    if (session.autoCashout > 0 && session.multiplier >= session.autoCashout) return this.settle(uid, 'AUTO_CASH_OUT', session.autoCashout);
    if (session.stopLoss > 0 && session.multiplier <= session.stopLoss) return this.settle(uid, 'STOP_LOSS');
    if (now() - session.startedAt >= this.maxRoundMs) return this.settle(uid, 'ROUND_TIMEOUT');
    return session;
  }

  settle(uid, reason = 'MANUAL_CASH_OUT', forcedMultiplier = null) {
    const user = this.ensureUser(uid);
    const session = user.session;
    if (!session) return null;
    if (session.state === 'COMPLETE') return session;
    if (session.state !== 'LIVE') return session;

    const token = this.store.state.tokens?.[session.mint];
    const latestPrice = tokenPrice(token);
    if (latestPrice !== null && session.entryPrice > 0) {
      session.currentPrice = latestPrice;
      session.multiplier = Math.max(0, latestPrice / session.entryPrice);
      session.peak = Math.max(finite(session.peak) ?? 1, session.multiplier);
    }

    // Auto cash out represents the configured trigger. If an update jumps beyond it,
    // use the target as the paper fill rather than granting a better synthetic fill.
    if (reason === 'AUTO_CASH_OUT' && forcedMultiplier && session.multiplier >= forcedMultiplier) {
      session.multiplier = forcedMultiplier;
      session.currentPrice = session.entryPrice * forcedMultiplier;
    }

    const multiplier = Math.max(0, finite(session.multiplier) ?? 0);
    const payout = Math.round(session.bet * multiplier * 100) / 100;
    const profit = Math.round((payout - session.bet) * 100) / 100;
    session.state = 'COMPLETE';
    session.reason = reason;
    session.payout = payout;
    session.profit = profit;
    session.completedAt = now();
    session.updatedAt = session.completedAt;
    user.balance = Math.round((user.balance + payout) * 100) / 100;
    user.history.unshift(this.historyRow(session));
    user.history = user.history.slice(0, MAX_HISTORY);
    this.unindexActive(uid, session.mint);
    this.store.save?.();
    return session;
  }

  cashout(uid) {
    const user = this.ensureUser(uid);
    if (!user.session || user.session.state !== 'LIVE') {
      return { ok: false, code: 'NO_ACTIVE_ROUND', message: 'There is no live paper round to cash out.', status: this.status(uid) };
    }
    this.syncSession(uid);
    if (user.session.state === 'LIVE') this.settle(uid, 'MANUAL_CASH_OUT');
    return { ok: true, ...this.status(uid) };
  }

  reset(uid) {
    const user = this.ensureUser(uid);
    if (user.session?.state === 'LIVE') return { ok: false, code: 'ACTIVE_ROUND_EXISTS', message: 'Cash out the active round before resetting.', status: this.status(uid) };
    user.session = null;
    this.store.save?.();
    return { ok: true, ...this.status(uid) };
  }

  clearHistory(uid) {
    const user = this.ensureUser(uid);
    user.history = [];
    this.store.save?.();
    return { ok: true, ...this.status(uid) };
  }

  status(uid) {
    const user = this.ensureUser(uid);
    this.syncSession(uid);
    return {
      paperOnly: true,
      balance: Math.round(user.balance * 100) / 100,
      session: user.session ? this.publicSession(user.session) : null,
      history: user.history.slice(0, MAX_HISTORY),
      maxRoundMs: this.maxRoundMs,
      serverTime: now()
    };
  }

  onTokenUpdate(mint, token) {
    const users = this.activeByMint.get(mint);
    if (!users?.size) return 0;
    let updated = 0;
    for (const uid of [...users]) {
      const before = this.ensureUser(uid).session?.state;
      this.syncSession(uid, token);
      const after = this.ensureUser(uid).session?.state;
      if (before !== after || before === 'LIVE') updated += 1;
    }
    return updated;
  }

  publicSession(session) {
    const token = this.store.state.tokens?.[session.mint];
    const latestPriceAt = finite(token?.lastPriceAt ?? token?.updatedAt);
    return {
      id: session.id,
      state: session.state,
      mint: session.mint,
      token: session.token,
      bet: session.bet,
      autoCashout: session.autoCashout,
      stopLoss: session.stopLoss,
      entryPrice: session.entryPrice,
      currentPrice: session.currentPrice,
      multiplier: session.multiplier,
      peak: session.peak,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      reason: session.reason,
      payout: session.payout,
      profit: session.profit,
      latestPriceAt,
      priceAgeMs: latestPriceAt ? Math.max(0, now() - latestPriceAt) : null
    };
  }

  historyRow(session) {
    return {
      id: session.id,
      symbol: session.token?.symbol || session.token?.name || 'TOKEN',
      mint: session.mint,
      reason: session.reason,
      stake: session.bet,
      payout: session.payout,
      profit: session.profit,
      multiplier: session.multiplier,
      peak: session.peak,
      at: session.completedAt
    };
  }
}
