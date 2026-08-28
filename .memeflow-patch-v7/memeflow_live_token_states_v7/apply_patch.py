#!/usr/bin/env python3
from pathlib import Path
import sys, shutil, subprocess, datetime, re

PATCH_ID = "MEMEFLOW_LIVE_TOKEN_STATES_V7"

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
        if all((p / name).is_file() for name in ("app-server.mjs", "system-tokens.js", "system-tokens.html")):
            return p
    for base in [Path.cwd(), Path("/home/runner/workspace")]:
        if not base.exists():
            continue
        try:
            for p in base.glob("**/system-tokens.js"):
                root = p.parent
                if ".patch-backups" in root.parts or any(part.startswith(".memeflow-") for part in root.parts):
                    continue
                if all((root / name).is_file() for name in ("app-server.mjs", "system-tokens.js", "system-tokens.html")):
                    return root.resolve()
        except Exception:
            pass
    raise RuntimeError("MEMEFLOW app root not found")

def node_check(path, cwd):
    result = subprocess.run(
        ["node", "--check", str(path)],
        cwd=cwd,
        capture_output=True,
        text=True
    )
    if result.returncode:
        raise RuntimeError(
            f"{path.name} syntax error:\n{(result.stderr or result.stdout).strip()}"
        )

def clean_generated_block(text):
    # Normalize ONLY installer-generated blocks. Prevents trailing whitespace
    # from failing git diff --check without rewriting unrelated project code.
    return "\n".join(line.rstrip() for line in text.splitlines()).strip("\n") + "\n"

def find_function_span(text, name):
    # Locate the function by its declaration, then balance braces while ignoring
    # quoted strings, template literals and comments. No dependency on its old URL.
    pattern = re.compile(
        rf"\basync\s+function\s+{re.escape(name)}\s*\([^)]*\)\s*\{{"
    )
    match = pattern.search(text)
    if not match:
        raise RuntimeError(f"{name}() function not found")

    brace = text.find("{", match.start(), match.end())
    if brace < 0:
        raise RuntimeError(f"{name}() opening brace not found")

    depth = 0
    state = "normal"
    escaped = False
    i = brace

    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if state == "normal":
            if ch == "'":
                state = "single"
            elif ch == '"':
                state = "double"
            elif ch == "`":
                state = "template"
            elif ch == "/" and nxt == "/":
                state = "line_comment"
                i += 1
            elif ch == "/" and nxt == "*":
                state = "block_comment"
                i += 1
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return match.start(), i + 1

        elif state in ("single", "double", "template"):
            quote = {"single": "'", "double": '"', "template": "`"}[state]
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                state = "normal"

        elif state == "line_comment":
            if ch == "\n":
                state = "normal"

        elif state == "block_comment":
            if ch == "*" and nxt == "/":
                state = "normal"
                i += 1

        i += 1

    raise RuntimeError(f"{name}() closing brace not found")

def find_decisions_route(text):
    patterns = [
        re.compile(r"\bif\s*\(\s*url\.pathname\s*===\s*['\"]/api/ai/decisions['\"]\s*\)\s*\{"),
        re.compile(r"\bif\s*\(\s*url\.pathname\s*==\s*['\"]/api/ai/decisions['\"]\s*\)\s*\{"),
    ]
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            return match.start()
    raise RuntimeError("app-server.mjs: /api/ai/decisions route not found")

ROOT = find_root()
SERVER = ROOT / "app-server.mjs"
JS = ROOT / "system-tokens.js"
HTML = ROOT / "system-tokens.html"

stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = ROOT / f".memeflow-live-token-states-v7-backup-{stamp}"
BACKUP.mkdir(parents=True, exist_ok=True)
MODIFIED = []

def backup(path):
    if path in MODIFIED:
        return
    shutil.copy2(path, BACKUP / path.name)
    MODIFIED.append(path)

def write(path, text):
    backup(path)
    path.write_text(text, encoding="utf-8")
    log(f"patched: {path}")

def rollback(reason):
    log(f"ERROR: {reason}")
    for path in MODIFIED:
        source = BACKUP / path.name
        if source.exists():
            shutil.copy2(source, path)
            log(f"restored: {path.name}")
    log("ROLLBACK COMPLETE")
    sys.exit(1)

try:
    log(f"app root: {ROOT}")

    node_check(SERVER, ROOT)
    node_check(JS, ROOT)
    log("baseline syntax OK")

    # ------------------------------------------------------------------
    # Backend: dedicated read-only source for the Live Token States page.
    # ------------------------------------------------------------------
    server = SERVER.read_text(encoding="utf-8")

    if "/api/system/live-token-states" not in server:
        pos = find_decisions_route(server)

        route = clean_generated_block(r"""
 // MEMEFLOW_LIVE_TOKEN_STATES_V7
 if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){
  const _lim=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||200)));
  const _tokens=store.tokens().slice(0,_lim);
  const _settings=store.settings(u.id);
  let _recovered=0,_reindexed=0,_evalErrors=0,_viewErrors=0;
  let _index=store._uidDec[u.id]||null;

  for(const _token of _tokens){
    const _mint=String(_token?.mint||'').trim();
    if(!_mint)continue;

    const _key=u.id+':'+_mint;
    const _existing=store.state.decisions?.[_key]||null;

    if(_existing){
      if(!_index?.has(_key)){
        try{
          store.setDecision(u.id,_mint,_existing);
          _index=store._uidDec[u.id]||_index;
          _reindexed++;
        }catch(_error){
          _evalErrors++;
        }
      }
      continue;
    }

    try{
      const _decision=evaluate(_token,_settings);
      store.setDecision(u.id,_mint,{..._decision,primaryReason:_decision.primaryReason});
      _index=store._uidDec[u.id]||_index;
      _recovered++;
    }catch(_error){
      _evalErrors++;
    }
  }

  const _mintSet=new Set(_tokens.map(_token=>String(_token?.mint||'')).filter(Boolean));
  const _all=store.decisions(u.id).filter(_decision=>_mintSet.has(String(_decision?.mint||'')));
  const _selected=candidateFeed(_all,'all');
  const _counts=candidateVisibilityCounts(_all);
  const _stateCounts={};

  for(const _decision of _selected){
    const _state=String(_decision?.state||'WAITING').trim().toUpperCase()||'WAITING';
    _stateCounts[_state]=(_stateCounts[_state]||0)+1;
  }

  const _views=[];
  for(const _decision of _selected.slice(0,_lim)){
    try{
      _views.push(candidateView(_decision));
    }catch(_error){
      _viewErrors++;
    }
  }

  return json(res,200,{
    decisions:_views,
    total:_views.length,
    limit:_lim,
    source:'system-live-token-states-v7',
    persistedTokens:_tokens.length,
    recovered:_recovered,
    reindexed:_reindexed,
    evaluationErrors:_evalErrors,
    viewErrors:_viewErrors,
    stateCounts:_stateCounts,
    counts:_counts
  });
 }
""")
        server = server[:pos] + route + server[pos:]
        write(SERVER, server)
    else:
        log("backend Live Token States route already present")

    # -------------------------------------------------------------
    # Frontend: replace loadTokens() structurally, not by old URL.
    # -------------------------------------------------------------
    js = JS.read_text(encoding="utf-8")
    start, end = find_function_span(js, "loadTokens")

    new_load_tokens = clean_generated_block(r"""async function loadTokens() {
  if (typeof loadDiscoveryStatus === 'function') {
    void loadDiscoveryStatus();
  }

  if (state.loading) {
    return;
  }

  state.loading = true;

  try {
    const response = await fetch(
      '/api/system/live-token-states?limit=200&_=' + Date.now(),
      {
        cache: 'no-store',
        credentials: 'same-origin'
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.decisions)
      ? payload.decisions
      : [];

    state.rows = rows
      .map(canonicalDecisionRow)
      .filter(row => row?.mint);

    const persisted = Number(payload?.persistedTokens);
    const recovered = Number(payload?.recovered);
    const reindexed = Number(payload?.reindexed);
    const evalErrors = Number(payload?.evaluationErrors);
    const viewErrors = Number(payload?.viewErrors);

    const parts = [
      `Updated ${new Date().toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }
      )}`
    ];

    if (Number.isFinite(persisted)) {
      parts.push(`${state.rows.length}/${persisted} visible`);
    }

    if (Number.isFinite(recovered) && recovered > 0) {
      parts.push(`recovered ${recovered}`);
    }

    if (Number.isFinite(reindexed) && reindexed > 0) {
      parts.push(`reindexed ${reindexed}`);
    }

    if (
      (Number.isFinite(evalErrors) && evalErrors > 0) ||
      (Number.isFinite(viewErrors) && viewErrors > 0)
    ) {
      parts.push(`errors ${Math.max(0, evalErrors || 0) + Math.max(0, viewErrors || 0)}`);
    }

    $('lastUpdate').textContent = parts.join(' · ');
    render();
  } catch (error) {
    console.error('[MEMEFLOW TOKEN FLOW]', error);
    $('lastUpdate').textContent = 'Decision feed unavailable';
  } finally {
    state.loading = false;
  }
}""")

    js = js[:start] + new_load_tokens.rstrip("\n") + js[end:]
    if PATCH_ID not in js:
        js = js.rstrip() + f"\n\n// {PATCH_ID}\n"
    write(JS, js)

    # ----------------------
    # Safari cache busting.
    # ----------------------
    html = HTML.read_text(encoding="utf-8")
    html2, replacements = re.subn(
        r'(/system-tokens\.js)(?:\?[^"]*)?(")',
        r'\1?v=live-token-states-v7\2',
        html,
        count=1
    )
    if replacements != 1:
        raise RuntimeError("system-tokens.html: system-tokens.js script tag not found")
    write(HTML, html2)

    # ----------------------
    # Strong validation.
    # ----------------------
    node_check(SERVER, ROOT)
    node_check(JS, ROOT)
    log("patched syntax OK")

    server_now = SERVER.read_text(encoding="utf-8")
    js_now = JS.read_text(encoding="utf-8")
    html_now = HTML.read_text(encoding="utf-8")

    checks = [
        (server_now, "/api/system/live-token-states", "backend endpoint"),
        (server_now, "source:'system-live-token-states-v7'", "backend source marker"),
        (server_now, "candidateFeed(_all,'all')", "all states"),
        (server_now, "const _decision=evaluate(_token,_settings);", "canonical evaluator"),
        (js_now, "/api/system/live-token-states?limit=200", "frontend endpoint"),
        (js_now, "async function loadTokens()", "loadTokens replacement"),
        (html_now, "live-token-states-v7", "Safari cache bust"),
    ]
    for text, marker, label in checks:
        if marker not in text:
            raise RuntimeError(f"validation missing {label}: {marker}")

    if "/api/ai/decisions?scope=" in js_now[start:start + len(new_load_tokens) + 300]:
        raise RuntimeError("old decisions endpoint still present inside loadTokens()")

    log("Live Token States contract OK")

    repo = ROOT.parent if (ROOT.parent / ".git").exists() else ROOT
    if (repo / ".git").exists():
        rels = [str(path.relative_to(repo)) for path in (SERVER, JS, HTML)]
        result = subprocess.run(
            ["git", "diff", "--check", "--", *rels],
            cwd=repo,
            capture_output=True,
            text=True
        )
        if result.returncode:
            raise RuntimeError("git diff --check failed:\n" + (result.stdout or result.stderr))
        log("git diff --check OK")

    log("SUCCESS")
    log("Live Token States now uses persisted token state + canonical evaluate().")
    log("No trading thresholds, settings, BUY/SELL rules or execution logic were changed.")
    log(f"Backup kept at: {BACKUP}")

except Exception as exc:
    rollback(exc)
