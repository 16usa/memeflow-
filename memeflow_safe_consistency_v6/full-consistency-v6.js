(() => {
  "use strict";

  const VERSION = "MEMEFLOW_SAFE_CONSISTENCY_V6_2026_08_05";
  const POLL_MS = 3000;
  const INTERVALS = {
    "1s": 1000,
    "1m": 60000,
    "5m": 300000,
    "15m": 900000,
    "1h": 3600000,
    "all": 0
  };

  const chartState = {
    root: null,
    mint: "",
    name: "TOKEN",
    interval: "1s",
    points: [],
    generation: 0,
    timer: null,
    es: null,
    reconnectTimer: null,
    lastPointAt: 0,
    error: null
  };

  const finite = value =>
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value));

  const positive = value => finite(value) && Number(value) > 0;

  const toMs = value => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n < 1e12 ? n * 1000 : n;
  };

  const currentCandidate = () =>
    window.MEMEFLOW_CORE?.getSelected?.() ||
    window.currentCandidate ||
    window.selectedCandidate ||
    null;

  const mintOf = candidate =>
    String(
      candidate?.mint ||
      candidate?.tokenMint ||
      candidate?.tokenAddress ||
      candidate?.address ||
      ""
    ).trim();

  const nameOf = candidate =>
    String(candidate?.symbol || candidate?.name || "TOKEN").trim();

  const priceOf = candidate => {
    for (const value of [
      candidate?.priceUsd,
      candidate?.price,
      candidate?.market?.priceUsd,
      candidate?.marketData?.priceUsd
    ]) {
      if (positive(value)) return Number(value);
    }
    return null;
  };

  const updatedAtOf = candidate =>
    toMs(
      candidate?.priceUpdatedAt ||
      candidate?.marketUpdatedAt ||
      candidate?.updatedAt ||
      candidate?.timestamp
    ) || Date.now();

  const formatPrice = value => {
    const p = Number(value);
    if (!(p > 0)) return "—";
    if (p >= 1) return "$" + p.toFixed(4);
    if (p >= 0.01) return "$" + p.toFixed(6);
    if (p >= 0.000001) return "$" + p.toFixed(9);
    return "$" + p.toExponential(5);
  };

  function normalizePoint(row) {
    const t = toMs(
      row?.t ??
      row?.time ??
      row?.timestamp ??
      row?.createdAt ??
      row?.ts
    );
    const p = Number(
      row?.p ??
      row?.price ??
      row?.priceUsd ??
      row?.value
    );
    return t && p > 0 ? { t, p } : null;
  }

  function normalize(rows) {
    const valid = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      const point = normalizePoint(row);
      if (point) valid.push(point);
    }
    valid.sort((a, b) => a.t - b.t);

    const deduped = [];
    for (const point of valid) {
      const previous = deduped.at(-1);
      if (previous && previous.t === point.t) previous.p = point.p;
      else deduped.push(point);
    }
    return deduped.slice(-12000);
  }

  function mergePoints(incoming) {
    if (!Array.isArray(incoming) || incoming.length === 0) return false;

    const beforeCount = chartState.points.length;
    const beforeLast = chartState.points.at(-1);
    const merged = normalize([...chartState.points, ...incoming]);

    chartState.points = merged;
    const afterLast = merged.at(-1);

    return (
      beforeCount !== merged.length ||
      Number(beforeLast?.t) !== Number(afterLast?.t) ||
      Number(beforeLast?.p) !== Number(afterLast?.p)
    );
  }

  function isolateChart() {
    const oldRoot = document.getElementById("marketChart");
    if (!oldRoot) return null;

    if (oldRoot.dataset.safeConsistencyV6 === "1") return oldRoot;

    try {
      window.MEMEFLOW_MARKET_CHART?.stop?.();
      window.MEMEFLOW_MARKET_CHART_V2?.stop?.();
      window.MEMEFLOW_MARKET_CHART_FRONTEND_ONLY_V3?.stop?.();
      window.MEMEFLOW_CHART?.stop?.();
    } catch {}

    const freshRoot = oldRoot.cloneNode(true);
    freshRoot.dataset.safeConsistencyV6 = "1";
    oldRoot.replaceWith(freshRoot);

    return freshRoot;
  }

  function chartElements() {
    const root = chartState.root;
    if (!root) return null;

    return {
      root,
      line: root.querySelector("#chartLine"),
      area: root.querySelector("#chartArea"),
      dot: root.querySelector("#chartDot"),
      empty: root.querySelector("#chartEmpty"),
      price: root.querySelector("#chartCurrentPrice"),
      status: root.querySelector("#chartStatusBadge"),
      age: root.querySelector("#chartAge"),
      source: root.querySelector("#chartSource"),
      connection: root.querySelector("#chartConnection"),
      pair: root.querySelector("#chartPairMeta"),
      count: root.querySelector("#chartPointCount"),
      liveDot: root.querySelector(".chart-live-dot")
    };
  }

  function setChartStatus(kind, label, detail = "") {
    const el = chartElements();
    if (!el) return;

    if (el.status) {
      el.status.textContent = label;
      el.status.dataset.status = kind;
    }
    if (el.connection) el.connection.textContent = label;
    if (el.source) el.source.textContent = detail || label;
    if (el.liveDot) el.liveDot.className = "chart-live-dot " + kind;
  }

  function showChartEmpty(title, subtitle) {
    const el = chartElements();
    if (!el?.empty) return;

    el.empty.hidden = false;
    el.empty.style.display = "";
    el.empty.innerHTML =
      "<b>" + title + "</b><span>" + subtitle + "</span>";
  }

  function hideChartEmpty() {
    const el = chartElements();
    if (!el?.empty) return;
    el.empty.hidden = true;
    el.empty.style.display = "none";
  }

  function resetChartVisual() {
    const el = chartElements();
    if (!el) return;

    if (el.line) el.line.setAttribute("points", "");
    if (el.area) el.area.setAttribute("d", "");
    if (el.dot) {
      el.dot.style.display = "none";
      el.dot.setAttribute("cx", "0");
      el.dot.setAttribute("cy", "0");
    }
    if (el.price) el.price.textContent = "—";
    if (el.age) el.age.textContent = "—";
    if (el.count) el.count.textContent = "0 points";
  }

  function aggregate(rows, interval) {
    if (!rows.length) return [];

    const span = INTERVALS[interval] ?? 1000;
    if (span === 0) return rows.slice(-900);

    const buckets = new Map();

    for (const point of rows) {
      const key = Math.floor(point.t / span) * span;
      const previous = buckets.get(key);

      if (!previous || point.t >= previous.lastAt) {
        buckets.set(key, {
          t: key,
          p: point.p,
          lastAt: point.t
        });
      }
    }

    return [...buckets.values()]
      .sort((a, b) => a.t - b.t)
      .slice(-900);
  }

  function renderChart() {
    const el = chartElements();
    if (!el) return;

    const rows = aggregate(chartState.points, chartState.interval);

    if (el.count) {
      el.count.textContent =
        rows.length + " point" + (rows.length === 1 ? "" : "s");
    }

    if (el.pair) {
      el.pair.textContent = chartState.mint
        ? chartState.name + " · Solana"
        : "No pair selected";
    }

    if (!chartState.mint) {
      resetChartVisual();
      setChartStatus("nodata", "NO TOKEN", "Candidate mint is missing");
      showChartEmpty(
        "No token selected",
        "Select a candidate with a valid mint address."
      );
      return;
    }

    if (rows.length < 2) {
      resetChartVisual();

      if (chartState.error && rows.length === 0) {
        setChartStatus("error", "ERROR", chartState.error);
        showChartEmpty("Market history unavailable", chartState.error);
      } else {
        setChartStatus(
          rows.length === 1 ? "stale" : "nodata",
          rows.length === 1 ? "CONNECTING" : "NO DATA",
          rows.length === 1
            ? "Waiting for another positive price point"
            : "No verified price points"
        );
        showChartEmpty(
          rows.length === 1
            ? "Waiting for another price point…"
            : "Loading market history…",
          rows.length === 1
            ? "The line appears after two valid price points."
            : "Realtime data will appear automatically."
        );
      }
      return;
    }

    hideChartEmpty();

    const width = 760;
    const height = 230;
    const paddingX = 18;
    const paddingY = 16;

    const prices = rows.map(point => point.p);
    let min = Math.min(...prices);
    let max = Math.max(...prices);

    if (!(max > min)) {
      const pad = Math.max(max * 0.004, Number.EPSILON);
      min -= pad;
      max += pad;
    } else {
      const pad = (max - min) * 0.08;
      min -= pad;
      max += pad;
    }

    const firstTime = rows[0].t;
    const lastTime = rows.at(-1).t;

    const x = t =>
      paddingX +
      ((t - firstTime) / Math.max(1, lastTime - firstTime)) *
      (width - paddingX * 2);

    const y = p =>
      paddingY +
      (1 - (p - min) / (max - min)) *
      (height - paddingY * 2);

    const coords = rows.map(point => [x(point.t), y(point.p)]);
    const polyline = coords
      .map(([a, b]) => a.toFixed(2) + "," + b.toFixed(2))
      .join(" ");

    if (el.line) el.line.setAttribute("points", polyline);

    if (el.area) {
      const first = coords[0];
      const last = coords.at(-1);
      el.area.setAttribute(
        "d",
        "M " + first[0] + " " + (height - paddingY) +
        " L " + polyline.replaceAll(",", " ") +
        " L " + last[0] + " " + (height - paddingY) + " Z"
      );
    }

    const latest = rows.at(-1);
    const latestXY = coords.at(-1);
    chartState.lastPointAt = latest.t;

    if (el.dot) {
      el.dot.style.display = "";
      el.dot.setAttribute("cx", latestXY[0]);
      el.dot.setAttribute("cy", latestXY[1]);
    }

    if (el.price) el.price.textContent = formatPrice(latest.p);

    const age = Math.max(0, Date.now() - latest.t);

    if (el.age) {
      el.age.textContent =
        age < 60000
          ? Math.round(age / 1000) + " sec ago"
          : Math.round(age / 60000) + " min ago";
    }

    if (age <= 15000) {
      setChartStatus("live", "LIVE", "Fresh Solana price stream");
    } else {
      setChartStatus("stale", "STALE", "Last verified point is old");
    }
  }

  async function fetchHistory(mint, generation) {
    const endpoints = [
      "/api/chart/history?chainId=solana&tokenAddress=" +
        encodeURIComponent(mint) +
        "&interval=1s&limit=12000",
      "/api/market/history?mint=" +
        encodeURIComponent(mint) +
        "&interval=1s&limit=12000",
      "/api/market/series?mint=" +
        encodeURIComponent(mint) +
        "&interval=1s&limit=12000"
    ];

    let lastError = "";

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          credentials: "include",
          cache: "no-store"
        });

        if (generation !== chartState.generation) return;

        if (response.status === 404) continue;
        if (!response.ok) throw new Error("HTTP " + response.status);

        const data = await response.json();

        if (generation !== chartState.generation) return;

        const rows = normalize(
          data?.points ||
          data?.history ||
          data?.series ||
          data?.candles ||
          []
        );

        mergePoints(rows);
        chartState.error = null;
        renderChart();
        connectStream(mint, generation);
        return;
      } catch (error) {
        lastError = String(error?.message || error);
      }
    }

    if (generation !== chartState.generation) return;

    if (!chartState.points.length && lastError) {
      chartState.error = lastError;
    }

    renderChart();
  }

  function connectStream(mint, generation) {
    if (chartState.es) {
      chartState.es.close();
      chartState.es = null;
    }

    clearTimeout(chartState.reconnectTimer);
    chartState.reconnectTimer = null;

    if (!mint || generation !== chartState.generation) return;

    const query = new URLSearchParams({
      chainId: "solana",
      tokenAddress: mint,
      interval: "1s",
      limit: "12000"
    });

    const es = new EventSource("/api/chart/stream?" + query);
    chartState.es = es;

    es.addEventListener("snapshot", event => {
      if (generation !== chartState.generation) return;

      try {
        const data = JSON.parse(event.data);
        if (mergePoints(data?.points || [])) renderChart();
      } catch {}
    });

    es.addEventListener("update", event => {
      if (generation !== chartState.generation) return;

      try {
        const data = JSON.parse(event.data);

        if (data?.snapshot) {
          if (mergePoints(data.snapshot.points || [])) renderChart();
          return;
        }

        if (data?.point && mergePoints([data.point])) {
          renderChart();
        }
      } catch {}
    });

    es.onerror = () => {
      if (generation !== chartState.generation) return;

      if (chartState.es) {
        chartState.es.close();
        chartState.es = null;
      }

      setChartStatus(
        chartState.points.length ? "stale" : "error",
        chartState.points.length ? "STALE" : "RECONNECTING",
        "Realtime stream interrupted"
      );

      clearTimeout(chartState.reconnectTimer);
      chartState.reconnectTimer = setTimeout(() => {
        connectStream(mint, generation);
      }, 2500);
    };
  }

  function selectChartCandidate(candidate) {
    if (!candidate) return;

    const mint = mintOf(candidate);
    const name = nameOf(candidate);
    const price = priceOf(candidate);

    if (!mint) {
      if (!chartState.mint) {
        chartState.name = name;
        renderChart();
      }
      return;
    }

    if (mint !== chartState.mint) {
      chartState.generation += 1;

      if (chartState.es) {
        chartState.es.close();
        chartState.es = null;
      }

      clearTimeout(chartState.reconnectTimer);
      chartState.reconnectTimer = null;

      chartState.mint = mint;
      chartState.name = name;
      chartState.points = [];
      chartState.error = null;
      chartState.lastPointAt = 0;

      chartState.root.dataset.tokenAddress = mint;
      chartState.root.dataset.chainId = "solana";

      resetChartVisual();
      setChartStatus("stale", "LOADING", "Loading market history");
      showChartEmpty(
        "Loading market history…",
        "Fetching verified price points for " + name + "."
      );

      if (positive(price)) {
        mergePoints([{
          t: updatedAtOf(candidate),
          p: price
        }]);
      }

      renderChart();
      fetchHistory(mint, chartState.generation);
      return;
    }

    chartState.name = name;

    if (positive(price)) {
      if (mergePoints([{
        t: updatedAtOf(candidate),
        p: price
      }])) {
        renderChart();
      }
    }
  }

  function bindIntervals() {
    const root = chartState.root;
    if (!root) return;

    root.querySelectorAll("[data-chart-interval]").forEach(button => {
      if (button.dataset.safeConsistencyV6Bound === "1") return;

      button.dataset.safeConsistencyV6Bound = "1";

      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const next = String(
          button.dataset.chartInterval || "1s"
        ).toLowerCase();

        if (!(next in INTERVALS)) return;
        if (next === chartState.interval) return;

        chartState.interval = next;

        root.querySelectorAll("[data-chart-interval]").forEach(node => {
          node.classList.toggle("active", node === button);
        });

        renderChart();
      }, true);
    });
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function syncMission(candidate) {
    const hasCandidate = Boolean(mintOf(candidate) || candidate?.id);
    const title = document.querySelector(".hero-title");
    const subtitle = document.querySelector(".hero-sub");

    if (title) {
      title.textContent = hasCandidate
        ? "Evaluating " + (candidate?.name || candidate?.symbol || "candidate")
        : "Waiting for live candidates";
    }

    if (subtitle) {
      const reason =
        Array.isArray(candidate?.reasons) && candidate.reasons[0]
          ? candidate.reasons[0]
          : candidate?.reason;

      subtitle.textContent = hasCandidate
        ? reason || "Live market and AI validation are in progress."
        : "Candidates will appear after the backend, decision engine and Solana data stream are connected.";
    }
  }

  function syncDecision(candidate) {
    if (!candidate) return;

    const price = Number(candidate?.priceUsd || candidate?.price || 0);
    const liquidity = Number(
      candidate?.liquiditySol ||
      candidate?.liquidityUsd ||
      candidate?.liquidity ||
      0
    );

    const updatedAt = toMs(
      candidate?.priceUpdatedAt ||
      candidate?.marketUpdatedAt ||
      candidate?.updatedAt
    );

    const quoteFresh =
      positive(price) &&
      updatedAt &&
      Date.now() - updatedAt <= 15000;

    const quoteAmount = Number(
      candidate?.quoteAmount ||
      candidate?.executionSize ||
      candidate?.positionSize ||
      0
    );

    const hasQuote =
      quoteFresh &&
      positive(liquidity) &&
      positive(quoteAmount);

    const routeApproved =
      hasQuote &&
      candidate?.routeApproved === true;

    const reasons = Array.isArray(candidate?.reasons)
      ? candidate.reasons
      : [];

    const riskApproved =
      candidate?.state === "BUY READY" &&
      reasons.length === 0;

    setText(
      "#quoteAge",
      quoteFresh
        ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) + " sec"
        : "—"
    );

    setText(
      "#executionRouteGate",
      routeApproved ? "PASS" : "PENDING"
    );

    setText(
      "#executionRiskGate",
      riskApproved ? "PASS" : "PENDING"
    );

    const wallet = String(
      document.querySelector("#walletExecutionGate")?.textContent || ""
    ).toUpperCase();

    const balance = String(
      document.querySelector("#walletBalanceGate")?.textContent || ""
    ).toUpperCase();

    const gates = [
      Boolean(mintOf(candidate)),
      candidate?.state === "BUY READY",
      positive(price),
      positive(liquidity),
      Number(candidate?.holderCount) > 0,
      finite(candidate?.top10Pct),
      hasQuote,
      routeApproved,
      wallet === "CONNECTED" || wallet === "PASS",
      balance === "PASS"
    ];

    const passed = gates.filter(Boolean).length;

    setText(
      "#executionReadinessCount",
      passed + " / " + gates.length + " checks"
    );

    setText(
      "#executionReadinessLabel",
      candidate?.state === "BUY READY" && routeApproved
        ? "Ready for final wallet validation"
        : "Market and AI validation pending"
    );

    const bar = document.querySelector("#executionReadinessBar");
    if (bar) {
      bar.style.width =
        Math.round((passed / gates.length) * 100) + "%";
    }

    const explainer = document.querySelector("#executionSignalExplainer");
    if (explainer) {
      explainer.innerHTML =
        "<b>AI signal:</b> " +
        (candidate?.state || "WAITING") +
        " &nbsp;·&nbsp; <b>Execution:</b> " +
        (
          routeApproved
            ? "ROUTE READY"
            : "LOCKED until complete market and AI validation."
        );
    }

    const missingMarket = [
      price,
      liquidity,
      candidate?.marketCapSol || candidate?.marketCap,
      candidate?.buyPressure
    ].filter(value => !positive(value)).length;

    if (finite(candidate?.confidence)) {
      setText(
        "#decisionConfidence",
        Math.min(
          Number(candidate.confidence),
          missingMarket ? 85 : 100
        ) + "%"
      );
    }

    if (finite(candidate?.data)) {
      setText(
        "#decisionData",
        Math.min(
          Number(candidate.data),
          Math.max(0, 100 - missingMarket * 20)
        ) + "%"
      );
    }
  }

  function synchronize() {
    const candidate = currentCandidate();
    if (!candidate) return;

    syncMission(candidate);
    syncDecision(candidate);
    selectChartCandidate(candidate);
  }

  function initialize() {
    chartState.root = isolateChart();

    if (chartState.root) {
      bindIntervals();

      const observer = new MutationObserver(bindIntervals);
      observer.observe(chartState.root, {
        childList: true,
        subtree: true
      });

      renderChart();
    }

    window.addEventListener("memeflow:candidatechange", event => {
      const candidate = {
        ...(currentCandidate() || {}),
        ...(event.detail || {})
      };

      syncMission(candidate);
      syncDecision(candidate);
      selectChartCandidate(candidate);
    });

    document.addEventListener("memeflow:statechange", synchronize);
    document.addEventListener("memeflow:candidate-selected", synchronize);

    synchronize();

    chartState.timer = setInterval(synchronize, POLL_MS);

    window.MEMEFLOW_SAFE_CONSISTENCY_V6 = {
      version: VERSION,
      sync: synchronize,
      getChartState: () => ({
        mint: chartState.mint,
        name: chartState.name,
        interval: chartState.interval,
        points: [...chartState.points],
        generation: chartState.generation,
        error: chartState.error
      }),
      stop: () => {
        clearInterval(chartState.timer);
        clearTimeout(chartState.reconnectTimer);

        if (chartState.es) {
          chartState.es.close();
          chartState.es = null;
        }
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true
    });
  } else {
    initialize();
  }
})();
