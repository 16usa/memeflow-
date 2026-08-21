#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_DATA_TUNNEL_PAGE_V1"
VERSION = "data-tunnel-page-v1"
STAMP = time.strftime("%Y%m%d-%H%M%S")

SYSTEM_HTML = r"""
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1,viewport-fit=cover"
  />
  <meta name="theme-color" content="#020609" />
  <title>MEMEFLOW — Data Tunnel Pipeline</title>

  <link rel="stylesheet" href="/system.css?v=data-tunnel-page-v1" />

  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.166.1/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.166.1/examples/jsm/"
    }
  }
  </script>
</head>

<body class="system-page">
  <main class="system-shell">
    <header class="topbar">
      <div class="brand-side">
        <button
          class="icon-button back-button"
          type="button"
          aria-label="Back"
          onclick="history.back()"
        >
          <span aria-hidden="true">←</span>
        </button>

        <a class="brand" href="/" aria-label="MEMEFLOW home">
          <span class="brand-mark" aria-hidden="true">
            <span class="brand-wing brand-wing-a"></span>
            <span class="brand-wing brand-wing-b"></span>
          </span>
          <span class="brand-name">MEMEFLOW</span>
        </a>
      </div>

      <nav class="top-actions" aria-label="System actions">
        <a class="top-action" href="/trading">Trading</a>
        <a class="top-action top-action-accent" href="/settings">Settings</a>
        <button
          id="resetViewBtn"
          class="top-action"
          type="button"
        >
          Reset view
        </button>

        <button
          id="autoRotateBtn"
          class="compat-control"
          type="button"
          aria-hidden="true"
          tabindex="-1"
        >
          Auto rotate
        </button>
      </nav>

      <div class="compat-status" aria-hidden="true">
        <span id="wsDot"></span><span id="wsStatus"></span>
        <span id="rpcDot"></span><span id="rpcStatus"></span>
        <span id="aiDot"></span><span id="aiStatus"></span>
      </div>
    </header>

    <section class="architecture-card">
      <div class="architecture-heading">
        <div>
          <div class="eyebrow">REAL-TIME ARCHITECTURE</div>
          <h1 class="scene-title">Data Tunnel Pipeline</h1>
        </div>

        <div class="legend" aria-label="Pipeline states">
          <span><i class="legend-dot waiting"></i>WAITING</span>
          <span><i class="legend-dot watch"></i>WATCH</span>
          <span><i class="legend-dot blocked"></i>BLOCKED</span>
          <span><i class="legend-dot ready"></i>BUY READY</span>
        </div>
      </div>

      <div class="viewport-wrap mf-data-tunnel-viewport">
        <canvas
          id="systemCanvas"
          aria-label="MEMEFLOW system topology"
        ></canvas>
        <div
          id="memeflowTrue3DHost"
          aria-label="Interactive MEMEFLOW Data Tunnel"
        ></div>
      </div>
    </section>

    <section class="telemetry-strip" aria-label="Live telemetry">
      <article class="telemetry-cell">
        <span class="telemetry-label">EVENTS</span>
        <div class="telemetry-value-row">
          <strong id="eventCount">0</strong>
          <span>received</span>
        </div>
      </article>

      <article class="telemetry-cell">
        <span class="telemetry-label">TRADE EVENTS</span>
        <div class="telemetry-value-row">
          <strong id="tradeCount">0</strong>
          <span>decoded</span>
        </div>
      </article>

      <article class="telemetry-cell">
        <span class="telemetry-label">HOLDER QUEUE</span>
        <div class="telemetry-value-row">
          <strong id="holderQueue">0</strong>
          <span>jobs</span>
        </div>
      </article>

      <div class="compat-telemetry" aria-hidden="true">
        <span id="activeUsers">0</span>
        <span id="freshBacklog">0</span>
        <span id="lastEvent">—</span>
        <span id="lastSync">—</span>
      </div>
    </section>

    <aside id="inspector" class="inspector-card">
      <div class="panel-heading">
        <div>
          <div class="eyebrow">LIVE INSPECTOR</div>
          <h2 id="inspectorTitle">MEMEFLOW Core</h2>
        </div>

        <span class="panel-badge">SYSTEM</span>
      </div>

      <div id="metricGrid" class="metric-grid"></div>

      <div class="inspector-secondary" aria-live="polite">
        <div id="primaryReason"></div>
        <div id="gateList"></div>
        <div id="inspectorMint"></div>
        <button id="focusBtn" type="button">Focus node</button>
      </div>
    </aside>

    <section class="token-flow-card">
      <div class="panel-heading token-flow-heading">
        <div>
          <div class="eyebrow">TOKEN FLOW</div>
          <h2>Recent pipeline state</h2>
        </div>

        <div class="token-flow-actions">
          <a class="view-all" href="/trading">VIEW ALL</a>
          <span class="live-state">
            <i></i>
            <span id="telemetryMode">LIVE</span>
          </span>
        </div>
      </div>

      <div id="tokenRail" class="token-rail"></div>
    </section>
  </main>

  <script
    type="module"
    src="/system.js?v=data-tunnel-page-v1"
  ></script>
  <script
    type="module"
    src="/memeflow-3d/embed.js?v=data-tunnel-page-v1"
  ></script>
</body>
</html>
"""

SYSTEM_CSS = r"""
/* ===== MEMEFLOW_DATA_TUNNEL_PAGE_V1 ===== */

:root {
  color-scheme: dark;

  --bg: #020609;
  --bg-deep: #000204;

  --surface: rgba(5, 11, 16, .92);
  --surface-2: rgba(7, 14, 20, .82);
  --surface-3: rgba(8, 17, 24, .72);

  --line: rgba(104, 151, 176, .18);
  --line-strong: rgba(100, 178, 215, .31);

  --text: #f1f6f8;
  --muted: #7f909b;
  --soft: #52616b;

  --cyan: #67dcff;
  --blue: #5b7cff;
  --green: #57e6a0;
  --red: #ef6477;
  --violet: #9c6dff;

  --radius-lg: 20px;
  --radius-md: 14px;
  --radius-sm: 10px;

  --shadow:
    0 20px 70px rgba(0, 0, 0, .32),
    inset 0 1px 0 rgba(255, 255, 255, .012);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at 50% -10%, rgba(22, 67, 90, .08), transparent 36%),
    #020609;
}

body {
  color: var(--text);
  font-family:
    Inter,
    ui-sans-serif,
    -apple-system,
    BlinkMacSystemFont,
    "SF Pro Display",
    "SF Pro Text",
    "Segoe UI",
    sans-serif;

  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}

button,
a {
  font: inherit;
}

button {
  color: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

.system-page {
  min-height: 100vh;
  padding:
    max(8px, env(safe-area-inset-top))
    max(8px, env(safe-area-inset-right))
    max(22px, env(safe-area-inset-bottom))
    max(8px, env(safe-area-inset-left));
}

.system-shell {
  width: min(100%, 1480px);
  margin: 0 auto;
  display: grid;
  gap: 10px;
}

.topbar,
.architecture-card,
.telemetry-strip,
.inspector-card,
.token-flow-card {
  position: relative;
  overflow: hidden;

  border: 1px solid var(--line);
  background:
    linear-gradient(180deg, rgba(7, 14, 20, .96), rgba(2, 7, 10, .96));

  box-shadow: var(--shadow);
}

.topbar::after,
.architecture-card::after,
.inspector-card::after,
.token-flow-card::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;

  background:
    linear-gradient(
      115deg,
      rgba(105, 221, 255, .018),
      transparent 22%,
      transparent 76%,
      rgba(87, 230, 160, .012)
    );
}

.topbar {
  z-index: 20;

  min-height: 76px;
  padding: 10px 12px;

  border-radius: var(--radius-lg);

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.brand-side {
  min-width: 0;

  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-button {
  width: 54px;
  height: 54px;

  border: 1px solid rgba(115, 158, 180, .22);
  border-radius: 14px;

  background:
    linear-gradient(180deg, rgba(10, 18, 24, .96), rgba(3, 8, 12, .96));

  color: #aebdc5;

  display: grid;
  place-items: center;

  cursor: pointer;

  transition:
    border-color .18s ease,
    transform .18s ease,
    background .18s ease;
}

.icon-button span {
  font-size: 30px;
  font-weight: 300;
  transform: translateY(-1px);
}

.icon-button:hover {
  border-color: rgba(103, 220, 255, .45);
  background: rgba(10, 20, 28, .98);
}

.icon-button:active {
  transform: scale(.98);
}

.brand {
  min-width: 0;

  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  position: relative;
  width: 42px;
  height: 31px;
  flex: 0 0 auto;
}

.brand-wing {
  position: absolute;
  top: 4px;

  width: 29px;
  height: 10px;

  border-radius: 7px;

  background:
    linear-gradient(90deg, #53d6ff, #5ce7ac);

  box-shadow:
    0 0 18px rgba(93, 226, 211, .12);

  transform-origin: center;
}

.brand-wing-a {
  left: 0;
  transform: rotate(39deg);
}

.brand-wing-b {
  right: 0;
  transform: rotate(-39deg);
}

.brand-name {
  overflow: hidden;
  text-overflow: ellipsis;

  font-size: 23px;
  font-weight: 800;
  letter-spacing: .18em;
  white-space: nowrap;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.top-action {
  min-height: 52px;
  padding: 0 18px;

  border: 1px solid rgba(110, 153, 176, .20);
  border-radius: 13px;

  background:
    linear-gradient(180deg, rgba(8, 16, 22, .88), rgba(2, 7, 10, .90));

  color: #9dafb8;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  font-size: 14px;
  letter-spacing: .04em;

  cursor: pointer;

  transition:
    color .18s ease,
    border-color .18s ease,
    background .18s ease;
}

.top-action:hover,
.top-action-accent {
  color: #c7f2ff;
  border-color: rgba(103, 220, 255, .40);
}

.top-action-accent {
  box-shadow:
    inset 0 0 0 1px rgba(80, 198, 239, .04),
    0 0 24px rgba(47, 183, 230, .025);
}

.compat-control,
.compat-status,
.compat-telemetry {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden !important;
  clip: rect(0 0 0 0) !important;
  clip-path: inset(50%) !important;
  white-space: nowrap !important;
  pointer-events: none !important;
}

.architecture-card {
  padding: 0;

  border-radius: var(--radius-lg);
}

.architecture-heading {
  min-height: 126px;
  padding: 26px 24px 16px;

  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.eyebrow {
  margin-bottom: 8px;

  color: var(--cyan);

  font-size: 11px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: .22em;
}

.scene-title,
.panel-heading h2,
.token-flow-heading h2 {
  margin: 0;

  color: #f2f6f8;

  font-weight: 700;
  letter-spacing: -.025em;
}

.scene-title {
  font-size: clamp(25px, 3vw, 34px);
}

.legend {
  padding: 7px 11px;

  border: 1px solid rgba(103, 151, 175, .20);
  border-radius: 999px;

  background: rgba(2, 7, 11, .74);

  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;

  color: #778892;

  font-size: 9px;
  font-weight: 650;
  letter-spacing: .08em;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.legend-dot {
  width: 8px;
  height: 8px;

  border-radius: 50%;

  display: inline-block;
}

.legend-dot.waiting {
  background: #8294a0;
}

.legend-dot.watch {
  background: var(--blue);
}

.legend-dot.blocked {
  background: var(--red);
}

.legend-dot.ready {
  background: var(--green);
}

.viewport-wrap {
  position: relative;

  width: calc(100% - 20px);
  height: clamp(510px, 58vw, 690px);

  margin: 0 10px 10px;

  overflow: hidden;

  border: 1px solid rgba(83, 131, 156, .13);
  border-radius: 16px;

  background:
    radial-gradient(circle at 50% 62%, rgba(31, 54, 68, .09), transparent 32%),
    #000;

  isolation: isolate;
}

.viewport-wrap::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;

  pointer-events: none;

  background:
    linear-gradient(180deg, rgba(8, 16, 23, .08), transparent 22%, transparent 78%, rgba(6, 13, 19, .16));
}

#systemCanvas {
  display: none !important;
}

#memeflowTrue3DHost {
  position: absolute;
  inset: 0;
  z-index: 2;

  overflow: hidden;

  background: #000;

  touch-action: none;
}

#memeflowTrue3DCanvas {
  display: block;
  width: 100%;
  height: 100%;

  outline: none;

  touch-action: none;

  cursor: grab;

  user-select: none;
  -webkit-user-select: none;
}

#memeflowTrue3DCanvas:active {
  cursor: grabbing;
}

.telemetry-strip {
  min-height: 88px;

  border-radius: 17px;

  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.telemetry-cell {
  min-width: 0;

  padding: 17px 20px;

  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.telemetry-cell + .telemetry-cell {
  border-left: 1px solid rgba(100, 145, 167, .17);
}

.telemetry-label {
  color: #59707d;

  font-size: 9px;
  font-weight: 750;
  letter-spacing: .14em;
}

.telemetry-value-row {
  min-width: 0;

  display: flex;
  align-items: baseline;
  gap: 7px;
}

.telemetry-value-row strong {
  color: #eef4f6;

  font-size: clamp(20px, 2.4vw, 27px);
  line-height: 1;
  font-weight: 720;
  letter-spacing: .015em;
}

.telemetry-value-row span {
  color: #42535d;

  font-size: 10px;
}

.inspector-card,
.token-flow-card {
  padding: 22px 20px 18px;

  border-radius: var(--radius-lg);
}

.panel-heading {
  margin-bottom: 14px;

  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.panel-heading h2 {
  font-size: clamp(22px, 2.7vw, 29px);
}

.panel-badge {
  min-height: 30px;
  padding: 0 12px;

  border: 1px solid rgba(111, 150, 169, .22);
  border-radius: 999px;

  background: rgba(4, 9, 13, .70);

  color: #8a9aa3;

  display: inline-flex;
  align-items: center;

  font-size: 10px;
  font-weight: 800;
  letter-spacing: .14em;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.metric,
.metric-card,
.metric-item {
  min-width: 0;
  min-height: 74px;

  padding: 14px 15px;

  border: 1px solid rgba(95, 139, 162, .18);
  border-radius: 13px;

  background:
    linear-gradient(180deg, rgba(4, 10, 14, .90), rgba(1, 5, 8, .94));

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.01);
}

.metric-grid > * {
  min-width: 0;
}

.metric-grid small,
.metric-grid .label,
.metric-grid .metric-label {
  color: #566a75 !important;

  font-size: 9px !important;
  font-weight: 700 !important;
  letter-spacing: .11em !important;
  text-transform: uppercase !important;
}

.metric-grid strong,
.metric-grid .value,
.metric-grid .metric-value {
  color: #edf4f6 !important;

  font-size: 20px !important;
  font-weight: 700 !important;
}

.inspector-secondary {
  display: none;
}

.token-flow-card {
  min-height: 180px;
}

.token-flow-heading {
  align-items: center;
}

.token-flow-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.view-all {
  min-height: 38px;
  padding: 0 15px;

  border: 1px solid rgba(82, 188, 228, .34);
  border-radius: 11px;

  color: #9edcf2;

  display: inline-flex;
  align-items: center;

  font-size: 10px;
  font-weight: 800;
  letter-spacing: .13em;
}

.live-state {
  color: #65dca1;

  display: inline-flex;
  align-items: center;
  gap: 8px;

  font-size: 10px;
  letter-spacing: .12em;
}

.live-state i {
  width: 8px;
  height: 8px;

  border-radius: 50%;

  background: var(--green);

  box-shadow: 0 0 14px rgba(87, 230, 160, .25);
}

.token-rail {
  min-height: 86px;

  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(230px, 1fr);
  gap: 10px;

  overflow-x: auto;
  overscroll-behavior-x: contain;

  scrollbar-width: thin;
  scrollbar-color: rgba(92, 141, 164, .23) transparent;
}

.token-card,
.token-item {
  min-width: 0;

  padding: 14px;

  border: 1px solid rgba(94, 140, 162, .18);
  border-radius: 13px;

  background:
    linear-gradient(180deg, rgba(4, 10, 14, .90), rgba(1, 5, 8, .94));
}

.token-card a,
.token-item a {
  color: inherit;
}

@media (max-width: 760px) {
  .system-page {
    padding:
      max(7px, env(safe-area-inset-top))
      7px
      max(18px, env(safe-area-inset-bottom));
  }

  .system-shell {
    gap: 8px;
  }

  .topbar {
    min-height: 70px;
    padding: 8px 9px;

    gap: 10px;
  }

  .brand-side {
    gap: 9px;
  }

  .icon-button {
    width: 47px;
    height: 47px;

    border-radius: 12px;
  }

  .brand-mark {
    width: 36px;
    height: 28px;
  }

  .brand-wing {
    width: 25px;
    height: 9px;
  }

  .brand-name {
    font-size: 18px;
    letter-spacing: .14em;
  }

  .top-actions {
    gap: 6px;
  }

  .top-action {
    min-height: 47px;
    padding: 0 11px;

    border-radius: 11px;

    font-size: 11px;
  }

  .architecture-heading {
    min-height: 116px;
    padding: 22px 18px 12px;

    display: block;
  }

  .scene-title {
    font-size: 24px;
  }

  .legend {
    width: max-content;
    max-width: 100%;

    margin-top: 14px;
    padding: 5px 8px;

    gap: 8px;

    font-size: 7px;
  }

  .legend-dot {
    width: 6px;
    height: 6px;
  }

  .viewport-wrap {
    width: calc(100% - 12px);
    height: 455px;

    margin: 0 6px 6px;

    border-radius: 14px;
  }

  .telemetry-strip {
    min-height: 82px;

    border-radius: 15px;
  }

  .telemetry-cell {
    padding: 13px 12px;
  }

  .telemetry-label {
    font-size: 7px;
  }

  .telemetry-value-row {
    gap: 4px;
  }

  .telemetry-value-row strong {
    font-size: 19px;
  }

  .telemetry-value-row span {
    font-size: 7px;
  }

  .inspector-card,
  .token-flow-card {
    padding: 18px 13px 15px;

    border-radius: 16px;
  }

  .panel-heading h2 {
    font-size: 22px;
  }

  .metric-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .metric,
  .metric-card,
  .metric-item {
    min-height: 64px;

    padding: 10px 9px;

    border-radius: 10px;
  }

  .metric-grid small,
  .metric-grid .label,
  .metric-grid .metric-label {
    font-size: 6px !important;
  }

  .metric-grid strong,
  .metric-grid .value,
  .metric-grid .metric-value {
    font-size: 16px !important;
  }

  .token-flow-actions {
    gap: 9px;
  }

  .view-all {
    min-height: 34px;
    padding: 0 11px;

    font-size: 8px;
  }

  .token-rail {
    grid-auto-columns: minmax(210px, 84vw);
  }
}

@media (max-width: 520px) {
  .brand-name {
    font-size: 17px;
  }

  .top-action {
    min-width: 0;
    padding: 0 9px;

    font-size: 10px;
  }

  .architecture-heading {
    padding-left: 16px;
    padding-right: 16px;
  }

  .viewport-wrap {
    height: 430px;
  }

  .eyebrow {
    font-size: 9px;
  }
}

@media (max-width: 430px) {
  .brand-side {
    gap: 7px;
  }

  .brand {
    gap: 7px;
  }

  .brand-name {
    font-size: 15px;
    letter-spacing: .11em;
  }

  .brand-mark {
    width: 30px;
  }

  .brand-wing {
    width: 22px;
  }

  .top-actions {
    gap: 4px;
  }

  .top-action {
    min-height: 44px;
    padding: 0 8px;

    font-size: 9px;
  }

  .icon-button {
    width: 44px;
    height: 44px;
  }
}
"""

LAYOUT_JS = r"""
export const NODES = [
  {
    id: 'discovery',
    label: 'DISCOVERY',
    color: 0x35a8ff,
    pos: [-4.10, 1.55, 0.70],
    size: [1.72, 3.35, 0.54],
    lane: 'left'
  },
  {
    id: 'bootstrap',
    label: 'FAST BOOTSTRAP',
    color: 0x3c8dff,
    pos: [-3.45, 1.50, -2.10],
    size: [1.58, 3.10, 0.50],
    lane: 'left'
  },
  {
    id: 'risk',
    label: 'RISK ENGINE',
    color: 0x42d5ff,
    pos: [-2.70, 1.42, -4.45],
    size: [1.44, 2.85, 0.46],
    lane: 'left',
    overhead: true
  },
  {
    id: 'market',
    label: 'MARKET LEDGER',
    color: 0x5e8fff,
    pos: [-1.45, 1.34, -6.10],
    size: [1.34, 2.58, 0.42],
    lane: 'center',
    overhead: true
  },
  {
    id: 'holders',
    label: 'HOLDER LEDGER',
    color: 0x6aa8ff,
    pos: [-0.40, 1.30, -7.15],
    size: [1.22, 2.40, 0.40],
    lane: 'center',
    overhead: true
  },
  {
    id: 'openai',
    label: 'OPENAI ASSISTANT',
    color: 0xa46dff,
    pos: [0.72, 1.30, -7.25],
    size: [1.22, 2.40, 0.40],
    lane: 'center',
    overhead: true
  },
  {
    id: 'decision',
    label: 'DECISION',
    color: 0xb16cff,
    pos: [1.72, 1.34, -6.05],
    size: [1.34, 2.58, 0.42],
    lane: 'center',
    overhead: true
  },
  {
    id: 'paper',
    label: 'PAPER ENGINE',
    color: 0x4bc6ff,
    pos: [3.35, 1.50, -2.05],
    size: [1.58, 3.10, 0.50],
    lane: 'right'
  },
  {
    id: 'execution',
    label: 'LIVE EXECUTION',
    color: 0x5fe8a4,
    pos: [4.15, 1.58, 0.62],
    size: [1.72, 3.40, 0.54],
    lane: 'right',
    execution: true
  },
  {
    id: 'core',
    label: 'MEMEFLOW CORE',
    color: 0x65efa9,
    pos: [0.18, 1.25, -9.45],
    size: [1.16, 2.15, 0.38],
    lane: 'core',
    core: true
  }
];

export const ROUTES = [
  ['discovery', 'bootstrap'],
  ['bootstrap', 'risk'],
  ['risk', 'market'],
  ['market', 'holders'],
  ['holders', 'openai'],
  ['openai', 'decision'],
  ['decision', 'paper'],
  ['paper', 'execution'],
  ['holders', 'core'],
  ['openai', 'core']
];
"""

MATERIALS_JS = r"""
import * as THREE from 'three';

export function metalMaterial(color, intensity = 0.035) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x050b10,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.88,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.07
  });
}

export function darkMetal() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x03070a,
    metalness: 0.93,
    roughness: 0.25,
    clearcoat: 0.72,
    clearcoatRoughness: 0.11
  });
}

export function glassMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x061018,
    emissive: color,
    emissiveIntensity: 0.08,
    metalness: 0.08,
    roughness: 0.08,
    transmission: 0.20,
    thickness: 0.20,
    ior: 1.34,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.82
  });
}

export function additive(color, opacity = 0.55) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function lineMaterial(color, opacity = 0.45) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function hex(color) {
  return '#' + Number(color).toString(16).padStart(6, '0');
}

export function textTexture(
  text,
  color = 0xffffff,
  {
    width = 1024,
    height = 256,
    fontSize = 72,
    weight = 760,
    background = 'rgba(2,5,8,.88)',
    border = true,
    glow = 6
  } = {}
) {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  const accent = hex(color);

  ctx.clearRect(0, 0, width, height);

  if (background) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, background);
    gradient.addColorStop(1, 'rgba(0,2,4,.95)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  if (border) {
    ctx.globalAlpha = .42;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, width - 10, height - 10);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = '#eef5f7';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = accent;
  ctx.shadowBlur = glow;

  ctx.font =
    `${weight} ${fontSize}px Inter, Arial, sans-serif`;

  ctx.fillText(
    text,
    width / 2,
    height / 2
  );

  ctx.shadowBlur = 0;

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.needsUpdate = true;

  return texture;
}

export function iconTexture(kind, color) {
  const canvas =
    document.createElement('canvas');

  canvas.width = 512;
  canvas.height = 512;

  const ctx =
    canvas.getContext('2d');

  const accent = hex(color);

  ctx.translate(256, 256);

  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.shadowColor = accent;
  ctx.shadowBlur = 16;

  ctx.globalAlpha = .35;

  ctx.beginPath();
  ctx.arc(0, 0, 106, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;

  if (kind === 'discovery') {
    ctx.beginPath();
    ctx.arc(-20, -18, 44, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(12, 14);
    ctx.lineTo(72, 76);
    ctx.stroke();
  }

  else if (kind === 'bootstrap') {
    ctx.beginPath();
    ctx.moveTo(20, -90);
    ctx.lineTo(-42, 2);
    ctx.lineTo(3, 2);
    ctx.lineTo(-16, 86);
    ctx.lineTo(64, -16);
    ctx.lineTo(10, -16);
    ctx.closePath();
    ctx.stroke();
  }

  else if (kind === 'risk') {
    ctx.beginPath();
    ctx.moveTo(0, -82);
    ctx.lineTo(68, -49);
    ctx.lineTo(52, 34);
    ctx.quadraticCurveTo(0, 90, -52, 34);
    ctx.lineTo(-68, -49);
    ctx.closePath();
    ctx.stroke();
  }

  else if (kind === 'market') {
    ctx.beginPath();
    ctx.moveTo(-76, 55);
    ctx.lineTo(-34, 9);
    ctx.lineTo(-4, 31);
    ctx.lineTo(30, -20);
    ctx.lineTo(72, -68);
    ctx.stroke();
  }

  else if (kind === 'holders') {
    ctx.beginPath();
    ctx.arc(0, -35, 34, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 46, 62, Math.PI, Math.PI * 2);
    ctx.stroke();
  }

  else if (kind === 'openai') {
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      ctx.beginPath();
      ctx.ellipse(0, -45, 28, 57, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  else if (kind === 'decision') {
    ctx.beginPath();
    ctx.arc(0, 0, 76, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-16, -50);
    ctx.lineTo(16, -18);
    ctx.lineTo(-10, 12);
    ctx.lineTo(28, 54);
    ctx.stroke();
  }

  else if (kind === 'paper') {
    ctx.strokeRect(-60, -80, 120, 160);

    for (const y of [-38, 0, 38]) {
      ctx.beginPath();
      ctx.moveTo(-30, y);
      ctx.lineTo(30, y);
      ctx.stroke();
    }
  }

  else if (kind === 'execution') {
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    for (const [x1, y1, x2, y2] of [
      [0, -110, 0, -76],
      [0, 76, 0, 110],
      [-110, 0, -76, 0],
      [76, 0, 110, 0]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  else if (kind === 'core') {
    for (const radius of [28, 60, 94]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.colorSpace =
    THREE.SRGBColorSpace;

  return texture;
}
"""

MODULES_JS = r"""
import * as THREE from 'three';

import {
  RoundedBoxGeometry
} from 'three/addons/geometries/RoundedBoxGeometry.js';

import {
  cloneHardwareAsset
} from './assets.js?v=true-3d-glb-v5';

import {
  metalMaterial,
  darkMetal,
  glassMaterial,
  additive,
  textTexture,
  iconTexture
} from './materials.js?v=data-tunnel-page-v1';

function frameBar(w, h, d, material) {
  return new THREE.Mesh(
    new RoundedBoxGeometry(
      w,
      h,
      d,
      3,
      Math.min(w, h, d) * .18
    ),
    material
  );
}

function addCornerBolts(group, width, height, z, color) {
  const material =
    new THREE.MeshStandardMaterial({
      color: 0x8fa1aa,
      emissive: color,
      emissiveIntensity: .025,
      metalness: .95,
      roughness: .15
    });

  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      const bolt =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            .035,
            .035,
            .022,
            12
          ),
          material
        );

      bolt.rotation.x =
        Math.PI / 2;

      bolt.position.set(
        x * width * .43,
        y * height * .43,
        z
      );

      group.add(bolt);
    }
  }
}

function addInnerHardware(
  group,
  assets,
  node,
  width,
  height,
  frontZ
) {
  if (!assets) return;

  try {
    const inner =
      cloneHardwareAsset(
        assets,
        node
      );

    inner.name =
      `INNER_GLB_${node.id}`;

    inner.rotation.x =
      Math.PI / 2;

    inner.rotation.z =
      Math.PI / 2;

    const scale =
      Math.min(
        width * .19,
        height * .095
      );

    inner.scale.setScalar(scale);

    inner.position.set(
      0,
      .06,
      frontZ - .11
    );

    inner.traverse(object => {
      if (!object.isMesh) return;

      object.material =
        object.material?.clone?.()
        || darkMetal();

      if (
        object.material
        && 'transparent' in object.material
      ) {
        object.material.transparent =
          true;

        object.material.opacity =
          .35;
      }
    });

    group.add(inner);
  }

  catch (error) {
    console.warn(
      '[DATA-TUNNEL] inner GLB skipped',
      node.id,
      error
    );
  }
}

export function createTunnelModule(node, assets) {
  const root =
    new THREE.Group();

  root.name =
    `MEMEFLOW_TUNNEL_NODE_${node.id}`;

  root.position.set(
    node.pos[0],
    node.pos[1],
    node.pos[2]
  );

  const [
    width,
    height,
    depth
  ] = node.size;

  const chassis =
    new THREE.Mesh(
      new RoundedBoxGeometry(
        width,
        height,
        depth,
        5,
        .12
      ),
      metalMaterial(
        node.color,
        node.core ? .08 : .025
      )
    );

  root.add(chassis);

  const frameMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x10191f,
      emissive: node.color,
      emissiveIntensity:
        node.execution
          ? .07
          : node.core
            ? .07
            : .025,
      metalness: .92,
      roughness: .18
    });

  const frontZ =
    depth / 2 + .022;

  const railW =
    Math.max(.09, width * .075);

  const railH =
    Math.max(.09, height * .045);

  const leftRail =
    frameBar(
      railW,
      height * .92,
      .075,
      frameMaterial
    );

  leftRail.position.set(
    -width * .46,
    0,
    frontZ
  );

  root.add(leftRail);

  const rightRail =
    leftRail.clone();

  rightRail.position.x =
    width * .46;

  root.add(rightRail);

  const topRail =
    frameBar(
      width * .92,
      railH,
      .075,
      frameMaterial
    );

  topRail.position.set(
    0,
    height * .46,
    frontZ
  );

  root.add(topRail);

  const bottomRail =
    topRail.clone();

  bottomRail.position.y =
    -height * .46;

  root.add(bottomRail);

  const glass =
    new THREE.Mesh(
      new RoundedBoxGeometry(
        width * .78,
        height * .62,
        .06,
        4,
        .06
      ),
      glassMaterial(
        node.color
      )
    );

  glass.position.set(
    0,
    height * .08,
    frontZ + .018
  );

  root.add(glass);

  addInnerHardware(
    root,
    assets,
    node,
    width,
    height,
    frontZ
  );

  const icon =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * .50,
        width * .50
      ),
      new THREE.MeshBasicMaterial({
        map: iconTexture(
          node.id,
          node.color
        ),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

  icon.position.set(
    0,
    height * .10,
    frontZ + .07
  );

  root.add(icon);

  const label =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * .86,
        Math.min(.38, height * .12)
      ),
      new THREE.MeshBasicMaterial({
        map: textTexture(
          node.label,
          node.color,
          {
            width: 1200,
            height: 240,
            fontSize:
              node.label.length > 12
                ? 63
                : 76,
            border: false,
            glow: 5
          }
        ),
        transparent: true,
        depthWrite: false
      })
    );

  label.position.set(
    0,
    -height * .32,
    frontZ + .074
  );

  root.add(label);

  const accent =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        .055,
        height * .54,
        .035
      ),
      additive(
        node.color,
        node.execution
          ? .95
          : .62
      )
    );

  accent.position.set(
    -width * .40,
    height * .05,
    frontZ + .09
  );

  root.add(accent);

  addCornerBolts(
    root,
    width,
    height,
    frontZ + .08,
    node.color
  );

  const pickMesh =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height,
        depth + .16
      ),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );

  pickMesh.userData.nodeId =
    node.id;

  root.add(pickMesh);

  let halo = null;

  if (node.core) {
    halo =
      new THREE.Group();

    halo.position.z =
      frontZ + .13;

    for (
      const [radius, opacity]
      of [
        [.34, .80],
        [.55, .44],
        [.78, .18]
      ]
    ) {
      const ring =
        new THREE.Mesh(
          new THREE.TorusGeometry(
            radius,
            .012,
            10,
            64
          ),
          additive(
            node.color,
            opacity
          )
        );

      halo.add(ring);
    }

    root.add(halo);
  }

  return {
    root,
    node,
    chassis,
    glass,
    icon,
    label,
    pickMesh,
    halo
  };
}
"""

ROUTES_JS = r"""
import * as THREE from 'three';

import {
  additive,
  lineMaterial
} from './materials.js?v=data-tunnel-page-v1';

function point(node) {
  return new THREE.Vector3(
    node.pos[0],
    node.pos[1] - .42,
    node.pos[2]
  );
}

function routeCurve(aNode, bNode) {
  const a = point(aNode);
  const b = point(bNode);

  const middle =
    a.clone()
      .lerp(b, .5);

  middle.y =
    Math.min(a.y, b.y) - .12;

  return new THREE.CatmullRomCurve3(
    [
      a,
      middle,
      b
    ],
    false,
    'catmullrom',
    .12
  );
}

export function createRoute(
  aNode,
  bNode,
  color
) {
  const curve =
    routeCurve(
      aNode,
      bNode
    );

  const root =
    new THREE.Group();

  const halo =
    new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        48,
        .034,
        8,
        false
      ),
      additive(
        color,
        .07
      )
    );

  root.add(halo);

  const tube =
    new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        48,
        .009,
        8,
        false
      ),
      additive(
        color,
        .48
      )
    );

  root.add(tube);

  const coreLine =
    new THREE.Line(
      new THREE.BufferGeometry()
        .setFromPoints(
          curve.getPoints(80)
        ),
      lineMaterial(
        color,
        .50
      )
    );

  root.add(coreLine);

  const packets = [];

  for (
    let index = 0;
    index < 3;
    index++
  ) {
    const packet =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          .035,
          10,
          8
        ),
        additive(
          0xffffff,
          .86
        )
      );

    packet.userData.seed =
      index / 3;

    packet.userData.speed =
      .055
      + index * .004;

    root.add(packet);

    packets.push(packet);
  }

  return {
    root,
    curve,
    packets,
    color
  };
}

export function animateRoutes(
  routes,
  time
) {
  for (
    const route
    of routes
  ) {
    for (
      let index = 0;
      index < route.packets.length;
      index++
    ) {
      const packet =
        route.packets[index];

      const t =
        (
          packet.userData.seed
          + time * packet.userData.speed
        ) % 1;

      packet.position.copy(
        route.curve.getPointAt(t)
      );

      const scale =
        .78
        + Math.sin(
          time * 6
          + index * 1.7
        ) * .12;

      packet.scale.setScalar(
        scale
      );
    }
  }
}
"""

SCENE_JS = r"""
import * as THREE from 'three';

import {
  OrbitControls
} from 'three/addons/controls/OrbitControls.js';

import {
  EffectComposer
} from 'three/addons/postprocessing/EffectComposer.js';

import {
  RenderPass
} from 'three/addons/postprocessing/RenderPass.js';

import {
  UnrealBloomPass
} from 'three/addons/postprocessing/UnrealBloomPass.js';

import {
  OutputPass
} from 'three/addons/postprocessing/OutputPass.js';

import {
  RoundedBoxGeometry
} from 'three/addons/geometries/RoundedBoxGeometry.js';

import {
  NODES,
  ROUTES
} from './layout.js?v=data-tunnel-page-v1';

import {
  loadHardwareAssets
} from './assets.js?v=true-3d-glb-v5';

import {
  createTunnelModule
} from './modules.js?v=data-tunnel-page-v1';

import {
  createRoute,
  animateRoutes
} from './routes.js?v=data-tunnel-page-v1';

import {
  darkMetal,
  additive,
  lineMaterial,
  textTexture
} from './materials.js?v=data-tunnel-page-v1';

function nodeMap() {
  return new Map(
    NODES.map(
      node => [
        node.id,
        node
      ]
    )
  );
}

function makeBeam(
  width,
  height,
  depth,
  x,
  y,
  z,
  material
) {
  const mesh =
    new THREE.Mesh(
      new RoundedBoxGeometry(
        width,
        height,
        depth,
        3,
        .04
      ),
      material
    );

  mesh.position.set(
    x,
    y,
    z
  );

  return mesh;
}

function addTunnelFloor(scene) {
  const floor =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        13.8,
        28
      ),
      new THREE.MeshPhysicalMaterial({
        color: 0x010407,
        metalness: .82,
        roughness: .23,
        clearcoat: .88,
        clearcoatRoughness: .12
      })
    );

  floor.rotation.x =
    -Math.PI / 2;

  floor.position.set(
    0,
    -.22,
    -2.2
  );

  scene.add(floor);

  const guideXs =
    [-5.35, -4.85, -2.2, -1.72, 1.72, 2.2, 4.85, 5.35];

  const colors = [
    0x2f78ff,
    0x55cbff,
    0x426cff,
    0x8b62ff,
    0x9c63ff,
    0x71a7ff,
    0x4ae19a,
    0x33bb7f
  ];

  guideXs.forEach(
    (x, index) => {
      const guide =
        makeBeam(
          .055,
          .035,
          25.5,
          x,
          -.16,
          -2.5,
          additive(
            colors[index],
            .28
          )
        );

      scene.add(guide);
    }
  );

  for (
    const z
    of [2.5, 0, -2.5, -5, -7.5, -10]
  ) {
    const cross =
      makeBeam(
        11.6,
        .025,
        .035,
        0,
        -.15,
        z,
        additive(
          0x497a96,
          .08
        )
      );

    scene.add(cross);
  }
}

function addTunnelFrames(scene) {
  const material =
    darkMetal();

  for (
    const z
    of [2.7, .3, -2.4, -5.1, -7.8, -10.2]
  ) {
    const scale =
      THREE.MathUtils.mapLinear(
        z,
        2.7,
        -10.2,
        1,
        .48
      );

    const halfWidth =
      6.25 * scale
      + .95;

    const height =
      5.05 * scale
      + 1.05;

    const left =
      makeBeam(
        .18,
        height,
        .20,
        -halfWidth,
        height / 2 - .20,
        z,
        material
      );

    const right =
      left.clone();

    right.position.x =
      halfWidth;

    const top =
      makeBeam(
        halfWidth * 2,
        .15,
        .20,
        0,
        height - .20,
        z,
        material
      );

    scene.add(
      left,
      right,
      top
    );
  }

  const leftGlow =
    makeBeam(
      .045,
      .045,
      25,
      -5.75,
      .18,
      -2.4,
      additive(
        0x3598ff,
        .35
      )
    );

  const rightGlow =
    makeBeam(
      .045,
      .045,
      25,
      5.75,
      .18,
      -2.4,
      additive(
        0x53e49c,
        .32
      )
    );

  scene.add(
    leftGlow,
    rightGlow
  );
}

function addOverheadLabel(
  scene,
  node
) {
  if (!node.overhead) {
    return null;
  }

  const group =
    new THREE.Group();

  const texture =
    textTexture(
      node.label,
      0xa6b6be,
      {
        width: 820,
        height: 250,
        fontSize:
          node.label.length > 13
            ? 58
            : 66,
        background: null,
        border: false,
        glow: 0
      }
    );

  const material =
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: .86,
      depthWrite: false
    });

  const sprite =
    new THREE.Sprite(
      material
    );

  sprite.position.set(
    node.pos[0],
    4.36,
    node.pos[2] + .10
  );

  const scale =
    node.label.length > 12
      ? 2.55
      : 2.15;

  sprite.scale.set(
    scale,
    .72,
    1
  );

  group.add(sprite);

  const points = [
    new THREE.Vector3(
      node.pos[0],
      4.00,
      node.pos[2]
    ),
    new THREE.Vector3(
      node.pos[0],
      node.pos[1] + node.size[1] * .52,
      node.pos[2]
    )
  ];

  const guide =
    new THREE.Line(
      new THREE.BufferGeometry()
        .setFromPoints(points),
      new THREE.LineDashedMaterial({
        color: 0x718792,
        dashSize: .06,
        gapSize: .055,
        transparent: true,
        opacity: .42
      })
    );

  guide.computeLineDistances();

  group.add(guide);

  scene.add(group);

  return group;
}

function colorForRoute(aNode, bNode) {
  if (
    aNode.id === 'openai'
    || aNode.id === 'decision'
    || bNode.id === 'openai'
    || bNode.id === 'decision'
  ) {
    return 0x9b6dff;
  }

  if (
    aNode.id === 'paper'
    || aNode.id === 'execution'
    || bNode.id === 'paper'
    || bNode.id === 'execution'
    || aNode.id === 'core'
    || bNode.id === 'core'
  ) {
    return 0x59e5a0;
  }

  return 0x52b9ff;
}

export async function bootMemeflowTrue3D(
  rootId = 'memeflowTrue3DHost'
) {
  const mount =
    document.getElementById(
      rootId
    );

  if (!mount) {
    throw new Error(
      'Data Tunnel mount not found: '
      + rootId
    );
  }

  mount.replaceChildren();

  const scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x000204
    );

  scene.fog =
    new THREE.FogExp2(
      0x000205,
      .038
    );

  const camera =
    new THREE.PerspectiveCamera(
      46,
      1,
      .05,
      100
    );

  const renderer =
    new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference:
        'high-performance'
    });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      1.75
    )
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

  renderer.toneMappingExposure =
    .92;

  renderer.domElement.id =
    'memeflowTrue3DCanvas';

  mount.appendChild(
    renderer.domElement
  );

  const composer =
    new EffectComposer(
      renderer
    );

  composer.addPass(
    new RenderPass(
      scene,
      camera
    )
  );

  const bloom =
    new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      .20,
      .30,
      .91
    );

  composer.addPass(
    bloom
  );

  composer.addPass(
    new OutputPass()
  );

  const controls =
    new OrbitControls(
      camera,
      renderer.domElement
    );

  controls.enablePan =
    false;

  controls.enableDamping =
    true;

  controls.dampingFactor =
    .055;

  controls.rotateSpeed =
    .47;

  controls.zoomSpeed =
    .95;

  controls.minPolarAngle =
    .35;

  controls.maxPolarAngle =
    1.48;

  if (
    controls.touches
  ) {
    controls.touches.ONE =
      THREE.TOUCH.ROTATE;

    controls.touches.TWO =
      THREE.TOUCH.DOLLY_ROTATE;
  }

  scene.add(
    new THREE.HemisphereLight(
      0x6da8ca,
      0x010204,
      .23
    )
  );

  const key =
    new THREE.DirectionalLight(
      0xf2f9ff,
      1.10
    );

  key.position.set(
    0,
    8,
    7
  );

  scene.add(
    key
  );

  const blueFill =
    new THREE.PointLight(
      0x409fff,
      5.2,
      18,
      2
    );

  blueFill.position.set(
    -4.8,
    2.8,
    1.8
  );

  scene.add(
    blueFill
  );

  const violetFill =
    new THREE.PointLight(
      0x9a67ff,
      3.8,
      16,
      2
    );

  violetFill.position.set(
    .2,
    2.1,
    -4.8
  );

  scene.add(
    violetFill
  );

  const greenFill =
    new THREE.PointLight(
      0x52e89c,
      4.8,
      18,
      2
    );

  greenFill.position.set(
    4.8,
    2.7,
    1.2
  );

  scene.add(
    greenFill
  );

  addTunnelFloor(
    scene
  );

  addTunnelFrames(
    scene
  );

  let assets = null;

  try {
    assets =
      await loadHardwareAssets();
  }

  catch (error) {
    console.warn(
      '[DATA-TUNNEL] GLB decoration unavailable',
      error
    );
  }

  const modules =
    new Map();

  const pickMeshes =
    [];

  for (
    const node
    of NODES
  ) {
    const built =
      createTunnelModule(
        node,
        assets
      );

    scene.add(
      built.root
    );

    modules.set(
      node.id,
      built
    );

    pickMeshes.push(
      built.pickMesh
    );

    addOverheadLabel(
      scene,
      node
    );
  }

  const nodes =
    nodeMap();

  const routes =
    [];

  for (
    const [from, to]
    of ROUTES
  ) {
    const a =
      nodes.get(from);

    const b =
      nodes.get(to);

    if (!a || !b) {
      continue;
    }

    const route =
      createRoute(
        a,
        b,
        colorForRoute(
          a,
          b
        )
      );

    scene.add(
      route.root
    );

    routes.push(
      route
    );
  }

  const home =
    {
      position:
        new THREE.Vector3(
          0,
          4.45,
          12.4
        ),

      target:
        new THREE.Vector3(
          0,
          1.42,
          -4.10
        )
    };

  function configureHomeForAspect() {
    const width =
      Math.max(
        1,
        mount.clientWidth
      );

    const height =
      Math.max(
        1,
        mount.clientHeight
      );

    const aspect =
      width / height;

    camera.aspect =
      aspect;

    if (
      aspect < .88
    ) {
      camera.fov = 51;

      home.position.set(
        0,
        4.85,
        14.65
      );

      home.target.set(
        0,
        1.40,
        -4.10
      );
    }

    else if (
      aspect < 1.30
    ) {
      camera.fov = 47;

      home.position.set(
        0,
        4.55,
        13.20
      );

      home.target.set(
        0,
        1.42,
        -4.10
      );
    }

    else {
      camera.fov = 43;

      home.position.set(
        0,
        4.15,
        11.80
      );

      home.target.set(
        0,
        1.45,
        -4.25
      );
    }

    camera.updateProjectionMatrix();

    controls.minDistance =
      5.4;

    controls.maxDistance =
      30;
  }

  function resetView() {
    configureHomeForAspect();

    camera.position.copy(
      home.position
    );

    controls.target.copy(
      home.target
    );

    controls.update();
  }

  resetView();

  const resetButton =
    document.getElementById(
      'resetViewBtn'
    );

  const resetHandler =
    () => resetView();

  resetButton
    ?.addEventListener(
      'click',
      resetHandler
    );

  const resize =
    () => {
      const width =
        Math.max(
          1,
          mount.clientWidth
        );

      const height =
        Math.max(
          1,
          mount.clientHeight
        );

      renderer.setSize(
        width,
        height,
        false
      );

      composer.setSize(
        width,
        height
      );

      camera.aspect =
        width / height;

      camera.updateProjectionMatrix();
    };

  const resizeObserver =
    new ResizeObserver(
      resize
    );

  resizeObserver.observe(
    mount
  );

  resize();

  const raycaster =
    new THREE.Raycaster();

  const pointer =
    new THREE.Vector2();

  let pointerDown = null;

  renderer.domElement
    .addEventListener(
      'pointerdown',
      event => {
        pointerDown = {
          x: event.clientX,
          y: event.clientY
        };
      }
    );

  renderer.domElement
    .addEventListener(
      'pointerup',
      event => {
        if (!pointerDown) {
          return;
        }

        const movement =
          Math.hypot(
            event.clientX
              - pointerDown.x,
            event.clientY
              - pointerDown.y
          );

        pointerDown =
          null;

        if (
          movement > 8
        ) {
          return;
        }

        const rect =
          renderer.domElement
            .getBoundingClientRect();

        pointer.x =
          (
            (
              event.clientX
              - rect.left
            ) / rect.width
          ) * 2 - 1;

        pointer.y =
          -(
            (
              event.clientY
              - rect.top
            ) / rect.height
          ) * 2 + 1;

        raycaster.setFromCamera(
          pointer,
          camera
        );

        const hit =
          raycaster
            .intersectObjects(
              pickMeshes,
              false
            )[0];

        const nodeId =
          hit?.object?.userData?.nodeId;

        if (
          nodeId
        ) {
          window.dispatchEvent(
            new CustomEvent(
              'memeflow:true3d-select',
              {
                detail: {
                  nodeId
                }
              }
            )
          );
        }
      }
    );

  const clock =
    new THREE.Clock();

  let frame =
    0;

  let disposed =
    false;

  function animate() {
    if (
      disposed
    ) {
      return;
    }

    frame =
      requestAnimationFrame(
        animate
      );

    const time =
      clock.getElapsedTime();

    animateRoutes(
      routes,
      time
    );

    const core =
      modules.get(
        'core'
      );

    if (
      core?.halo
    ) {
      core.halo.rotation.z +=
        .0015;
    }

    controls.update();

    composer.render();
  }

  animate();

  function dispose() {
    if (
      disposed
    ) {
      return;
    }

    disposed =
      true;

    cancelAnimationFrame(
      frame
    );

    resizeObserver.disconnect();

    resetButton
      ?.removeEventListener(
        'click',
        resetHandler
      );

    controls.dispose();

    scene.traverse(
      object => {
        object.geometry
          ?.dispose
          ?.();

        if (
          Array.isArray(
            object.material
          )
        ) {
          for (
            const material
            of object.material
          ) {
            material
              ?.dispose
              ?.();
          }
        }

        else {
          object.material
            ?.dispose
            ?.();
        }
      }
    );

    composer.dispose();

    renderer.dispose();

    mount.replaceChildren();
  }

  return {
    scene,
    camera,
    renderer,
    composer,
    controls,
    modules,
    routes,
    resetView,
    dispose
  };
}

/* ===== MEMEFLOW_DATA_TUNNEL_PAGE_V1 ===== */
"""

EMBED_JS = r"""
import {
  bootMemeflowTrue3D
} from './scene.js?v=data-tunnel-page-v1';

async function startDataTunnel() {
  const viewport =
    document.querySelector(
      '.viewport-wrap'
    );

  if (!viewport) {
    console.error(
      '[DATA-TUNNEL] viewport-wrap not found'
    );

    return;
  }

  let host =
    document.getElementById(
      'memeflowTrue3DHost'
    );

  if (!host) {
    host =
      document.createElement(
        'div'
      );

    host.id =
      'memeflowTrue3DHost';

    viewport.appendChild(
      host
    );
  }

  window.__MEMEFLOW_TRUE_3D_ACTIVE__ =
    true;

  requestAnimationFrame(
    async () => {
      try {
        const previous =
          window.__memeflowTrue3D;

        if (
          previous
          && typeof previous.dispose === 'function'
        ) {
          previous.dispose();
        }

        window.__memeflowTrue3D =
          await bootMemeflowTrue3D(
            'memeflowTrue3DHost'
          );

        document
          .getElementById(
            'systemCanvas'
          )
          ?.setAttribute(
            'aria-hidden',
            'true'
          );

        console.log(
          '[DATA-TUNNEL] page V1 mounted'
        );
      }

      catch (error) {
        window.__MEMEFLOW_TRUE_3D_ACTIVE__ =
          false;

        console.error(
          '[DATA-TUNNEL] boot failed',
          error
        );
      }
    }
  );
}

if (
  document.readyState
  === 'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    startDataTunnel,
    {
      once: true
    }
  );
}

else {
  startDataTunnel();
}
"""


FILES = {
    "system.html": SYSTEM_HTML,
    "system.css": SYSTEM_CSS,
    "memeflow-3d/layout.js": LAYOUT_JS,
    "memeflow-3d/materials.js": MATERIALS_JS,
    "memeflow-3d/modules.js": MODULES_JS,
    "memeflow-3d/routes.js": ROUTES_JS,
    "memeflow-3d/scene.js": SCENE_JS,
    "memeflow-3d/embed.js": EMBED_JS,
}


def log(message: str) -> None:
    print(f"[DATA-TUNNEL-PAGE-V1] {message}", flush=True)


def run(
    *args: str,
    cwd: Path | None = None,
    check: bool = True,
):
    result = subprocess.run(
        list(args),
        cwd=cwd,
        text=True,
        capture_output=True,
    )

    if result.stdout.strip():
        print(result.stdout.rstrip())

    if result.stderr.strip():
        print(
            result.stderr.rstrip(),
            file=sys.stderr,
        )

    if (
        check
        and result.returncode != 0
    ):
        raise RuntimeError(
            f"command failed ({result.returncode}): {' '.join(args)}"
        )

    return result


def find_root() -> Path:
    cwd = Path.cwd()

    candidates = [
        cwd,
        cwd / "memeflow-app",
        cwd.parent / "memeflow-app",
        Path.home() / "workspace",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace"),
        Path("/home/runner/workspace/memeflow-app"),
        Path("/workspace"),
        Path("/workspace/memeflow-app"),
    ]

    seen = set()

    for candidate in candidates:
        try:
            candidate = candidate.resolve()
        except Exception:
            continue

        if candidate in seen:
            continue

        seen.add(candidate)

        if all(
            (candidate / name).is_file()
            for name in (
                "system.html",
                "system.css",
                "system.js",
            )
        ):
            return candidate

    raise RuntimeError(
        "MEMEFLOW project root not found"
    )


def git_root(
    project_root: Path,
) -> Path | None:
    result = run(
        "git",
        "rev-parse",
        "--show-toplevel",
        cwd=project_root,
        check=False,
    )

    if result.returncode != 0:
        return None

    value = result.stdout.strip()

    return (
        Path(value).resolve()
        if value
        else None
    )


def rel(
    path: Path,
    repo: Path,
) -> str:
    return str(
        path.resolve()
        .relative_to(
            repo.resolve()
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Replace the entire MEMEFLOW System page with the unified "
            "Data Tunnel Pipeline design and cinematic 3D scene."
        )
    )

    parser.add_argument(
        "--push",
        action="store_true",
        help=(
            "commit and push the completed page after validation"
        ),
    )

    args = parser.parse_args()

    root = find_root()

    log(
        f"project: {root}"
    )

    required_runtime = [
        root / "system.js",
        root / "memeflow-3d" / "assets.js",
    ]

    for path in required_runtime:
        if not path.is_file():
            raise RuntimeError(
                f"required runtime file missing: {path}"
            )

    glb_dir = root / "memeflow-3d" / "assets"

    for name in (
        "module-standard.glb",
        "module-core.glb",
        "module-terminal.glb",
    ):
        if not (glb_dir / name).is_file():
            raise RuntimeError(
                f"required GLB missing: {glb_dir / name}"
            )

    targets = [
        root / rel_path
        for rel_path in FILES
    ]

    repo = git_root(root)

    branch = None
    old_head = None

    if repo is not None:
        branch = run(
            "git",
            "branch",
            "--show-current",
            cwd=repo,
        ).stdout.strip()

        old_head = run(
            "git",
            "rev-parse",
            "HEAD",
            cwd=repo,
        ).stdout.strip()

        log(
            f"git branch: "
            f"{branch or '(detached)'}"
        )

        log(
            f"git HEAD: "
            f"{old_head or '(unknown)'}"
        )

        if not branch:
            raise RuntimeError(
                "detached HEAD"
            )

        status = run(
            "git",
            "status",
            "--porcelain",
            "--",
            *[
                rel(
                    path,
                    repo,
                )
                for path in targets
            ],
            cwd=repo,
        ).stdout.strip()

        if status:
            print(status)

            raise RuntimeError(
                "System/3D target files have local changes. "
                "Commit/push them first; nothing was changed."
            )

    backup_dir = (
        root
        / ".patch-backups"
        / f"data-tunnel-page-v1-{STAMP}"
    )

    backup_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    for path in targets:
        if not path.exists():
            continue

        backup_name = (
            str(
                path.relative_to(
                    root
                )
            )
            .replace(
                "/",
                "__",
            )
        )

        shutil.copy2(
            path,
            backup_dir / backup_name,
        )

    log(
        f"backup: {backup_dir}"
    )

    try:
        for rel_path, content in FILES.items():
            path = root / rel_path

            path.parent.mkdir(
                parents=True,
                exist_ok=True,
            )

            path.write_text(
                content.strip()
                + "\n",
                encoding="utf-8",
            )

        # JavaScript syntax.
        for rel_path in (
            "memeflow-3d/layout.js",
            "memeflow-3d/materials.js",
            "memeflow-3d/modules.js",
            "memeflow-3d/routes.js",
            "memeflow-3d/scene.js",
            "memeflow-3d/embed.js",
        ):
            path = root / rel_path

            result = run(
                "node",
                "--check",
                str(path),
                check=False,
            )

            if result.returncode != 0:
                raise RuntimeError(
                    f"node --check failed: {path}"
                )

        html = (root / "system.html").read_text(encoding="utf-8")

        css = (root / "system.css").read_text(encoding="utf-8")

        scene = (root / "memeflow-3d" / "scene.js").read_text(encoding="utf-8")

        # All IDs known to be used by the existing system.js remain present.
        required_ids = [
            "wsDot",
            "wsStatus",
            "rpcDot",
            "rpcStatus",
            "aiDot",
            "aiStatus",
            "autoRotateBtn",
            "resetViewBtn",
            "systemCanvas",
            "memeflowTrue3DHost",
            "inspector",
            "inspectorTitle",
            "metricGrid",
            "primaryReason",
            "gateList",
            "inspectorMint",
            "focusBtn",
            "eventCount",
            "tradeCount",
            "holderQueue",
            "activeUsers",
            "freshBacklog",
            "lastEvent",
            "lastSync",
            "tokenRail",
            "telemetryMode",
        ]

        for element_id in required_ids:
            if (
                f'id="{element_id}"'
                not in html
            ):
                raise RuntimeError(
                    f"required System DOM id missing: {element_id}"
                )

        checks = [
            (
                PATCH_ID,
                css,
            ),
            (
                PATCH_ID,
                scene,
            ),
            (
                "Data Tunnel Pipeline",
                html,
            ),
            (
                "new THREE.FogExp2",
                scene,
            ),
            (
                "addTunnelFloor",
                scene,
            ),
            (
                "addTunnelFrames",
                scene,
            ),
            (
                "addOverheadLabel",
                scene,
            ),
            (
                "memeflow:true3d-select",
                scene,
            ),
        ]

        for needle, haystack in checks:
            if needle not in haystack:
                raise RuntimeError(
                    f"validation failed: {needle}"
                )

        # Since system.css is replaced wholesale, no prior ownership stacks survive.
        old_markers = [
            "MEMEFLOW_TRUE_3D_CLEAN_V3",
            "MEMEFLOW_RENDER_MATCH_V6",
            "MEMEFLOW_3D_VIEWPORT_FREE_ORBIT_FIT_V4",
            "MEMEFLOW_REALTIME_ARCHITECTURE_COMPACT_V2",
        ]

        for marker in old_markers:
            if marker in css:
                raise RuntimeError(
                    f"old CSS ownership marker survived: {marker}"
                )

        if repo is not None:
            run(
                "git",
                "diff",
                "--check",
                "--",
                *[
                    rel(
                        path,
                        repo,
                    )
                    for path in targets
                ],
                cwd=repo,
            )

        log(
            "VALIDATION PASS"
        )

        log(
            "FULL SYSTEM PAGE rebuilt in one visual language"
        )

        log(
            "system.css replaced wholesale: no stacked legacy CSS patches"
        )

        log(
            "Data Tunnel 3D scene installed: upright hardware corridor"
        )

        log(
            "Blue -> violet -> green live data path installed"
        )

        log(
            "Overhead Risk / Market / Holder / OpenAI / Decision labels installed"
        )

        log(
            "Glossy floor rails + tunnel frames + moving packets installed"
        )

        log(
            "Telemetry / Live Inspector / Token Flow redesigned to match"
        )

        log(
            "Existing system.js IDs preserved"
        )

        log(
            "Orbit / pinch / Reset View / node selection preserved"
        )

        log(
            "system.js / server / AI / evaluator / trading logic untouched"
        )

    except Exception:
        log(
            "Validation failed; restoring exact backup."
        )

        for path in targets:
            backup_name = (
                str(
                    path.relative_to(
                        root
                    )
                )
                .replace(
                    "/",
                    "__",
                )
            )

            backup = backup_dir / backup_name

            if backup.exists():
                path.parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )

                shutil.copy2(
                    backup,
                    path,
                )

        log(
            "ROLLBACK COMPLETE"
        )

        raise

    if args.push:
        if (
            repo is None
            or not branch
        ):
            log(
                "--push requested but git worktree is unavailable."
            )

            return 0

        rel_targets = [
            rel(
                path,
                repo,
            )
            for path in targets
        ]

        run(
            "git",
            "add",
            "--",
            *rel_targets,
            cwd=repo,
        )

        run(
            "git",
            "diff",
            "--cached",
            "--check",
            cwd=repo,
        )

        staged = run(
            "git",
            "diff",
            "--cached",
            "--quiet",
            cwd=repo,
            check=False,
        )

        if staged.returncode == 0:
            log(
                "No staged changes; nothing to commit."
            )

            return 0

        commit = run(
            "git",
            "commit",
            "-m",
            "Build MEMEFLOW Data Tunnel system page",
            cwd=repo,
            check=False,
        )

        if commit.returncode != 0:
            log(
                "WARNING: page installed but commit failed."
            )

            return 0

        push = run(
            "git",
            "push",
            "-u",
            "origin",
            branch,
            cwd=repo,
            check=False,
        )

        if push.returncode != 0:
            log(
                "WARNING: commit created but push failed."
            )

            return 0

        new_head = run(
            "git",
            "rev-parse",
            "HEAD",
            cwd=repo,
        ).stdout.strip()

        log(
            "COMMIT + PUSH COMPLETE"
        )

        log(
            f"branch: {branch}"
        )

        log(
            f"previous HEAD: {old_head}"
        )

        log(
            f"new HEAD: {new_head}"
        )

    else:
        log(
            "Patch applied locally. "
            "Re-run with --push to commit + push."
        )

    log(
        "DONE"
    )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(
            main()
        )

    except Exception as exc:
        print(
            f"[DATA-TUNNEL-PAGE-V1] ERROR: {exc}",
            file=sys.stderr,
        )

        raise SystemExit(1)
