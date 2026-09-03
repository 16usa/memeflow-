import crypto from 'node:crypto';
import {calculateAdaptivePositionSize} from './adaptive-position-sizing.mjs';
import {evaluateSettingsGate} from './settings-gate.mjs';
import {evaluatePositionDecision} from './position-decision.mjs';

// MEMEFLOW_PAPER_CANONICAL_ADAPTIVE_SIZING_V21
// MEMEFLOW_PAPER_EXECUTION_GATE_RECHECK_V21_3

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const lower = (value, fallback = '') => String(value ?? fallback).trim().toLowerCase();

const nowIso = () => new Date().toISOString();

export class PaperEngine {
  constructor(store, options = {}) {
    if (!store?.state || typeof store.save !== 'function') {
      throw new TypeError('PaperEngine requires a JsonStore-compatible instance');
    }
    this.store = store;
    this.clock = options.clock || (() => Date.now());

    // MEMEFLOW_PLATFORM_LEARNING_V2
    // Optional platform-wide anonymized analytics sink.
    // It NEVER participates in entry/exit decisions.
    this.analytics = options.analytics || null;

    this.ensureState();

    // MEMEFLOW_PAPER_POSITION_CHECKPOINT_V55
    // Price/PnL/high/trailing remain live in memory on every TradeEvent.
    // Ordinary mark-to-market persistence is bounded so an active position
    // cannot drive full state.json durability on every hot market tick.
    this.positionCheckpointMs = Math.max(
      250,
      num(
        options.positionCheckpointMs ??
        process.env.PAPER_POSITION_CHECKPOINT_MS,
        1000
      )
    );
    this._lastPositionCheckpointAtV55 = this.clock();

    // MEMEFLOW_PAPER_PROCESSED_RUNTIME_V56
    // paperProcessed stays an object for compatibility with the existing
    // PaperEngine API, but is a bounded same-runtime replay cache only.
    this.paperProcessedMaxEntries = Math.max(
      16,
      Math.floor(
        num(
          options.paperProcessedMaxEntries ??
          process.env.PAPER_PROCESSED_MAX_ENTRIES,
          20000
        )
      )
    );

    this.paperProcessedTrimTo = Math.max(
      8,
      Math.min(
        this.paperProcessedMaxEntries - 1,
        Math.floor(this.paperProcessedMaxEntries * 0.75)
      )
    );
  }

  ensureState() {
    const s = this.store.state;
    s.paperPositions ||= {};
    s.paperTrades ||= {};
    s.paperProposals ||= {};
    s.paperProcessed ||= {};
    s.paperMetrics ||= { entries: 0, exits: 0, errors: 0 };
  }

  save() {
    this.ensureState();
    this.store.save();
  }

  _checkpointOpenPositionStateV55(force = false) {
    const now = this.clock();

    if (
      force !== true &&
      now - this._lastPositionCheckpointAtV55 <
        this.positionCheckpointMs
    ) {
      return false;
    }

    this._lastPositionCheckpointAtV55 = now;
    this.save();
    return true;
  }

  _recordPaperProcessedV56(key, value) {
    const cache = this.store.state.paperProcessed;
    cache[key] = value;

    const entries = Object.entries(cache);

    if (entries.length <= this.paperProcessedMaxEntries) {
      return value;
    }

    // Trimming happens only when capacity is crossed, then removes a full
    // quarter of the cache so hot traffic cannot trigger an O(N log N) sort on
    // every following decision.
    entries.sort((a, b) => {
      const at = Date.parse(a[1]?.at || '') || 0;
      const bt = Date.parse(b[1]?.at || '') || 0;
      return at - bt;
    });

    const removeCount = Math.max(
      0,
      entries.length - this.paperProcessedTrimTo
    );

    for (let i = 0; i < removeCount; i++) {
      delete cache[entries[i][0]];
    }

    return value;
  }

  mode(settings = {}) {
    return lower(settings.operatingMode || settings.mode || 'observe');
  }

  environment(settings = {}) {
    return lower(settings.tradingEnvironment || settings.environment || 'paper');
  }

  settings(settings = {}) {
    return {
      ...settings,
      operatingMode: this.mode(settings),
      tradingEnvironment: this.environment(settings),
      positionSize: num(settings.positionSize, 0.1),
      maxPositionSize: num(settings.maxPositionSize, 0.5),
      maxOpenPositions: Math.max(0, Math.floor(num(settings.maxOpenPositions, 4))),
      maxDailyEntries: Math.max(0, Math.floor(num(settings.maxDailyEntries, 10))),
      dailySpendLimit: Math.max(0, num(settings.dailySpendLimit, 0)),
      tradingCapital: Math.max(0, num(settings.tradingCapital, 0)),
      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),
      hardStopPct: Math.max(0, num(settings.hardStopPct ?? settings.stopLoss, 25)),
      trailingStopPct: Math.max(0, num(settings.trailingStopPct ?? settings.trailingStop, 15)),
      tp1Pct: Math.max(0, num(settings.tp1Pct ?? settings.tp1, 100)),
      tp1SellPct: Math.max(0, Math.min(100, num(settings.tp1SellPct ?? settings.tp1Sell, 50))),
      tp2Pct: Math.max(0, num(settings.tp2Pct ?? settings.tp2, 200)),
      tp2SellPct: Math.max(0, Math.min(100, num(settings.tp2SellPct ?? settings.tp2Sell, 25))),
      runnerPct: Math.max(0, Math.min(100, num(settings.runnerPct ?? settings.runnerSize, 25))),
      maxHoldMinutes: Math.max(1, num(settings.maxHoldMinutes, 1440)),
      exitBuyPressure: Math.max(0, num(settings.exitBuyPressure, 1.0)),
      exitOnWeakBuyPressure: settings.exitOnWeakBuyPressure !== false,
      decisionFreshnessSec: Math.max(5, num(settings.decisionFreshnessSec, 60)),
    };
  }

  userPositions(userId, status = null) {
    return Object.values(this.store.state.paperPositions)
      .filter(p => p.userId === userId && (!status || p.status === status))
      .sort((a, b) => b.openedAtMs - a.openedAtMs);
  }

  userTrades(userId) {
    return Object.values(this.store.state.paperTrades)
      .filter(t => t.userId === userId)
      .sort((a, b) => b.executedAtMs - a.executedAtMs);
  }

  userProposals(userId) {
    return Object.values(this.store.state.paperProposals)
      .filter(p => p.userId === userId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  // MEMEFLOW_TERMINAL_PAPER_POLL_HOTPATH_V59
  // Trading Terminal only renders the newest 40 trade rows. Select a bounded
  // top-K directly from durable history instead of sorting every historical
  // trade every 1.8 seconds. Public userTrades() semantics stay unchanged.
  userTradesRecentV59(userId, limit = 40) {
    const max = Math.max(
      1,
      Math.min(
        200,
        Math.floor(num(limit, 40))
      )
    );

    const rows = [];

    const timestamp = trade => {
      const direct = Number(trade?.executedAtMs);
      if (Number.isFinite(direct)) return direct;

      const parsed = Date.parse(trade?.executedAt || '');
      return Number.isFinite(parsed) ? parsed : 0;
    };

    for (const trade of Object.values(this.store.state.paperTrades || {})) {
      if (trade?.userId !== userId) continue;

      const at = timestamp(trade);
      let insertAt = rows.length;

      for (let i = 0; i < rows.length; i++) {
        if (at > timestamp(rows[i])) {
          insertAt = i;
          break;
        }
      }

      if (
        rows.length >= max &&
        insertAt >= max
      ) {
        continue;
      }

      rows.splice(insertAt, 0, trade);

      if (rows.length > max) {
        rows.pop();
      }
    }

    return rows;
  }

  // The Terminal approval panel only consumes fresh PENDING proposals and,
  // for duplicate revisions of one mint, only the newest revision. Scan the
  // durable proposal history once; sort only the small actionable result set.
  userActionableProposalsV59(
    userId,
    freshnessSec = 60,
    timestamp = this.clock()
  ) {
    const freshSec = Math.max(
      5,
      num(freshnessSec, 60)
    );

    const cutoff =
      Number(timestamp) -
      freshSec * 1000;

    const proposalTimestamp = proposal => {
      const direct = Number(proposal?.createdAtMs);
      if (Number.isFinite(direct) && direct > 0) {
        return direct;
      }

      const parsed = Date.parse(proposal?.createdAt || '');
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const latestByMint = new Map();

    for (const proposal of Object.values(this.store.state.paperProposals || {})) {
      if (
        proposal?.userId !== userId ||
        String(proposal?.status || '').toUpperCase() !== 'PENDING'
      ) {
        continue;
      }

      const createdAtMs = proposalTimestamp(proposal);

      if (
        createdAtMs > 0 &&
        createdAtMs < cutoff
      ) {
        continue;
      }

      const mint = String(proposal?.mint || '').trim();
      if (!mint) continue;

      const existing = latestByMint.get(mint);

      if (
        !existing ||
        proposalTimestamp(existing) < createdAtMs
      ) {
        latestByMint.set(mint, proposal);
      }
    }

    return [...latestByMint.values()]
      .sort(
        (a, b) =>
          proposalTimestamp(b) -
          proposalTimestamp(a)
      );
  }

  // MEMEFLOW_ENTRY_READINESS_HOTPATH_V57
  // Readiness needs aggregates, not sorted history. Keep public history helpers
  // unchanged for UI/API callers, but compute the pre-entry snapshot in one
  // linear positions pass + one linear trades pass.
  _entryReadinessSnapshotV57(userId, mint, timestamp = this.clock()) {
    const day = new Date(timestamp).toISOString().slice(0, 10);

    const openPositions = [];
    let existingPosition = null;
    let dailyEntries = 0;
    let dailySpent = 0;
    let deployed = 0;

    for (const position of Object.values(this.store.state.paperPositions || {})) {
      if (position?.userId !== userId) continue;

      const openedDay = String(position?.openedAt || '').slice(0, 10);

      if (openedDay === day) {
        dailyEntries += 1;
        dailySpent += num(position?.initialSizeSol);
      }

      if (position?.status !== 'OPEN') continue;

      openPositions.push(position);
      deployed += num(position?.remainingSizeSol);

      if (position?.mint === mint) {
        const candidateOpenedAt = num(position?.openedAtMs);
        const currentOpenedAt = num(existingPosition?.openedAtMs, -Infinity);

        if (
          !existingPosition ||
          candidateOpenedAt > currentOpenedAt
        ) {
          existingPosition = position;
        }
      }
    }

    let dailyRealizedPnl = 0;

    for (const trade of Object.values(this.store.state.paperTrades || {})) {
      if (trade?.userId !== userId) continue;

      const executedDay = String(trade?.executedAt || '').slice(0, 10);

      if (executedDay === day) {
        dailyRealizedPnl += num(trade?.realizedPnlSol);
      }
    }

    return {
      openPositions,
      existingPosition,
      dailyEntries,
      dailySpent,
      dailyRealizedPnl,
      deployed
    };
  }

  dailyEntries(userId, timestamp = this.clock()) {
    const day = new Date(timestamp).toISOString().slice(0, 10);
    return this.userPositions(userId).filter(p => p.openedAt.slice(0, 10) === day).length;
  }

  dailySpent(userId, timestamp = this.clock()) {
    const day = new Date(timestamp).toISOString().slice(0, 10);
    return this.userPositions(userId)
      .filter(p => p.openedAt.slice(0, 10) === day)
      .reduce((sum, p) => sum + num(p.initialSizeSol), 0);
  }

  dailyRealizedPnl(userId, timestamp = this.clock()) {
    const day = new Date(timestamp).toISOString().slice(0, 10);
    return this.userTrades(userId)
      .filter(t => t.executedAt.slice(0, 10) === day)
      .reduce((sum, t) => sum + num(t.realizedPnlSol), 0);
  }

  openForMint(userId, mint) {
    return this.userPositions(userId, 'OPEN').find(p => p.mint === mint) || null;
  }

  entryReadiness(userId, token, settings) {
    const s = this.settings(settings);
    const now = this.clock();

    // MEMEFLOW_MAYHEM_PAPER_GATE_V17
    const mayhemBlocked =
      token?.isMayhemMode === true ||
      lower(token?.launchMode) === 'mayhem';

    const price = num(token?.priceSol, NaN);
    const tokenUpdatedAt = Number(token?.updatedAt || token?.lastPriceAt || 0);

    const readinessSnapshot =
      this._entryReadinessSnapshotV57(
        userId,
        token?.mint,
        now
      );

    const {
      openPositions,
      existingPosition,
      dailyEntries,
      dailySpent,
      dailyRealizedPnl,
      deployed
    } = readinessSnapshot;

    const priceReady = Number.isFinite(price) && price > 0;

    const holderFresh = token?.holderFresh === true;
    const timestampKnown = Number.isFinite(tokenUpdatedAt) && tokenUpdatedAt > 0;
    const decisionFresh =
      timestampKnown &&
      (
        s.decisionFreshnessSec <= 0 ||
        now - tokenUpdatedAt <= s.decisionFreshnessSec * 1000
      );

    const dataFresh = holderFresh && decisionFresh;

    const positionSizeValid =
      s.positionSize > 0 &&
      s.positionSize <= s.maxPositionSize;

    const dailySpendAvailable =
      s.dailySpendLimit <= 0 ||
      dailySpent + s.positionSize <= s.dailySpendLimit;

    const capitalAvailable =
      s.tradingCapital <= 0 ||
      deployed + s.positionSize <= s.tradingCapital;

    const user = this.store.state.users?.[userId];
    const lossLimitClear =
      s.dailyLossLimit <= 0 ||
      dailyRealizedPnl > -s.dailyLossLimit;

    const killSwitchClear = user?.killSwitch !== true;

    const checks = [
      {
        key: 'mayhemHardBlock',
        name: 'Mayhem mode prohibited',
        pass: !mayhemBlocked,
        code: 'MAYHEM_MODE_BLOCKED'
      },
      {
        key: 'validPrice',
        name: 'Valid price',
        pass: priceReady,
        code: 'INVALID_PRICE'
      },
      {
        key: 'freshData',
        name: 'Fresh token data',
        pass: dataFresh,
        code: holderFresh
          ? 'STALE_DECISION'
          : 'STALE_TOKEN_DATA'
      },
      {
        key: 'noExistingPosition',
        name: 'No existing position',
        pass: !existingPosition,
        code: 'POSITION_EXISTS'
      },
      {
        key: 'positionCapacity',
        name: 'Position capacity',
        pass: openPositions.length < s.maxOpenPositions,
        code: 'MAX_OPEN_POSITIONS'
      },
      {
        key: 'dailyEntries',
        name: 'Daily entries available',
        pass: dailyEntries < s.maxDailyEntries,
        code: 'MAX_DAILY_ENTRIES'
      },
      {
        key: 'positionSize',
        name: 'Position size valid',
        pass: positionSizeValid,
        code: 'INVALID_POSITION_SIZE'
      },
      {
        key: 'dailySpend',
        name: 'Daily spend available',
        pass: dailySpendAvailable,
        code: 'DAILY_SPEND_LIMIT'
      },
      {
        key: 'paperCapital',
        name: 'Paper capital available',
        pass: capitalAvailable,
        code: 'PAPER_CAPITAL_LIMIT'
      },
      {
        key: 'safetyControls',
        name: 'Safety controls clear',
        pass: lossLimitClear && killSwitchClear,
        code: !killSwitchClear ? 'KILL_SWITCH' : 'DAILY_LOSS_LIMIT'
      }
    ];

    return {
      ok: checks.every(check => check.pass),
      checks,
      metrics: {
        openPositions: openPositions.length,
        maxOpenPositions: s.maxOpenPositions,
        dailyEntries,
        maxDailyEntries: s.maxDailyEntries,
        dailySpent,
        dailySpendLimit: s.dailySpendLimit,
        deployed,
        tradingCapital: s.tradingCapital,
        dailyRealizedPnl,
        dailyLossLimit: s.dailyLossLimit,
        positionSize: s.positionSize,
        maxPositionSize: s.maxPositionSize,
        holderFresh,
        tokenUpdatedAt: timestampKnown ? tokenUpdatedAt : null,
        decisionFreshnessSec: s.decisionFreshnessSec,
        killSwitch: user?.killSwitch === true
      }
    };
  }

  canEnter(userId, token, settings) {
    const readiness = this.entryReadiness(userId, token, settings);
    const failed = readiness.checks.find(check => !check.pass);

    if (failed) {
      return {
        ok: false,
        code: failed.code
      };
    }

    return { ok: true };
  }

  decisionKey(userId, token, decision) {
    const revision = decision.updatedAt || decision.decisionUpdatedAt || token.updatedAt || this.clock();
    return `${userId}:${token.mint}:${revision}`;
  }

  onDecision(userId, token, decision, rawSettings = {}) {
    this.ensureState();
    const settings = this.settings(rawSettings);
    if (!userId || !token?.mint || decision?.state !== 'BUY READY') return { action: 'NONE' };

    // MEMEFLOW_MAYHEM_DECISION_GATE_V17
    if (
      token?.isMayhemMode === true ||
      lower(token?.launchMode) === 'mayhem'
    ) {
      return {
        action: 'REJECTED',
        reason: 'MAYHEM_MODE_BLOCKED'
      };
    }
    if (settings.tradingEnvironment !== 'paper') return { action: 'NONE', reason: 'NOT_PAPER' };

    // AUTOMATE + PAPER means automatic paper execution. Repeated BUY READY
    // revisions for a token that already has an open position are ignored
    // before creating extra paperProcessed rows.
    if (settings.operatingMode === 'automate') {
      const existingPosition = this.openForMint(userId, token.mint);
      if (existingPosition) {
        return { action: 'NONE', reason: 'POSITION_EXISTS', position: existingPosition };
      }
    }

    // OBSERVE is intentionally read-only. Seeing BUY READY while paused must
    // never consume the decision or prevent a later ASSIST/AUTOMATE entry.
    if (settings.operatingMode === 'observe') {
      return { action: 'OBSERVED' };
    }

    const key = this.decisionKey(userId, token, decision);
    const processed = this.store.state.paperProcessed[key];

    // Compatibility with older builds that persisted OBSERVED decisions.
    // OBSERVED is not an execution result, so it must not block a later entry.
    if (processed && processed.result !== 'OBSERVED') {
      return { action: 'NONE', reason: 'IDEMPOTENT' };
    }

    if (settings.operatingMode === 'assist') {
      const existing = Object.values(this.store.state.paperProposals).find(
        p => p.userId === userId && p.mint === token.mint && p.status === 'PENDING'
      );
      if (existing) return { action: 'PROPOSAL_EXISTS', proposal: existing };
      const proposal = {
        id: crypto.randomUUID(),
        idempotencyKey: key,
        userId,
        mint: token.mint,
        name: token.name || token.symbol || token.mint.slice(0, 6),
        symbol: token.symbol || 'TOKEN',
        status: 'PENDING',
        mode: 'paper',
        createdAt: nowIso(),
        createdAtMs: this.clock(),
        proposedPriceSol: num(token.priceSol, null),
        proposedSizeSol: settings.positionSize,
        decisionScore: decision.score ?? null,
        decisionConfidence: decision.confidence ?? null,
        primaryReason: decision.primaryReason || null,
      };
      this.store.state.paperProposals[proposal.id] = proposal;
      this._recordPaperProcessedV56(
        key,
        {
          result: 'PROPOSED',
          proposalId: proposal.id,
          at: nowIso()
        }
      );
      this.save();
      return { action: 'PROPOSED', proposal };
    }

    if (settings.operatingMode === 'automate') {
      const result = this.openPosition(userId, token, decision, settings, key);
      this._recordPaperProcessedV56(
        key,
        {
          result: result.ok ? 'OPENED' : 'REJECTED',
          code: result.code || null,
          positionId: result.position?.id || null,
          at: nowIso(),
        }
      );
      this.save();
      return result.ok ? { action: 'OPENED', position: result.position } : { action: 'REJECTED', reason: result.code };
    }

    return { action: 'NONE', reason: 'UNKNOWN_MODE' };
  }

  openPosition(userId, token, decision, rawSettings = {}, idempotencyKey = null) {
    const settings = this.settings(rawSettings);

    const strategySource=
      String(decision?.strategySource||'')
        .trim()
        .toLowerCase();

    const isCopyTrading=
      strategySource==='copy-trading';

    // MEMEFLOW_STRATEGY_AWARE_EXECUTION_V21_5
    // There is still ONE PaperEngine. The difference is decision authority:
    // - normal scanner/AI entries: evaluate() Score + current settings-gate recheck;
    // - copy-trading entries: tracked-wallet event is the entry signal, so scanner
    //   score/holder gates must NOT be fabricated from missing scanner evidence.
    // Both paths still share PaperEngine price/freshness/capital/position/kill-switch
    // controls through canEnter().
    if(String(decision?.state||'').toUpperCase()!=='BUY READY'){
      return {
        ok:false,
        code:'DECISION_NOT_BUY_READY',
        decision
      };
    }

    const executionPolicy=
      isCopyTrading
        ? {
            state:'PASS',
            reasons:[],
            gates:[],
            failedGates:[],
            waitingGates:[],
            strategySource:'copy-trading',
            authority:'tracked-wallet-event'
          }
        : evaluateSettingsGate(
            token,
            settings,
            {includePreOpenRisk:true}
          );

    if(executionPolicy.state!=='PASS'){
      const checkedDecision={
        ...decision,
        state:executionPolicy.state==='BLOCKED'?'BLOCKED':'WAITING',
        reasons:[
          ...(Array.isArray(decision?.reasons)?decision.reasons:[]),
          ...(Array.isArray(executionPolicy.reasons)?executionPolicy.reasons:[])
        ],
        primaryReason:
          executionPolicy.reasons?.[0]||
          decision?.primaryReason||
          'Execution safety gate rejected the current token state',
        settingsEvaluation:executionPolicy,
        scoreAuthority:decision?.scoreAuthority||'evaluate'
      };

      return {
        ok:false,
        code:'DECISION_NOT_BUY_READY',
        decision:checkedDecision,
        executionPolicy
      };
    }

    const gate = this.canEnter(userId, token, settings);
    if (!gate.ok) return gate;

    const price = num(token.priceSol);

    // MEMEFLOW_PAPER_CANONICAL_ADAPTIVE_SIZING_V21
    // Execution consumes the same canonical Score. Adaptive sizing may only
    // reduce the user's configured budget and never invent a second decision.
    const positionSizing=
      isCopyTrading
        ? {
            ok:settings.positionSize>0,
            mode:'copy-fixed',
            amountSol:settings.positionSize,
            maxBudgetSol:settings.positionSize,
            canonicalScore:
              Number.isFinite(Number(decision?.score))
                ? Number(decision.score)
                : null,
            scoreAuthority:
              Number.isFinite(Number(decision?.score))
                ? 'evaluate'
                : 'tracked-wallet-event',
            strategySource:'copy-trading'
          }
        : calculateAdaptivePositionSize({
            token,
            decision,
            settings
          });

    if(!positionSizing.ok){
      return {
        ok:false,
        code:
          isCopyTrading
            ? 'INVALID_COPY_BUY_SIZE'
            : (positionSizing.code||'ADAPTIVE_SIZE_ZERO'),
        positionSizing
      };
    }

    const size=positionSizing.amountSol;
    const quantity = size / price;
    const timestamp = this.clock();
    const position = {
      id: crypto.randomUUID(),
      idempotencyKey,
      userId,
      mint: token.mint,
      name: token.name || token.symbol || token.mint.slice(0, 6),
      symbol: token.symbol || 'TOKEN',
      status: 'OPEN',
      mode: 'paper',
      openedAt: new Date(timestamp).toISOString(),
      openedAtMs: timestamp,
      closedAt: null,
      closedAtMs: null,
      entryPriceSol: price,
      currentPriceSol: price,
      exitPriceSol: null,
      initialSizeSol: size,
      remainingSizeSol: size,
      positionSizing,
      initialTokenQuantity: quantity,
      remainingTokenQuantity: quantity,
      realizedPnlSol: 0,
      unrealizedPnlSol: 0,
      realizedPnlPct: 0,
      unrealizedPnlPct: 0,
      highestPriceSol: price,
      trailingStopPriceSol: null,
      closeReason: null,
      decisionScore: decision?.score ?? null,
      decisionConfidence: decision?.confidence ?? null,
      sourceDecisionId: decision?.id || token.mint,
      primaryReason: decision?.primaryReason || null,
      currentDecisionScore: decision?.score ?? null,
      currentDecisionState: decision?.state || null,
      scoreDeltaFromEntry: 0,
      lifecycleDecision: null,
      strategySource: decision?.strategySource || null,
      copyTradingWallet: decision?.copyTradingWallet || null,
      copyTradingSource: decision?.copyTradingSource || null,
      tp1Executed: false,
      tp2Executed: false,
      takeProfitHistory: [],
      settingsSnapshot: settings,

      // MEMEFLOW_PLATFORM_LEARNING_V2
      // Market state frozen at the exact entry moment.
      entrySnapshot: {
        marketCapUsd:
          num(
            token?.marketCapUsd ??
            token?.marketCap,
            null
          ),

        liquidityUsd:
          num(token?.liquidityUsd,null),

        holders:
          num(
            token?.holderCount ??
            token?.holders,
            null
          ),

        top10Pct:
          num(
            token?.top10Pct ??
            token?.top10,
            null
          ),

        developerPct:
          num(
            token?.developerPct ??
            token?.developerSharePct,
            null
          ),

        buyPressure:
          num(token?.buyPressure,null),

        bundlePct:
          num(token?.bundlePct,null),

        sniperPct:
          num(token?.sniperPct,null),

        riskyWalletsPct:
          num(
            token?.suspectedRiskyWalletsPct,
            null
          ),

        insidersPct:
          num(token?.insidersPct,null)
      },
    };

    this.store.state.paperPositions[position.id] = position;

    try {
      this.analytics?.recordPosition?.(position);
    } catch {}
    this.store.state.paperMetrics.entries++;
    this.recordTrade(position, 'BUY', quantity, price, 0, decision?.entryReason || 'AUTOMATIC PAPER ENTRY');
    this.save();
    return { ok: true, position };
  }

  approveProposal(userId, proposalId, token, verifiedDecision = null) {
    const proposal = this.store.state.paperProposals[proposalId];
    if (!proposal || proposal.userId !== userId) return { ok: false, code: 'NOT_FOUND' };
    if (proposal.status !== 'PENDING') return { ok: false, code: 'PROPOSAL_NOT_PENDING' };

    const user = this.store.state.users[userId];
    const settings = this.settings(user?.settings || {});

    if (
      settings.decisionFreshnessSec > 0 &&
      this.clock() - Number(proposal.createdAtMs || 0) > settings.decisionFreshnessSec * 1000
    ) {
      proposal.status = 'EXPIRED';
      proposal.resolvedAt = nowIso();
      this.save();
      return { ok: false, code: 'STALE_PROPOSAL' };
    }

    const liveToken = token || this.store.state.tokens[proposal.mint];

    // MEMEFLOW_ASSIST_FRESH_DECISION_V22
    // app-server performs the final admission/RPC/evaluate() pass immediately
    // before approval. If that decision is supplied, it is the execution
    // authority. Never size/open from the stale proposal-time Score.
    if (
      verifiedDecision &&
      String(verifiedDecision?.state || '').toUpperCase() !== 'BUY READY'
    ) {
      return {
        ok: false,
        code: 'DECISION_NOT_BUY_READY',
        decision: verifiedDecision
      };
    }

    const executionDecision =
      verifiedDecision && typeof verifiedDecision === 'object'
        ? verifiedDecision
        : {
            state: 'BUY READY',
            score: proposal.decisionScore,
            confidence: proposal.decisionConfidence,
            primaryReason: proposal.primaryReason
          };

    const result = this.openPosition(
      userId,
      liveToken,
      executionDecision,
      settings,
      proposal.idempotencyKey
    );

    if (!result.ok) return result;

    proposal.status = 'APPROVED';
    proposal.resolvedAt = nowIso();
    proposal.positionId = result.position.id;
    proposal.proposedDecisionScore = proposal.decisionScore ?? null;
    proposal.approvedDecisionScore = executionDecision?.score ?? null;
    proposal.approvedDecisionConfidence = executionDecision?.confidence ?? null;
    proposal.approvedDecisionState = executionDecision?.state || null;
    proposal.approvedDecisionSource =
      verifiedDecision ? 'preopen-fresh-evaluate' : 'proposal-compatibility';

    this.save();
    return result;
  }

  rejectProposal(userId, proposalId) {
    const proposal = this.store.state.paperProposals[proposalId];
    if (!proposal || proposal.userId !== userId) return { ok: false, code: 'NOT_FOUND' };
    if (proposal.status !== 'PENDING') return { ok: false, code: 'PROPOSAL_NOT_PENDING' };
    proposal.status = 'REJECTED';
    proposal.resolvedAt = nowIso();
    this.save();
    return { ok: true, proposal };
  }

  onTokenUpdate(mint, token) {
    this.ensureState();
    if (!mint || !token) return;
    const price = num(token.priceSol, NaN);
    if (!Number.isFinite(price) || price <= 0) return;

    const open = Object.values(this.store.state.paperPositions).filter(
      p => p.status === 'OPEN' && p.mint === mint
    );

    let durableMutation = false;

    for (const position of open) {
      const result = this.updatePosition(position, token);
      if (result?.durable === true) durableMutation = true;
    }

    // Irreversible simulated execution state is scheduled for durability
    // immediately. Pure MTM/high/trailing changes are checkpointed.
    if (durableMutation) {
      this._checkpointOpenPositionStateV55(true);
    } else if (open.length) {
      this._checkpointOpenPositionStateV55(false);
    }
  }

  updatePosition(position, token) {
    const price = num(token.priceSol);
    const settings = this.settings(position.settingsSnapshot || {});
    let durableMutation = false;

    // MEMEFLOW_UNIFIED_POSITION_EXECUTION_V22
    // Decision logic lives in position-decision.mjs. PaperEngine only executes
    // the returned lifecycle command(s).
    const lifecycle = evaluatePositionDecision({
      position,
      token,
      settings,
      now: this.clock()
    });

    const metrics = lifecycle?.metrics || {};

    position.currentPriceSol = price;
    position.highestPriceSol =
      num(metrics.highestPriceSol, Math.max(num(position.highestPriceSol, price), price));

    position.trailingStopPriceSol =
      metrics.trailingStopPriceSol === null ||
      metrics.trailingStopPriceSol === undefined
        ? null
        : num(metrics.trailingStopPriceSol, null);

    position.unrealizedPnlSol =
      position.remainingTokenQuantity * (price - position.entryPriceSol);

    position.unrealizedPnlPct =
      position.entryPriceSol > 0
        ? ((price / position.entryPriceSol) - 1) * 100
        : 0;

    position.currentDecisionScore =
      metrics.currentScore ?? null;

    position.currentDecisionState =
      metrics.currentState || null;

    position.scoreDeltaFromEntry =
      metrics.scoreDeltaFromEntry ?? null;

    position.lifecycleDecision = {
      version: lifecycle?.version || 'MEMEFLOW_POSITION_DECISION_V22',
      action: lifecycle?.action || 'HOLD',
      reason: lifecycle?.reason || 'HOLD',
      code: lifecycle?.code || 'HOLD',
      priority: Number(lifecycle?.priority) || 0,
      atMs: this.clock(),
      metrics: {
        profitPct: metrics.profitPct ?? null,
        heldMinutes: metrics.heldMinutes ?? null,
        entryScore: metrics.entryScore ?? null,
        currentScore: metrics.currentScore ?? null,
        scoreDeltaFromEntry: metrics.scoreDeltaFromEntry ?? null,
        currentState: metrics.currentState || null,
        scoreFresh: metrics.scoreFresh === true,
        scoreSource: metrics.scoreSource || null,
        buyPressure: metrics.buyPressure ?? null,
        recentNetFlowSol: metrics.recentNetFlowSol ?? null,
        drawdownFromPeakPct: metrics.drawdownFromPeakPct ?? null
      }
    };

    for (const command of Array.isArray(lifecycle?.actions) ? lifecycle.actions : []) {
      if (position.status !== 'OPEN') break;

      if (command?.type === 'PARTIAL_EXIT') {
        const pct = Math.max(0, Math.min(100, num(command.percentOfInitial)));
        const qty = Math.min(
          position.remainingTokenQuantity,
          position.initialTokenQuantity * pct / 100
        );

        if (qty > 0 && this.partialExit(position, qty, price, command.reason || 'PARTIAL EXIT')) {
          if (command.code === 'TP1') position.tp1Executed = true;
          if (command.code === 'TP2') position.tp2Executed = true;
          durableMutation = true;
        }

        continue;
      }

      if (command?.type === 'CLOSE') {
        durableMutation =
          this.closePositionInternal(
            position,
            price,
            command.reason || lifecycle?.reason || 'LIFECYCLE EXIT'
          ) || durableMutation;
        break;
      }
    }

    return { durable: durableMutation, lifecycle };
  }

  partialExit(position, quantity, price, reason) {
    if (position.status !== 'OPEN' || quantity <= 0) return false;
    quantity = Math.min(quantity, position.remainingTokenQuantity);
    const cost = quantity * position.entryPriceSol;
    const value = quantity * price;
    const pnl = value - cost;
    position.remainingTokenQuantity -= quantity;
    position.remainingSizeSol = position.remainingTokenQuantity * position.entryPriceSol;
    position.realizedPnlSol += pnl;
    position.realizedPnlPct = position.initialSizeSol > 0 ? position.realizedPnlSol / position.initialSizeSol * 100 : 0;
    position.takeProfitHistory.push({ reason, price, quantity, valueSol: value, realizedPnlSol: pnl, at: nowIso() });
    this.recordTrade(position, 'SELL', quantity, price, pnl, reason);
    if (position.remainingTokenQuantity <= 1e-15) {
      this.finalizePosition(position, price, reason);
    }

    return true;
  }

  closePosition(userId, positionId, reason = 'MANUAL PAPER CLOSE') {
    const position = this.store.state.paperPositions[positionId];
    if (!position || position.userId !== userId) return { ok: false, code: 'NOT_FOUND' };
    if (position.status !== 'OPEN') return { ok: false, code: 'POSITION_NOT_OPEN' };
    const price = num(position.currentPriceSol, position.entryPriceSol);
    this.closePositionInternal(position, price, reason);
    this.save();
    return { ok: true, position };
  }

  closePositionInternal(position, price, reason) {
    if (position.status !== 'OPEN') return false;
    const qty = position.remainingTokenQuantity;
    if (qty > 0) {
      const pnl = qty * (price - position.entryPriceSol);
      position.realizedPnlSol += pnl;
      this.recordTrade(position, 'SELL', qty, price, pnl, reason);
    }
    position.remainingTokenQuantity = 0;
    position.remainingSizeSol = 0;
    this.finalizePosition(position, price, reason);
    return true;
  }

  finalizePosition(position, price, reason) {
    position.status = 'CLOSED';
    position.exitPriceSol = price;
    position.currentPriceSol = price;
    position.closedAtMs = this.clock();
    position.closedAt = new Date(position.closedAtMs).toISOString();
    position.closeReason = reason;
    position.unrealizedPnlSol = 0;
    position.unrealizedPnlPct = 0;
    position.realizedPnlPct = position.initialSizeSol > 0 ? position.realizedPnlSol / position.initialSizeSol * 100 : 0;
    this.store.state.paperMetrics.exits++;

    // MEMEFLOW_PLATFORM_LEARNING_V2
    // Final outcome goes to the shared anonymous learning dataset.
    try {
      this.analytics?.recordPosition?.(position);
    } catch {}
  }

  recordTrade(position, side, quantity, price, realizedPnlSol, reason) {
    const timestamp = this.clock();
    const trade = {
      id: crypto.randomUUID(),
      userId: position.userId,
      positionId: position.id,
      mint: position.mint,
      symbol: position.symbol,
      mode: 'paper',
      simulated: true,
      strategySource: position.strategySource || null,
      copyTradingWallet: position.copyTradingWallet || null,
      copyTradingSource: position.copyTradingSource || null,
      side,
      quantity,
      priceSol: price,
      valueSol: quantity * price,
      realizedPnlSol,
      reason,
      executedAtMs: timestamp,
      executedAt: new Date(timestamp).toISOString(),
    };
    this.store.state.paperTrades[trade.id] = trade;

    // MEMEFLOW_PLATFORM_LEARNING_V2
    try {
      this.analytics?.recordTrade?.(
        trade,
        position
      );
    } catch {}

    return trade;
  }

  // MEMEFLOW_PAPER_STATUS_HOTPATH_V58
  // Terminal polls status frequently. Status needs aggregates only, never sorted
  // history, so compute it with one positions pass + one proposals pass.
  _statusSnapshotV58(userId) {
    let openPositions = 0;
    let closedPositions = 0;
    let pendingProposals = 0;
    let realizedPnlSol = 0;

    for (const position of Object.values(this.store.state.paperPositions || {})) {
      if (position?.userId !== userId) continue;

      if (position?.status === 'OPEN') {
        openPositions += 1;
      } else if (position?.status === 'CLOSED') {
        closedPositions += 1;
      }

      realizedPnlSol += num(position?.realizedPnlSol);
    }

    for (const proposal of Object.values(this.store.state.paperProposals || {})) {
      if (
        proposal?.userId === userId &&
        proposal?.status === 'PENDING'
      ) {
        pendingProposals += 1;
      }
    }

    return {
      openPositions,
      closedPositions,
      pendingProposals,
      realizedPnlSol
    };
  }

  status(userId) {
    const user = this.store.state.users[userId];
    const settings = this.settings(user?.settings || {});
    const snapshot = this._statusSnapshotV58(userId);

    return {
      environment: settings.tradingEnvironment,
      operatingMode: settings.operatingMode,
      paperAutomationActive:
        settings.tradingEnvironment === 'paper' &&
        settings.operatingMode === 'automate',
      openPositions: snapshot.openPositions,
      closedPositions: snapshot.closedPositions,
      pendingProposals: snapshot.pendingProposals,
      realizedPnlSol: snapshot.realizedPnlSol,
      simulated: true,
      walletRequired: false,
      proRequired: false,
    };
  }
}
