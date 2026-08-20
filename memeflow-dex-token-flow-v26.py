#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

PATCH_ID = "MEMEFLOW_DEX_TOKEN_FLOW_V26"
STAMP = time.strftime("%Y%m%d-%H%M%S")


def log(msg):
    print(f"[DEX-FLOW-V26] {msg}", flush=True)


def find_root():
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
    ]
    for p in candidates:
        try:
            p = p.resolve()
        except Exception:
            continue
        if all((p / name).is_file() for name in (
            "app-server.mjs", "system-tokens.js", "system-tokens.css", "system-tokens.html"
        )):
            return p
    raise RuntimeError("MEMEFLOW project root not found")


ROOT = find_root()
FILES = [
    ROOT / "app-server.mjs",
    ROOT / "system-tokens.js",
    ROOT / "system-tokens.css",
    ROOT / "system-tokens.html",
]
BACK = ROOT / f".dex-flow-v26-backup-{STAMP}"
BACK.mkdir(parents=True, exist_ok=True)


def rollback(reason):
    log(f"ERROR: {reason}")
    for f in FILES:
        src = BACK / f.name
        if src.exists():
            shutil.copy2(src, f)
            log(f"restored {f.name}")
    log("ROLLBACK COMPLETE")
    sys.exit(1)


def node_check(path):
    r = subprocess.run(
        ["node", "--check", str(path)], cwd=ROOT,
        capture_output=True, text=True
    )
    if r.returncode:
        raise RuntimeError(f"{path.name} syntax error: {(r.stderr or r.stdout).strip()}")


try:
    log(f"root: {ROOT}")
    for f in FILES:
        shutil.copy2(f, BACK / f.name)

    server = (ROOT / "app-server.mjs").read_text(encoding="utf-8")
    js = (ROOT / "system-tokens.js").read_text(encoding="utf-8")
    css = (ROOT / "system-tokens.css").read_text(encoding="utf-8")
    html = (ROOT / "system-tokens.html").read_text(encoding="utf-8")

    if PATCH_ID in server or PATCH_ID in js:
        log("already installed")
        sys.exit(0)

    route_anchor = "if(url.pathname==='/api/debug/filter-pipeline-lifecycle'){"
    route_start = server.find(route_anchor)
    if route_start < 0:
        raise RuntimeError("filter-pipeline-lifecycle route not found")

    old_filter = re.compile(
        r"    const allTokens=Object\.values\(store\?\.state\?\.tokens\|\|\{\}\);\n"
        r"    const pumpTokens=allTokens\n"
        r"      \.filter\(t=>\{\n"
        r"        const lp=String\(t\?\.launchPlatform\|\|t\?\.protocol\|\|''\)\.toLowerCase\(\);\n"
        r"        const mint=String\(t\?\.mint\|\|t\?\.tokenMint\|\|t\?\.tokenAddress\|\|''\);\n"
        r"        return lp==='pump'\|\|mint\.toLowerCase\(\)\.endsWith\('pump'\);\n"
        r"      \}\)\n"
        r"      \.sort\(\(a,b\)=>Number\(b\?\.discoveredAt\|\|b\?\.createdAt\|\|0\)-Number\(a\?\.discoveredAt\|\|a\?\.createdAt\|\|0\)\)\n"
        r"      \.slice\(0,limit\);"
    )
    m = old_filter.search(server, route_start)
    if not m:
        raise RuntimeError("Pump-only lifecycle filter not found; refusing blind patch")

    new_filter = '''    const allTokens=Object.values(store?.state?.tokens||{});
    const activeSource=String(__discoverySource?.mode||'dex').toLowerCase();

    const isPumpToken=t=>{
      const launch=String(t?.launchPlatform||'').toLowerCase();
      const protocol=String(t?.protocol||'').toLowerCase();
      const source=String(t?.source||'').toLowerCase();
      const mint=String(t?.mint||t?.tokenMint||t?.tokenAddress||'').toLowerCase();
      return launch==='pump'||protocol==='pump'||source.includes('pump create')||mint.endsWith('pump');
    };

    const isDexToken=t=>{
      const launch=String(t?.launchPlatform||'').toLowerCase();
      const source=String(t?.source||'').toLowerCase();
      return launch==='dex'||source.includes('dex pool')||Boolean(t?.dexUrl||t?.dexPairAddress||t?.dexId);
    };

    const pumpTokens=allTokens.filter(isPumpToken);
    const dexTokens=allTokens.filter(isDexToken);

    const visibleTokens=allTokens
      .filter(t=>{
        if(activeSource==='pump')return isPumpToken(t);
        if(activeSource==='dex')return isDexToken(t);
        if(activeSource==='hybrid')return isPumpToken(t)||isDexToken(t);
        return true;
      })
      .sort((a,b)=>Number(b?.discoveredAt||b?.createdAt||0)-Number(a?.discoveredAt||a?.createdAt||0))
      .slice(0,limit);'''
    server = server[:m.start()] + new_filter + server[m.end():]

    tail = server[route_start:]
    old_sample = "const sample=pumpTokens.map(token=>{"
    rel = tail.find(old_sample)
    if rel < 0:
        raise RuntimeError("Pump-only sample mapping not found")
    pos = route_start + rel
    server = server[:pos] + "const sample=visibleTokens.map(token=>{" + server[pos+len(old_sample):]

    old_return = '''      return {
        mint,
        name:token?.name??token?.metadataName??null,'''
    new_return = '''      return {
        mint,
        launchPlatform:token?.launchPlatform??null,
        protocol:token?.protocol??null,
        source:token?.source??null,
        dexUrl:token?.dexUrl??null,
        dexPairAddress:token?.dexPairAddress??null,
        dexId:token?.dexId??null,
        pumpUrl:isPumpToken(token)?`https://pump.fun/coin/${encodeURIComponent(mint)}`:null,
        name:token?.name??token?.metadataName??null,'''
    pos = server.find(old_return, route_start)
    if pos < 0:
        raise RuntimeError("lifecycle sample return anchor not found")
    server = server[:pos] + new_return + server[pos+len(old_return):]

    old_count = '''        pumpTokensInThisInstance:pumpTokens.length,
        returned:sample.length'''
    new_count = '''        pumpTokensInThisInstance:pumpTokens.length,
        dexTokensInThisInstance:dexTokens.length,
        activeDiscoverySource:activeSource,
        returned:sample.length'''
    pos = server.find(old_count, route_start)
    if pos < 0:
        raise RuntimeError("lifecycle count anchor not found")
    server = server[:pos] + new_count + server[pos+len(old_count):]

    helper_anchor = "function tokenTemplate(row, index) {"
    if helper_anchor not in js:
        raise RuntimeError("tokenTemplate anchor not found")

    helpers = r'''
function safeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.href;
  } catch {
    return '';
  }
}

function tokenExternalLinks(row) {
  const mint = String(row?.mint || '').trim();
  const dex = safeExternalUrl(row?.dexUrl ?? row?.market?.dexUrl);
  let pump = safeExternalUrl(row?.pumpUrl);

  if (!pump && mint) {
    const launch = String(row?.launchPlatform || '').toLowerCase();
    const source = String(row?.source || '').toLowerCase();
    const isPump = launch === 'pump' || source.includes('pump create') || mint.toLowerCase().endsWith('pump');
    if (isPump) pump = `https://pump.fun/coin/${encodeURIComponent(mint)}`;
  }
  return { dex, pump };
}

function tokenSourceLinksTemplate(row) {
  const links = tokenExternalLinks(row);
  const out = [];

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

  if (links.pump) {
    out.push(`
      <a class="token-source-link pump" href="${escapeHtml(links.pump)}" target="_blank"
         rel="noopener noreferrer" aria-label="Open on Pump.fun" title="Pump.fun">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 16V8h7.2a3.8 3.8 0 010 7.6H9.7"></path>
          <path d="M16.8 8.7H20v3.2"></path>
          <path d="M19.7 9l-3.8 3.8"></path>
        </svg>
      </a>`);
  }

  return out.length ? `<span class="token-source-links">${out.join('')}</span>` : '';
}

'''
    js = js.replace(helper_anchor, helpers + helper_anchor, 1)

    arrow = re.compile(
        r'''\n\s*<a\n\s*class="token-pump-link"\n\s*href="https://pump\.fun/coin/\$\{encodeURIComponent\(row\?\.mint \|\| ''\)\}"\n\s*target="_blank"\n\s*rel="noopener noreferrer"\n\s*aria-label="Open token on Pump\.fun"\n\s*>↗</a>\n''',
        re.S,
    )
    js, n = arrow.subn("\n              ${tokenSourceLinksTemplate(row)}\n", js, count=1)
    if n != 1:
        raise RuntimeError(f"generic arrow anchor count={n}; refusing blind replacement")

    status_helper = r'''
async function loadDiscoveryStatus() {
  const label = document.getElementById('discoveryLiveLabel');
  if (!label) return;
  try {
    const response = await fetch('/api/discovery-source', {cache:'no-store',credentials:'same-origin'});
    if (!response.ok) return;
    const payload = await response.json();
    const mode = String(payload?.source?.mode || 'unknown').toUpperCase();
    const dex = payload?.dex?.metrics || payload?.dex || {};
    const pump = payload?.pump || {};

    let connected = false;
    if (mode === 'DEX') connected = Boolean(payload?.dex?.connected ?? dex?.connected);
    else if (mode === 'PUMP') connected = Boolean(pump?.connected);
    else if (mode === 'HYBRID') connected = Boolean(pump?.connected || payload?.dex?.connected || dex?.connected);

    label.textContent = `${mode} ${connected ? 'LIVE' : 'IDLE'}`;

    const confirmed = Number(dex?.pairsConfirmed ?? dex?.discovered);
    const rejected = Number(dex?.pairsRejected);
    const pending = Number(dex?.pendingConfirms ?? dex?.pending);
    const info = [];
    if (Number.isFinite(confirmed)) info.push(`confirmed ${confirmed}`);
    if (Number.isFinite(rejected)) info.push(`rejected ${rejected}`);
    if (Number.isFinite(pending)) info.push(`pending ${pending}`);
    if ((mode === 'DEX' || mode === 'HYBRID') && info.length) {
      label.title = `DEX scanner | ${info.join(' | ')}`;
    }
  } catch {}
}

'''
    load_anchor = "async function loadTokens() {"
    if load_anchor not in js:
        raise RuntimeError("loadTokens anchor not found")
    js = js.replace(load_anchor, status_helper + load_anchor, 1)

    load_body = '''async function loadTokens() {
  if (state.loading) {'''
    if load_body not in js:
        raise RuntimeError("loadTokens body anchor not found")
    js = js.replace(load_body, '''async function loadTokens() {
  void loadDiscoveryStatus();

  if (state.loading) {''', 1)

    old_live = '''      <div class="live-status">
        <i></i>
        <span>LIVE</span>
      </div>'''
    new_live = '''      <div class="live-status">
        <i></i>
        <span id="discoveryLiveLabel">LIVE</span>
      </div>'''
    if old_live not in html:
        raise RuntimeError("LIVE status HTML anchor not found")
    html = html.replace(old_live, new_live, 1)
    html = html.replace("/system-tokens.css?v=media-v25", "/system-tokens.css?v=dex-flow-v26")
    html = html.replace("/system-tokens.js?v=media-v25", "/system-tokens.js?v=dex-flow-v26")

    css += r'''

/* ===== MEMEFLOW DEX TOKEN FLOW V26 ===== */
.token-source-links{flex:none;display:inline-flex;align-items:center;gap:4px}
.token-source-link{width:23px;height:23px;min-width:23px;display:inline-grid;place-items:center;border:1px solid rgba(117,156,176,.24);border-radius:6px;background:rgba(5,13,18,.76);color:#8da6b3;text-decoration:none;-webkit-tap-highlight-color:transparent;transition:border-color .14s ease,background .14s ease,color .14s ease,transform .10s ease}
.token-source-link svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.token-source-link.dex{color:#62dff5;border-color:rgba(98,223,245,.28);background:rgba(98,223,245,.045)}
.token-source-link.pump{color:#57e4a8;border-color:rgba(87,228,168,.27);background:rgba(87,228,168,.045)}
.token-source-link:visited{color:inherit}.token-source-link:active{transform:scale(.94)}
@media(hover:hover){.token-source-link:hover{border-color:currentColor;background:rgba(255,255,255,.055)}}
@media(max-width:760px){.token-source-links{gap:3px}.token-source-link{width:21px;height:21px;min-width:21px;border-radius:6px}.token-source-link svg{width:12px;height:12px}}
'''

    server = server.rstrip() + f"\n\n// {PATCH_ID}\n"
    js = js.rstrip() + f"\n\n// {PATCH_ID}\n"

    (ROOT / "app-server.mjs").write_text(server, encoding="utf-8")
    (ROOT / "system-tokens.js").write_text(js, encoding="utf-8")
    (ROOT / "system-tokens.css").write_text(css, encoding="utf-8")
    (ROOT / "system-tokens.html").write_text(html, encoding="utf-8")

    node_check(ROOT / "app-server.mjs")
    node_check(ROOT / "system-tokens.js")

    checks = {
        "source-aware server list": "const visibleTokens=allTokens" in server,
        "DEX url exposed": "dexUrl:token?.dexUrl??null" in server,
        "conditional Pump url": "pumpUrl:isPumpToken(token)" in server,
        "DexScreener icon": 'class="token-source-link dex"' in js,
        "Pump icon": 'class="token-source-link pump"' in js,
        "old arrow removed": ">↗</a>" not in js,
        "source status label": 'id="discoveryLiveLabel"' in html,
        "cache bust": "dex-flow-v26" in html,
    }
    failed = [k for k, v in checks.items() if not v]
    if failed:
        raise RuntimeError("validation failed: " + ", ".join(failed))

    log("app-server.mjs syntax OK")
    log("system-tokens.js syntax OK")
    log("INSTALL COMPLETE")
    log("Live token states now follows actual PUMP / DEX / HYBRID mode")
    log("DexScreener icon appears only when a real dexUrl exists")
    log("Pump.fun icon appears only for Pump-origin tokens")
    log("generic arrow removed")
    log("header now reports DEX LIVE / PUMP LIVE / HYBRID LIVE")
    log(f"backup: {BACK}")

    # Non-fatal check of the process that is currently running before restart.
    ports = ([os.environ["PORT"]] if os.environ.get("PORT") else []) + ["3000", "5000", "8080"]
    for port in dict.fromkeys(ports):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/discovery-source", timeout=.8) as r:
                payload = json.loads(r.read().decode("utf-8"))
            source = payload.get("source") or {}
            dex = payload.get("dex") or {}
            metrics = dex.get("metrics") if isinstance(dex, dict) else None
            if not isinstance(metrics, dict):
                metrics = dex if isinstance(dex, dict) else {}
            log(
                "CURRENT PROCESS: "
                f"mode={source.get('mode')} "
                f"dexConnected={dex.get('connected', metrics.get('connected'))} "
                f"notifications={metrics.get('notifications')} "
                f"createSignals={metrics.get('createSignals')} "
                f"pairsConfirmed={metrics.get('pairsConfirmed')} "
                f"pairsRejected={metrics.get('pairsRejected')} "
                f"pending={metrics.get('pendingConfirms')} "
                f"lastError={metrics.get('lastError')}"
            )
            break
        except Exception:
            pass

    log("Restart the Replit app/workflow, then reload Live token states.")

except Exception as exc:
    rollback(exc)
