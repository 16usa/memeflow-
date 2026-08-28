#!/usr/bin/env python3
from pathlib import Path
import sys, shutil, subprocess, datetime, re

PATCH_ID = "MEMEFLOW_LIVE_TOKEN_STATES_V5"

def log(msg):
    print(f"[PATCH] {msg}", flush=True)

def find_root():
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace"),
        Path("/home/runner/workspace/memeflow-app"),
        Path("/workspace"),
        Path("/workspace/memeflow-app"),
    ]
    for p in candidates:
        try:
            p = p.resolve()
        except Exception:
            continue
        if (p / "app-server.mjs").is_file() and (p / "system-tokens.js").is_file() and (p / "system-tokens.html").is_file():
            return p
    for base in [Path.cwd(), Path("/home/runner/workspace")]:
        if not base.exists():
            continue
        try:
            for p in base.glob("**/system-tokens.js"):
                root = p.parent
                if (root / "app-server.mjs").is_file() and (root / "system-tokens.html").is_file():
                    return root.resolve()
        except Exception:
            pass
    raise RuntimeError("MEMEFLOW app root not found")

ROOT = find_root()
SERVER = ROOT / "app-server.mjs"
JS = ROOT / "system-tokens.js"
HTML = ROOT / "system-tokens.html"

stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = ROOT / f".memeflow-live-token-states-v5-backup-{stamp}"
BACKUP.mkdir(parents=True, exist_ok=True)
MODIFIED = []

def backup(p):
    if p in MODIFIED:
        return
    dest = BACKUP / p.name
    shutil.copy2(p, dest)
    MODIFIED.append(p)

def write(p, text):
    backup(p)
    p.write_text(text, encoding="utf-8")
    log(f"patched: {p}")

def rollback(reason):
    log(f"ERROR: {reason}")
    for p in MODIFIED:
        src = BACKUP / p.name
        if src.exists():
            shutil.copy2(src, p)
            log(f"restored: {p.name}")
    log("ROLLBACK COMPLETE")
    sys.exit(1)

try:
    log(f"app root: {ROOT}")

    for p in [SERVER, JS]:
        r = subprocess.run(["node", "--check", str(p)], cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError(f"baseline syntax failed for {p.name}: {(r.stderr or r.stdout).strip()}")
    log("baseline syntax OK")

    server = SERVER.read_text(encoding="utf-8")
    js = JS.read_text(encoding="utf-8")
    html = HTML.read_text(encoding="utf-8")

    if PATCH_ID not in server:
        route_anchor = " if(url.pathname==='/api/ai/decisions'){"
        pos = server.find(route_anchor)
        if pos < 0:
            route_anchor = "if(url.pathname==='/api/ai/decisions'){"
            pos = server.find(route_anchor)
        if pos < 0:
            raise RuntimeError("app-server.mjs: /api/ai/decisions route anchor not found")

        route = r"""
 // MEMEFLOW_LIVE_TOKEN_STATES_V5
 if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){
  const _lim=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||200)));
  const _tokens=store.tokens().slice(0,_lim);
  const _settings=store.settings(u.id);
  let _recovered=0,_evalErrors=0;

  for(const _token of _tokens){
    if(!_token?.mint)continue;
    const _key=u.id+':'+_token.mint;
    if(store.state.decisions?.[_key])continue;
    try{
      const _d=evaluate(_token,_settings);
      store.setDecision(u.id,_token.mint,{..._d,primaryReason:_d.primaryReason});
      _recovered++;
    }catch(_error){
      _evalErrors++;
    }
  }

  const _all=store.decisions(u.id);
  const _selected=candidateFeed(_all,'all');
  const _counts=candidateVisibilityCounts(_all);

  return json(res,200,{
    decisions:_selected.slice(0,_lim).map(candidateView),
    total:_selected.length,
    limit:_lim,
    source:'system-live-token-states',
    persistedTokens:_tokens.length,
    recovered:_recovered,
    evaluationErrors:_evalErrors,
    counts:_counts
  });
 }
"""
        server = server[:pos] + route + server[pos:]
        write(SERVER, server)
    else:
        log("backend route already installed")

    js = JS.read_text(encoding="utf-8")
    new_endpoint = "'/api/system/live-token-states?limit=200&_=' + Date.now()"

    if new_endpoint not in js:
        candidates = [
            "'/api/ai/decisions?scope=all&limit=200'",
            "'/api/ai/decisions?scope=candidates&limit=200'",
            '"/api/ai/decisions?scope=all&limit=200"',
            '"/api/ai/decisions?scope=candidates&limit=200"',
        ]
        replaced = False
        for old in candidates:
            if old in js:
                js = js.replace(old, new_endpoint, 1)
                replaced = True
                break
        if not replaced:
            raise RuntimeError("system-tokens.js: decisions fetch anchor not found")

    load_anchor = "async function loadTokens() {\n  if (state.loading) {"
    load_with_status = "async function loadTokens() {\n  void loadDiscoveryStatus();\n\n  if (state.loading) {"
    if "async function loadTokens() {\n  void loadDiscoveryStatus();" not in js:
        if load_anchor not in js:
            raise RuntimeError("system-tokens.js: loadTokens anchor not found")
        js = js.replace(load_anchor, load_with_status, 1)

    if PATCH_ID not in js:
        js = js.rstrip() + f"\n\n// {PATCH_ID}\n"

    write(JS, js)

    html = HTML.read_text(encoding="utf-8")
    html2 = re.sub(
        r'(/system-tokens\.js)\?[^"]+',
        r'\1?v=live-token-states-v5',
        html,
        count=1
    )
    if html2 == html and "live-token-states-v5" not in html:
        if '/system-tokens.js"' in html:
            html2 = html.replace('/system-tokens.js"', '/system-tokens.js?v=live-token-states-v5"', 1)
        else:
            raise RuntimeError("system-tokens.html: script src not found")

    if "live-token-states-v5" not in html2:
        raise RuntimeError("system-tokens.html: cache bust failed")

    write(HTML, html2)

    for p in [SERVER, JS]:
        r = subprocess.run(["node", "--check", str(p)], cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError(f"patched syntax failed for {p.name}: {(r.stderr or r.stdout).strip()}")
    log("patched syntax OK")

    server_now = SERVER.read_text(encoding="utf-8")
    js_now = JS.read_text(encoding="utf-8")
    html_now = HTML.read_text(encoding="utf-8")

    required = [
        (server_now, "/api/system/live-token-states", "backend endpoint"),
        (server_now, "source:'system-live-token-states'", "backend payload source"),
        (server_now, "candidateFeed(_all,'all')", "all-state feed"),
        (js_now, "/api/system/live-token-states?limit=200", "frontend endpoint"),
        (js_now, "void loadDiscoveryStatus();", "discovery status"),
        (html_now, "live-token-states-v5", "cache bust"),
    ]
    for text, marker, label in required:
        if marker not in text:
            raise RuntimeError(f"validation missing {label}: {marker}")
    log("Live Token States contract OK")

    repo = ROOT.parent if (ROOT.parent / ".git").exists() else ROOT
    if (repo / ".git").exists():
        rels = [str(p.relative_to(repo)) for p in [SERVER, JS, HTML]]
        r = subprocess.run(["git", "diff", "--check", "--", *rels], cwd=repo, capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError("git diff --check failed:\n" + (r.stdout or r.stderr))
        log("git diff --check OK")

    log("SUCCESS")
    log("Live Token States now reads /api/system/live-token-states")
    log("Missing per-user decisions are reconstructed from persisted tokens using canonical evaluate().")
    log("Trading evaluator, settings, BUY/SELL rules and execution behavior were NOT changed.")
    log(f"Backup kept at: {BACKUP}")

except Exception as exc:
    rollback(exc)
