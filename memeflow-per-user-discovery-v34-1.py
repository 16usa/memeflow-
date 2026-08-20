#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_PER_USER_DISCOVERY_V34_1"
STAMP = time.strftime("%Y%m%d-%H%M%S")


def log(msg: str) -> None:
    print(f"[DISCOVERY-V34.1] {msg}", flush=True)


def find_root() -> Path:
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
    ]
    required = [
        "app-server.mjs",
        "src/settings.mjs",
        "src/store.mjs",
        "src/liveeval.mjs",
        "src/recovery.mjs",
        "src/dex-verification-gate.mjs",
    ]
    for candidate in candidates:
        try:
            p = candidate.resolve()
        except Exception:
            continue
        if all((p / rel).is_file() for rel in required):
            return p
    raise RuntimeError("MEMEFLOW V33 project root not found")


ROOT = find_root()
APP = ROOT / "app-server.mjs"
SETTINGS = ROOT / "src/settings.mjs"
STORE = ROOT / "src/store.mjs"
LIVEEVAL = ROOT / "src/liveeval.mjs"
RECOVERY = ROOT / "src/recovery.mjs"
ELIGIBILITY = ROOT / "src/discovery-eligibility.mjs"

FILES = [APP, SETTINGS, STORE, LIVEEVAL, RECOVERY, ELIGIBILITY]
BACKUP = ROOT / f".per-user-discovery-v34-1-backup-{STAMP}"
BACKUP.mkdir(parents=True, exist_ok=True)

snapshots: dict[Path, tuple[bool, str | None]] = {}


def snapshot(path: Path) -> str:
    existed = path.exists()
    text = path.read_text(encoding="utf-8") if existed else None
    snapshots[path] = (existed, text)
    if existed:
        dst = BACKUP / path.relative_to(ROOT)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dst)
    return text or ""


def rollback(reason: object) -> None:
    log(f"ERROR: {reason}")
    for path, (existed, text) in snapshots.items():
        try:
            if existed:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text or "", encoding="utf-8")
            elif path.exists():
                path.unlink()
        except Exception as exc:
            log(f"rollback warning for {path}: {exc}")
    log("ROLLBACK COMPLETE")
    sys.exit(1)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 anchor, found {count}")
    return text.replace(old, new, 1)


def replace_n(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{label}: expected {expected} anchors, found {count}")
    return text.replace(old, new)


def js_block_end(text: str, open_brace: int) -> int:
    """Return index just after matching JS brace, ignoring quoted strings/comments."""
    if open_brace < 0 or open_brace >= len(text) or text[open_brace] != "{":
        raise RuntimeError("invalid JS block start")

    depth = 0
    i = open_brace
    state = "code"
    quote = ""

    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if state == "line_comment":
            if ch == "\n":
                state = "code"
            i += 1
            continue

        if state == "block_comment":
            if ch == "*" and nxt == "/":
                state = "code"
                i += 2
                continue
            i += 1
            continue

        if state == "string":
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                state = "code"
            i += 1
            continue

        if ch == "/" and nxt == "/":
            state = "line_comment"
            i += 2
            continue
        if ch == "/" and nxt == "*":
            state = "block_comment"
            i += 2
            continue
        if ch in ("'", '"', "`"):
            state = "string"
            quote = ch
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1

    raise RuntimeError("unterminated JS block")


def replace_function(text: str, name: str, replacement: str, label: str) -> str:
    marker = f"function {name}("
    start = text.find(marker)
    if start < 0:
        raise RuntimeError(f"{label}: function {name} not found")
    if text.find(marker, start + 1) >= 0:
        raise RuntimeError(f"{label}: function {name} is duplicated")
    brace = text.find("{", start)
    if brace < 0:
        raise RuntimeError(f"{label}: opening brace not found")
    end = js_block_end(text, brace)
    return text[:start] + replacement.rstrip() + text[end:]


def node_check(path: Path) -> None:
    proc = subprocess.run(
        ["node", "--check", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"{path.relative_to(ROOT)} syntax error:\n{proc.stderr or proc.stdout}"
        )


ELIGIBILITY_CODE = r"""// MEMEFLOW_PER_USER_DISCOVERY_V34_1
const MODES = new Set(['pump','dex','hybrid']);

export function normalizeDiscoveryMode(value){
  const raw =
    typeof value === 'object' && value !== null
      ? value.discoverySourceMode
      : value;

  const mode = String(raw || 'pump').trim().toLowerCase();
  return MODES.has(mode) ? mode : 'pump';
}

export function isPumpOriginToken(token){
  if(!token)return false;

  const mint = String(
    token?.mint ||
    token?.tokenMint ||
    token?.tokenAddress ||
    ''
  ).toLowerCase();

  const launch = String(token?.launchPlatform || '').toLowerCase();
  const protocol = String(token?.protocol || '').toLowerCase();
  const source = String(token?.source || '').toLowerCase();

  return (
    launch === 'pump' ||
    protocol === 'pump' ||
    source.includes('pump create') ||
    mint.endsWith('pump')
  );
}

export function tokenAllowedForSettings(settings, token){
  if(!isPumpOriginToken(token))return false;

  const mode = normalizeDiscoveryMode(settings);

  if(mode === 'dex'){
    return (
      token?.dexConfirmed === true &&
      Boolean(token?.dexUrl || token?.dexPairAddress)
    );
  }

  // Pump and Hybrid both use the canonical Pump discovery stream.
  // Hybrid simply benefits from the DEX verification/enrichment tags too.
  return true;
}
"""


try:
    log(f"root: {ROOT}")

    app = snapshot(APP)
    settings = snapshot(SETTINGS)
    store = snapshot(STORE)
    liveeval = snapshot(LIVEEVAL)
    recovery = snapshot(RECOVERY)
    existing_eligibility = snapshot(ELIGIBILITY)

    if PATCH_ID in app:
        log("already installed")
        sys.exit(0)

    if existing_eligibility.strip():
        raise RuntimeError(
            "src/discovery-eligibility.mjs already exists on an unrecognized build; refusing to layer over it"
        )

    # ------------------------------------------------------------
    # STRICT V33 PRE-FLIGHT
    # ------------------------------------------------------------
    required_app = {
        "V33 marker": "MEMEFLOW_PUMP_DEX_GATE_V33",
        "V33 global source gate": "function __tokenAllowedByDiscoveryMode(token)",
        "V33 evaluator base": "const __evaluateAllBase=makeEvaluateForActiveUsers(",
        "V33 evaluator wrapper": "function evaluateAll(token)",
        "V33 global decision prune": "function __pruneDecisionsForDiscoveryMode()",
        "V33 global runtime apply": "function __applyDiscoverySourceMode()",
        "V33 global source status": "function __discoverySourceStatus()",
        "V33 owner restriction": "Only the owner can switch the global discovery source.",
        "V33 DEX verifier": "createDexVerificationGate",
        "V33 Pump candidate": "const __pumpCandidate={",
        "V33 DEX hold branch": "if(__discoverySource.mode==='dex')",
        "V33 bridge source gate": "bridgeIsPump(t)&&__tokenAllowedByDiscoveryMode(t)",
        "V33 shadow source gate": "store.tokens().filter(__tokenAllowedByDiscoveryMode)",
    }
    missing = [name for name, marker in required_app.items() if marker not in app]
    if missing:
        raise RuntimeError("PRE-FLIGHT topology mismatch: " + ", ".join(missing))

    if recovery.count("tokenFilter = null") != 2:
        raise RuntimeError(
            f"PRE-FLIGHT recovery topology mismatch: expected 2 tokenFilter arguments, found {recovery.count('tokenFilter = null')}"
        )

    if app.count("tokenFilter:__tokenAllowedByDiscoveryMode") != 2:
        raise RuntimeError(
            "PRE-FLIGHT app recovery hooks mismatch: expected exactly 2 V33 global tokenFilter hooks"
        )

    if "export function makeEvaluateForActiveUsers" not in liveeval:
        raise RuntimeError("PRE-FLIGHT liveeval topology mismatch")

    if "export function normalizeSettings(raw={})" not in settings:
        raise RuntimeError("PRE-FLIGHT settings topology mismatch")

    if "setSettings(id,s)" not in store:
        raise RuntimeError("PRE-FLIGHT store topology mismatch")

    log("PRE-FLIGHT OK")
    log("verified exact V33 global gate + owner-only switch + recovery hooks + DEX verifier")

    # ------------------------------------------------------------
    # 1) One canonical per-user eligibility module.
    # ------------------------------------------------------------
    ELIGIBILITY.write_text(ELIGIBILITY_CODE, encoding="utf-8")

    # ------------------------------------------------------------
    # 2) Canonical user setting: discoverySourceMode.
    # ------------------------------------------------------------
    settings = replace_once(
        settings,
        " aiChangePolicy:'propose',decisionFreshnessSec:60\n}",
        " aiChangePolicy:'propose',decisionFreshnessSec:60,discoverySourceMode:'pump'\n}",
        "settings default discoverySourceMode",
    )

    settings = replace_once(
        settings,
        " o.profile=String(o.profile||d.profile).trim().toLowerCase();\n o.aiChangePolicy='propose';",
        " o.profile=String(o.profile||d.profile).trim().toLowerCase();\n o.discoverySourceMode=String(o.discoverySourceMode||d.discoverySourceMode).trim().toLowerCase();\n o.aiChangePolicy='propose';",
        "settings normalize discoverySourceMode",
    )

    settings = replace_once(
        settings,
        " if(!VALID_PROFILES.includes(s.profile))errors.push('Invalid profile: must be conservative, balanced or aggressive.');\n if(s.aiChangePolicy!=='propose')errors.push('AI change policy is currently restricted to propose-only.');",
        " if(!VALID_PROFILES.includes(s.profile))errors.push('Invalid profile: must be conservative, balanced or aggressive.');\n if(!['pump','dex','hybrid'].includes(s.discoverySourceMode))errors.push('Invalid discoverySourceMode: must be pump, dex or hybrid.');\n if(s.aiChangePolicy!=='propose')errors.push('AI change policy is currently restricted to propose-only.');",
        "settings validate discoverySourceMode",
    )

    # ------------------------------------------------------------
    # 3) Store can remove one user's stale decision cleanly.
    # ------------------------------------------------------------
    store = replace_once(
        store,
        "  decisions(uid){\n",
        """  deleteDecision(uid,mint){
    const key=uid+':'+mint;
    if(this._uidDec?.[uid])this._uidDec[uid].delete(key);
    delete this.state.decisions[key];
  }
  decisions(uid){
""",
        "store deleteDecision",
    )

    # ------------------------------------------------------------
    # 4) LIVE evaluation filters per user internally.
    #    No fragile app-server callback wiring is needed.
    # ------------------------------------------------------------
    liveeval = replace_once(
        liveeval,
        "import {evaluate} from './evaluate.mjs';\n",
        "import {evaluate} from './evaluate.mjs';\nimport {tokenAllowedForSettings} from './discovery-eligibility.mjs';\n",
        "liveeval eligibility import",
    )

    liveeval = replace_once(
        liveeval,
        """          const settings = store.settings(uid);
          if (!settings || typeof settings !== 'object') throw new Error('user settings unavailable after normalization');
          const d = evaluate(token, settings);""",
        """          const settings = store.settings(uid);
          if (!settings || typeof settings !== 'object') throw new Error('user settings unavailable after normalization');

          if (!tokenAllowedForSettings(settings, token)) {
            store.deleteDecision?.(uid, token.mint);
            metrics.liveEvaluationUsersSkipped++;
            continue;
          }

          const d = evaluate(token, settings);""",
        "liveeval per-user eligibility",
    )

    # ------------------------------------------------------------
    # 5) Recovery after restart/lazy load is per user too.
    # ------------------------------------------------------------
    recovery = replace_once(
        recovery,
        "import {evaluate} from './evaluate.mjs';\n",
        "import {evaluate} from './evaluate.mjs';\nimport {tokenAllowedForSettings} from './discovery-eligibility.mjs';\n",
        "recovery eligibility import",
    )

    recovery = replace_once(
        recovery,
        "  batchSize = 25, delayMs = 25, tokenLimit = 200, activeUserHoursMs = 86400000, tokenFilter = null,\n",
        "  batchSize = 25, delayMs = 25, tokenLimit = 200, activeUserHoursMs = 86400000,\n",
        "startup recovery remove global tokenFilter arg",
    )

    recovery = replace_once(
        recovery,
        "  const allTokens = store.tokens();\n  const eligibleTokens = tokenFilter ? allTokens.filter(tokenFilter) : allTokens;\n  const tokens = eligibleTokens.slice(0, tokenLimit);",
        "  const allTokens = store.tokens();\n  const tokens = allTokens.slice(0, tokenLimit);",
        "startup recovery remove global prefilter",
    )

    recovery = replace_once(
        recovery,
        """      for (const uid of activeUids) {
        try {
          const d = evaluate(token, store.settings(uid));""",
        """      for (const uid of activeUids) {
        try {
          const settings = store.settings(uid);

          if (!tokenAllowedForSettings(settings, token)) {
            store.deleteDecision?.(uid, token.mint);
            continue;
          }

          const d = evaluate(token, settings);""",
        "startup recovery per-user eligibility",
    )

    recovery = replace_once(
        recovery,
        "export function lazyRecoverUser({ store, uid, metrics, tokenLimit = 200, tokenFilter = null }) {",
        "export function lazyRecoverUser({ store, uid, metrics, tokenLimit = 200 }) {",
        "lazy recovery remove global tokenFilter arg",
    )

    recovery = replace_once(
        recovery,
        "    const allTokens = store.tokens();\n    const tokens = (tokenFilter ? allTokens.filter(tokenFilter) : allTokens).slice(0, tokenLimit);\n    for (const token of tokens) {\n      try {\n        const d = evaluate(token, store.settings(uid));",
        """    const tokens = store.tokens().slice(0, tokenLimit);
    const settings = store.settings(uid);

    for (const token of tokens) {
      try {
        if (!tokenAllowedForSettings(settings, token)) {
          store.deleteDecision?.(uid, token.mint);
          continue;
        }

        const d = evaluate(token, settings);""",
        "lazy recovery per-user eligibility",
    )

    # ------------------------------------------------------------
    # 6) app-server imports the same eligibility definition.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "import {validateSettings} from './src/settings.mjs';",
        "import {validateSettings} from './src/settings.mjs';import {normalizeDiscoveryMode,tokenAllowedForSettings} from './src/discovery-eligibility.mjs';",
        "app eligibility import",
    )

    # Replace ONLY the old global eligibility function, not __isPumpOriginToken
    # which is still used by the DEX verifier runtime.
    app = replace_function(
        app,
        "__tokenAllowedByDiscoveryMode",
        r"""function __discoveryModeForUser(uid){
  return normalizeDiscoveryMode(store.settings(uid));
}
function __tokenAllowedForUser(uid,token,settings=null){
  return tokenAllowedForSettings(settings||store.settings(uid),token);
}
function __migrateLegacyDiscoveryModes(){
  const legacyMode=normalizeDiscoveryMode(__discoverySource?.mode||'pump');
  let changed=0;

  for(const user of Object.values(store?.state?.users||{})){
    const current=(user?.settings&&typeof user.settings==='object'&&!Array.isArray(user.settings))
      ? user.settings
      : {};

    if(!Object.prototype.hasOwnProperty.call(current,'discoverySourceMode')){
      user.settings={...current,discoverySourceMode:legacyMode};
      changed++;
    }
  }

  if(changed)store.save();
  return {changed,legacyMode};
}""",
        "replace global source gate with per-user helpers",
    )

    # ------------------------------------------------------------
    # 7) Holder admission: each active user is checked independently.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "  if(!__tokenAllowedByDiscoveryMode(token))return {allow:false,drop:true,reason:'discovery_source_gate'};\n",
        "",
        "remove global holder source gate",
    )

    app = replace_once(
        app,
        """  for(const uid of users){
    /* MEMEFLOW_V12_12_HOLDER_ADMISSION_FIX""",
        """  for(const uid of users){
    if(!__tokenAllowedForUser(uid,token)){
      lastReason='user_discovery_mode_mismatch';
      continue;
    }

    /* MEMEFLOW_V12_12_HOLDER_ADMISSION_FIX""",
        "holder admission per-user gate",
    )

    # ------------------------------------------------------------
    # 8) evaluateAll no longer has one global source switch.
    #    This is structural, so formatting cannot break the installer again.
    # ------------------------------------------------------------
    app = replace_function(
        app,
        "evaluateAll",
        r"""function evaluateAll(token){
  return __evaluateAllBase(token);
}""",
        "remove V33 global evaluateAll wrapper",
    )

    # ------------------------------------------------------------
    # 9) publish is global infrastructure again; user filtering happens later.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "function publish(mint){\n  const __publishToken=store.state.tokens?.[mint]||null;\n  if(__publishToken&&!__tokenAllowedByDiscoveryMode(__publishToken))return;\n",
        "function publish(mint){\n",
        "remove global publish source gate",
    )

    # ------------------------------------------------------------
    # 10) Pump create ALWAYS enters canonical pipeline and DEX verifier.
    # ------------------------------------------------------------
    create_start = app.find("      const __pumpCandidate={")
    create_end = app.find("    }else if(result.reason==='knownNonCreate'){", create_start)
    if create_start < 0 or create_end < 0:
        raise RuntimeError("V33 Pump candidate block not found")

    create_block = app[create_start:create_end]
    if "if(__discoverySource.mode==='dex')" not in create_block:
        raise RuntimeError("V33 DEX hold branch missing from Pump candidate block")

    new_create = r"""      const __pumpCandidate={
        mint:result.mint,
        curve:result.curve,
        name:result.name,
        symbol:result.symbol,
        uri:result.uri,
        creator:result.creator,
        isMayhemMode:false,
        launchMode:'standard',
        launchPlatform:'pump',
        protocol:'pump',
        discoveredAt:Date.now(),
        slot:tx.slot,
        signature:sig,
        source:'Pump create'
      };

      // V34.1: one global Pump discovery stream for every user.
      store.addToken(__pumpCandidate);

      try{__v1224LinkCreator(result.mint,__v1223Token(result.mint))}catch{}
      try{
        const __created=store.state?.tokens?.[result.mint];
        const __creator=__created?.creator||null;
        if(__creator)eventHolderLedger.setCreator(result.mint,__creator);
      }catch{}

      // DEX is a verification/tagging layer, never a second discovery feed.
      __submitPumpCandidateForDex(__pumpCandidate);

      // Run the normal Pump pipeline immediately for Pump/Hybrid users.
      // DEX-only users are filtered inside live evaluation until confirmation.
      void enrich(result.mint,result.curve).catch(e=>{
        discMetrics.lastErrorAt=Date.now();
        discovery.lastError={message:'enrich: '+String(e?.message||e),at:Date.now()};
      });
"""
    app = app[:create_start] + new_create + app[create_end:]

    # ------------------------------------------------------------
    # 11) Bridge must repair the canonical Pump stream, not one global mode.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "bridgeIsPump(t)&&__tokenAllowedByDiscoveryMode(t)&&bridgeAgeMs(t,now)<=BRIDGE_MAX_AGE_MS",
        "bridgeIsPump(t)&&bridgeAgeMs(t,now)<=BRIDGE_MAX_AGE_MS",
        "remove bridge global source gate",
    )

    # ------------------------------------------------------------
    # 12) Shadow validation + settings reevaluation are per user/settings.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "function shadowValidateSettings(settings,limit=50){const rows=store.tokens().filter(__tokenAllowedByDiscoveryMode).slice(0,Math.max(1,Math.min(200,limit)));",
        "function shadowValidateSettings(settings,limit=50){const rows=store.tokens().filter(token=>tokenAllowedForSettings(settings,token)).slice(0,Math.max(1,Math.min(200,limit)));",
        "shadow validation per-user source",
    )

    app = replace_once(
        app,
        "  const tokens=store.tokens().filter(__tokenAllowedByDiscoveryMode).slice(0,Math.max(50,Math.min(500,Number(process.env.SETTINGS_REEVALUATE_LIMIT||250))));",
        "  const tokens=store.tokens().filter(token=>__tokenAllowedForUser(uid,token,settings)).slice(0,Math.max(50,Math.min(500,Number(process.env.SETTINGS_REEVALUATE_LIMIT||250))));",
        "settings reevaluation per-user source",
    )

    # ------------------------------------------------------------
    # 13) Recovery callsites no longer pass one server-global filter.
    # ------------------------------------------------------------
    app = replace_n(
        app,
        ",tokenFilter:__tokenAllowedByDiscoveryMode",
        "",
        2,
        "remove V33 recovery global filters",
    )

    # ------------------------------------------------------------
    # 14) Per-user stale decision pruning.
    # ------------------------------------------------------------
    app = replace_function(
        app,
        "__pruneDecisionsForDiscoveryMode",
        r"""function __pruneDecisionsForUserMode(uid){
  const map=store?._uidDec?.[uid];
  if(!map)return 0;

  let removed=0;
  for(const [key] of [...map.entries()]){
    const decision=store.state?.decisions?.[key];
    const mint=decision?.mint||String(key).slice(String(uid).length+1);
    const token=store.state?.tokens?.[mint];

    if(!token||!__tokenAllowedForUser(uid,token)){
      store.deleteDecision?.(uid,mint);
      removed++;
    }
  }
  return removed;
}""",
        "replace global decision prune",
    )

    # ------------------------------------------------------------
    # 15) Physical scanners are always-on shared infrastructure.
    # ------------------------------------------------------------
    app = replace_function(
        app,
        "__applyDiscoverySourceMode",
        r"""function __applyDiscoverySourceMode(){
  const migration=__migrateLegacyDiscoveryModes();

  // Pump is the only physical discovery feed.
  __startPumpLiveFeed();
  if(!ws)startDiscovery();

  // DexScreener verification runs continuously in the background.
  __ensureDexVerifier();
  const seeded=__seedDexVerifierFromRecentPump();

  console.log(
    '[DISCOVERY V34.1]',
    'Pump discovery + DEX verification always on',
    'seeded='+seeded,
    'migrated='+migration.changed,
    'legacyMode='+migration.legacyMode
  );

  return 'pump+dex-verification';
}""",
        "replace global runtime source switch",
    )

    # ------------------------------------------------------------
    # 16) Status reports this USER'S selected mode.
    # ------------------------------------------------------------
    app = replace_function(
        app,
        "__discoverySourceStatus",
        r"""function __discoverySourceStatusForUser(uid){
  const mode=__discoveryModeForUser(uid);
  const pumpTrade=__pumpLiveTradeFeed?.metrics?.()||null;
  const dexMetrics=__dexVerificationGate?.metrics?.()||{
    active:false,
    connected:false,
    strategy:'pump-origin+dex-verification',
    pairsConfirmed:0,
    pairsRejected:0,
    pendingConfirms:0,
    tracked:0
  };

  return {
    source:{
      mode,
      available:['pump','dex','hybrid'],
      pumpEnabled:true,
      dexEnabled:mode==='dex'||mode==='hybrid',
      strategy:'pump-origin+dex-verification',
      scope:'user',
      userSpecific:true
    },
    strategy:'pump-origin+dex-verification',
    infrastructure:{
      pumpDiscoveryAlwaysOn:true,
      dexVerificationAlwaysOn:true
    },
    pump:{
      connected:Boolean(discovery.connected||pumpTrade?.connected),
      createConnected:Boolean(discovery.connected),
      trade:pumpTrade
    },
    dex:{
      ...dexMetrics,
      connected:Boolean(discovery.connected&&dexMetrics.active!==false)
    }
  };
}""",
        "personalize discovery source status",
    )

    # ------------------------------------------------------------
    # 17) API GET/POST: every user can switch only THEIR OWN setting.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "if(url.pathname==='/api/discovery-source'&&req.method==='GET')return json(res,200,__discoverySourceStatus());",
        "if(url.pathname==='/api/discovery-source'&&req.method==='GET')return json(res,200,__discoverySourceStatusForUser(u.id));",
        "personal discovery source GET",
    )

    post_start = app.find(" if(url.pathname==='/api/discovery-source'&&req.method==='POST'){")
    post_end = app.find("\n\n if(url.pathname==='/api/settings'&&req.method==='GET')", post_start)
    if post_start < 0 or post_end < 0:
        raise RuntimeError("discovery source POST route block not found")

    old_post = app[post_start:post_end]
    if "Only the owner can switch the global discovery source." not in old_post:
        raise RuntimeError("owner-only source guard missing from expected POST route")

    new_post = r""" if(url.pathname==='/api/discovery-source'&&req.method==='POST'){
   const b=await body(req);
   const mode=normalizeDiscoveryMode(b?.mode);
   const raw=String(b?.mode||'').trim().toLowerCase();

   if(!['pump','dex','hybrid'].includes(raw)){
     return json(res,400,{
       error:'INVALID_DISCOVERY_SOURCE',
       message:'Discovery source must be Pump.fun, DEX or Hybrid.'
     });
   }

   const before=JSON.parse(JSON.stringify(store.settings(u.id)));
   const user=store.user(u.id);

   // Platform is a user preference. Do not bump settingsVersion here:
   // the same open Settings panel can still save its other fields normally.
   user.settings={...before,discoverySourceMode:mode};
   store.save();

   if(user.settings.changeLog!==false){
     store.recordSettingsChange(u.id,before,user.settings,{
       actor:u.id,
       source:'discovery_source_user'
     });
   }

   const decisionsRemoved=__pruneDecisionsForUserMode(u.id);
   const decisionsReevaluated=reevaluateUser(u.id);

   return json(res,200,{
     ...__discoverySourceStatusForUser(u.id),
     settingsVersion:u.settingsVersion||1,
     decisionsRemoved,
     decisionsReevaluated
   });
 }"""
    app = app[:post_start] + new_post + app[post_end:]

    # ------------------------------------------------------------
    # 18) Main settings GET/PUT preserves the user's platform mode.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "discoveryPlatforms:['pump','dex'],discoverySourceMode:__discoverySource.mode",
        "discoveryPlatforms:['pump','dex','hybrid'],discoverySourceMode:store.settings(u.id).discoverySourceMode",
        "settings GET personalized platform",
    )

    app = replace_once(
        app,
        "if(url.pathname==='/api/settings'&&req.method==='PUT'){const b=await body(req);const checked=validateSettings(b.settings||{});",
        "if(url.pathname==='/api/settings'&&req.method==='PUT'){const b=await body(req);const __incomingSettings={...(b.settings||{}),discoverySourceMode:store.settings(u.id).discoverySourceMode};const checked=validateSettings(__incomingSettings);",
        "settings PUT preserve platform",
    )

    # ------------------------------------------------------------
    # 19) Live Token States debug feed is filtered for THIS user.
    # ------------------------------------------------------------
    debug_old = """    const allTokens=Object.values(store?.state?.tokens||{});
    const visibleTokens=allTokens
      .filter(__tokenAllowedByDiscoveryMode)
      .sort((a,b)=>Number(b?.discoveredAt||b?.createdAt||0)-Number(a?.discoveredAt||a?.createdAt||0))
      .slice(0,limit);

    const settings=store.settings(u.id);

    const sample=visibleTokens.map(token=>{"""

    debug_new = """    const allTokens=Object.values(store?.state?.tokens||{});
    const settings=store.settings(u.id);
    const visibleTokens=allTokens
      .filter(token=>__tokenAllowedForUser(u.id,token,settings))
      .sort((a,b)=>Number(b?.discoveredAt||b?.createdAt||0)-Number(a?.discoveredAt||a?.createdAt||0))
      .slice(0,limit);

    const sample=visibleTokens.map(token=>{"""

    app = replace_once(
        app,
        debug_old,
        debug_new,
        "Live Token States per-user source filter",
    )

    # Clean one latent V33 diagnostic reference if this exact older route is present.
    old_diag = "liveTradeFeed:__pumpLiveTradeFeed?.metrics?.()||null,dexDiscovery:__dexDiscoveryFeed?.metrics?.()||null,discoverySource:__discoverySource.snapshot(),"
    if old_diag in app:
        app = app.replace(
            old_diag,
            "liveTradeFeed:__pumpLiveTradeFeed?.metrics?.()||null,dexVerification:__dexVerificationGate?.metrics?.()||null,discoverySource:__discoverySourceStatusForUser(u.id).source,",
            1,
        )
        log("cleaned old debug dexDiscovery/global-source diagnostic reference")

    # ------------------------------------------------------------
    # FINAL STATIC SAFETY CHECKS BEFORE WRITE.
    # ------------------------------------------------------------
    if "__tokenAllowedByDiscoveryMode" in app:
        raise RuntimeError(
            "global V33 source gate still has references after transformation; refusing partial install"
        )

    if "Only the owner can switch the global discovery source." in app:
        raise RuntimeError("owner-only source restriction still present")

    if "tokenFilter:__tokenAllowedByDiscoveryMode" in app:
        raise RuntimeError("global recovery filter still present")

    if "tokenFilter = null" in recovery:
        raise RuntimeError("global recovery tokenFilter still present in recovery.mjs")

    # ------------------------------------------------------------
    # WRITE ATOMIC SET + SYNTAX CHECK.
    # ------------------------------------------------------------
    APP.write_text(app.rstrip() + f"\n\n// {PATCH_ID}\n", encoding="utf-8")
    SETTINGS.write_text(settings, encoding="utf-8")
    STORE.write_text(store, encoding="utf-8")
    LIVEEVAL.write_text(liveeval, encoding="utf-8")
    RECOVERY.write_text(recovery, encoding="utf-8")

    for path in [APP, SETTINGS, STORE, LIVEEVAL, RECOVERY, ELIGIBILITY]:
        node_check(path)

    final_app = APP.read_text(encoding="utf-8")
    final_settings = SETTINGS.read_text(encoding="utf-8")
    final_liveeval = LIVEEVAL.read_text(encoding="utf-8")
    final_recovery = RECOVERY.read_text(encoding="utf-8")

    validations = {
        "patch marker": PATCH_ID in final_app,
        "per-user setting": "discoverySourceMode:'pump'" in final_settings,
        "eligibility import": "discovery-eligibility.mjs" in final_app,
        "liveeval per-user filter": "tokenAllowedForSettings(settings, token)" in final_liveeval,
        "recovery per-user filter": "tokenAllowedForSettings(settings, token)" in final_recovery,
        "owner restriction removed": "Only the owner can switch the global discovery source." not in final_app,
        "global gate removed": "__tokenAllowedByDiscoveryMode" not in final_app,
        "Pump candidates always stored": "store.addToken(__pumpCandidate);" in final_app,
        "all Pump candidates DEX checked": "__submitPumpCandidateForDex(__pumpCandidate);" in final_app,
        "always-on verifier": "Pump discovery + DEX verification always on" in final_app,
        "personal GET": "__discoverySourceStatusForUser(u.id)" in final_app,
        "personal token list": ".filter(token=>__tokenAllowedForUser(u.id,token,settings))" in final_app,
        "no V33 recovery callback": "tokenFilter:__tokenAllowedByDiscoveryMode" not in final_app,
        "no recovery global filter arg": "tokenFilter = null" not in final_recovery,
    }

    bad = [name for name, ok in validations.items() if not ok]
    if bad:
        raise RuntimeError("POST-INSTALL validation failed: " + ", ".join(bad))

    log("app-server.mjs syntax OK")
    log("src/settings.mjs syntax OK")
    log("src/store.mjs syntax OK")
    log("src/liveeval.mjs syntax OK")
    log("src/recovery.mjs syntax OK")
    log("src/discovery-eligibility.mjs syntax OK")
    log("")
    log("INSTALL COMPLETE")
    log("")
    log("FINAL ARCHITECTURE")
    log("  GLOBAL Pump discovery: ALWAYS ON")
    log("  GLOBAL DexScreener verification: ALWAYS ON in background")
    log("  USER Pump.fun: all Pump-origin candidates")
    log("  USER DEX: only Pump-origin candidates with confirmed real DEX pair")
    log("  USER Hybrid: all Pump-origin candidates + DEX verification/enrichment")
    log("  Platform selection is persisted separately for every user")
    log("  Owner permission is NOT required for Platform switching")
    log("  Switching one user never changes another user's mode")
    log("  Existing users inherit the old global mode once on first V34.1 startup")
    log("  No CSS, system.js or visual layer was modified")
    log("")
    log(f"backup: {BACKUP}")
    log("Restart the Replit workflow/app, then reload Settings once.")

except Exception as exc:
    rollback(exc)
