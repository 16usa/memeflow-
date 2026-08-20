#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_PER_USER_DISCOVERY_V34"
STAMP = time.strftime("%Y%m%d-%H%M%S")

def log(msg):
    print(f"[DISCOVERY-V34] {msg}", flush=True)

def find_root():
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
    for p in candidates:
        try:
            p = p.resolve()
        except Exception:
            continue
        if all((p / x).is_file() for x in required):
            return p
    raise RuntimeError("MEMEFLOW V33 project root not found")

ROOT = find_root()

APP = ROOT / "app-server.mjs"
SETTINGS = ROOT / "src/settings.mjs"
STORE = ROOT / "src/store.mjs"
LIVEEVAL = ROOT / "src/liveeval.mjs"
RECOVERY = ROOT / "src/recovery.mjs"
GATE = ROOT / "src/dex-verification-gate.mjs"

FILES = [APP, SETTINGS, STORE, LIVEEVAL, RECOVERY, GATE]
BACK = ROOT / f".per-user-discovery-v34-backup-{STAMP}"
BACK.mkdir(parents=True, exist_ok=True)

original = {}

def remember(path):
    text = path.read_text(encoding="utf-8")
    original[path] = text
    dst = BACK / path.relative_to(ROOT)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dst)
    return text

def rollback(reason):
    log(f"ERROR: {reason}")
    for path, text in original.items():
        path.write_text(text, encoding="utf-8")
    log("ROLLBACK COMPLETE")
    sys.exit(1)

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 anchor, found {count}")
    return text.replace(old, new, 1)

def node_check(path):
    r = subprocess.run(
        ["node", "--check", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if r.returncode:
        raise RuntimeError(
            f"{path.relative_to(ROOT)} syntax error:\n"
            + (r.stderr or r.stdout)
        )

try:
    log(f"root: {ROOT}")

    app = remember(APP)
    settings = remember(SETTINGS)
    store = remember(STORE)
    liveeval = remember(LIVEEVAL)
    recovery = remember(RECOVERY)
    gate = remember(GATE)

    if PATCH_ID in app:
        log("already installed")
        sys.exit(0)

    # ------------------------------------------------------------
    # STRICT PRE-FLIGHT: V34 only installs on the V33 architecture.
    # ------------------------------------------------------------
    checks = {
        "V33 marker": "MEMEFLOW_PUMP_DEX_GATE_V33" in app,
        "DEX verifier import": "createDexVerificationGate" in app,
        "V33 user-global gate": "function __tokenAllowedByDiscoveryMode(token)" in app,
        "V33 global DEX create hold": "if(__discoverySource.mode==='dex')" in app,
        "owner-only source route": "Only the owner can switch the global discovery source." in app,
        "V33 recovery tokenFilter": "tokenFilter = null" in recovery,
        "settings normalizer": "export function normalizeSettings(raw={})" in settings,
        "live evaluator": "export function makeEvaluateForActiveUsers" in liveeval,
        "store settings": "setSettings(id,s)" in store,
    }

    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise RuntimeError(
            "PRE-FLIGHT refused unknown/partial topology: " + ", ".join(failed)
        )

    log("PRE-FLIGHT OK")
    log("verified V33 global source gate + owner-only switch + DEX verifier")

    # ------------------------------------------------------------
    # 1) USER SETTINGS: discoverySourceMode is canonical and persisted.
    # ------------------------------------------------------------
    settings = replace_once(
        settings,
        " aiChangePolicy:'propose',decisionFreshnessSec:60\n}",
        " aiChangePolicy:'propose',decisionFreshnessSec:60,discoverySourceMode:'pump'\n}",
        "settings default discoverySourceMode"
    )

    settings = replace_once(
        settings,
        " o.profile=String(o.profile||d.profile).trim().toLowerCase();\n"
        " o.aiChangePolicy='propose';",
        " o.profile=String(o.profile||d.profile).trim().toLowerCase();\n"
        " o.discoverySourceMode=String(o.discoverySourceMode||d.discoverySourceMode).trim().toLowerCase();\n"
        " o.aiChangePolicy='propose';",
        "settings normalize discoverySourceMode"
    )

    settings = replace_once(
        settings,
        " if(!VALID_PROFILES.includes(s.profile))errors.push('Invalid profile: must be conservative, balanced or aggressive.');\n"
        " if(s.aiChangePolicy!=='propose')errors.push('AI change policy is currently restricted to propose-only.');",
        " if(!VALID_PROFILES.includes(s.profile))errors.push('Invalid profile: must be conservative, balanced or aggressive.');\n"
        " if(!['pump','dex','hybrid'].includes(s.discoverySourceMode))errors.push('Invalid discoverySourceMode: must be pump, dex or hybrid.');\n"
        " if(s.aiChangePolicy!=='propose')errors.push('AI change policy is currently restricted to propose-only.');",
        "settings validate discoverySourceMode"
    )

    # ------------------------------------------------------------
    # 2) STORE: one clean decision deletion primitive.
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
        "store deleteDecision"
    )

    # ------------------------------------------------------------
    # 3) LIVE EVALUATION: eligibility is per USER, not global.
    # ------------------------------------------------------------
    liveeval = replace_once(
        liveeval,
        "  store, metrics, activeUserHoursMs = 86400000, batchSize = 25, delayMs = 0, onDecision = null,\n",
        "  store, metrics, activeUserHoursMs = 86400000, batchSize = 25, delayMs = 0, onDecision = null, tokenEligibleForUser = null,\n",
        "liveeval callback argument"
    )

    liveeval = replace_once(
        liveeval,
        """          const settings = store.settings(uid);
          if (!settings || typeof settings !== 'object') throw new Error('user settings unavailable after normalization');
          const d = evaluate(token, settings);""",
        """          const settings = store.settings(uid);
          if (!settings || typeof settings !== 'object') throw new Error('user settings unavailable after normalization');

          if (tokenEligibleForUser && !tokenEligibleForUser(uid, token, settings)) {
            store.deleteDecision?.(uid, token.mint);
            metrics.liveEvaluationUsersSkipped++;
            continue;
          }

          const d = evaluate(token, settings);""",
        "liveeval per-user eligibility"
    )

    # ------------------------------------------------------------
    # 4) RECOVERY: same per-user eligibility after restart/lazy load.
    #    V33's tokenFilter was global; replace it cleanly.
    # ------------------------------------------------------------
    recovery = replace_once(
        recovery,
        "  batchSize = 25, delayMs = 25, tokenLimit = 200, activeUserHoursMs = 86400000, tokenFilter = null,\n",
        "  batchSize = 25, delayMs = 25, tokenLimit = 200, activeUserHoursMs = 86400000, tokenEligibleForUser = null,\n",
        "startup recovery callback arg"
    )

    recovery = replace_once(
        recovery,
        """  const allTokens = store.tokens();
  const eligibleTokens = tokenFilter ? allTokens.filter(tokenFilter) : allTokens;
  const tokens = eligibleTokens.slice(0, tokenLimit);""",
        """  const allTokens = store.tokens();
  const tokens = allTokens.slice(0, tokenLimit);""",
        "startup recovery remove global prefilter"
    )

    recovery = replace_once(
        recovery,
        """      for (const uid of activeUids) {
        try {
          const d = evaluate(token, store.settings(uid));""",
        """      for (const uid of activeUids) {
        try {
          const settings = store.settings(uid);

          if (tokenEligibleForUser && !tokenEligibleForUser(uid, token, settings)) {
            store.deleteDecision?.(uid, token.mint);
            continue;
          }

          const d = evaluate(token, settings);""",
        "startup recovery per-user filter"
    )

    recovery = replace_once(
        recovery,
        "export function lazyRecoverUser({ store, uid, metrics, tokenLimit = 200, tokenFilter = null }) {",
        "export function lazyRecoverUser({ store, uid, metrics, tokenLimit = 200, tokenEligibleForUser = null }) {",
        "lazy recovery callback arg"
    )

    recovery = replace_once(
        recovery,
        """    const allTokens = store.tokens();
    const tokens = (tokenFilter ? allTokens.filter(tokenFilter) : allTokens).slice(0, tokenLimit);
    for (const token of tokens) {
      try {
        const d = evaluate(token, store.settings(uid));""",
        """    const tokens = store.tokens().slice(0, tokenLimit);
    const settings = store.settings(uid);

    for (const token of tokens) {
      try {
        if (tokenEligibleForUser && !tokenEligibleForUser(uid, token, settings)) {
          store.deleteDecision?.(uid, token.mint);
          continue;
        }

        const d = evaluate(token, settings);""",
        "lazy recovery per-user filter"
    )

    # ------------------------------------------------------------
    # 5) APP: replace global mode gate with user-mode eligibility.
    # ------------------------------------------------------------
    helper_start = app.find("function __isPumpOriginToken(token){")
    helper_end = app.find("const paper=new PaperEngine(store);", helper_start)

    if helper_start < 0 or helper_end < 0:
        raise RuntimeError("V33 source helper block not found")

    helper_block = app[helper_start:helper_end]

    global_gate_start = helper_block.find("function __tokenAllowedByDiscoveryMode(token){")
    if global_gate_start < 0:
        raise RuntimeError("V33 __tokenAllowedByDiscoveryMode not found")

    # Find end of the function by brace counting.
    absolute_gate_start = helper_start + global_gate_start
    brace = app.find("{", absolute_gate_start)
    depth = 0
    gate_end = None
    for i in range(brace, len(app)):
        if app[i] == "{":
            depth += 1
        elif app[i] == "}":
            depth -= 1
            if depth == 0:
                gate_end = i + 1
                break
    if gate_end is None:
        raise RuntimeError("could not parse V33 global gate function")

    new_gate_helpers = r"""function __discoveryModeFromSettings(settings){
  const mode=String(
    settings?.discoverySourceMode||
    'pump'
  ).trim().toLowerCase();

  return ['pump','dex','hybrid'].includes(mode)
    ? mode
    : 'pump';
}

function __discoveryModeForUser(uid){
  return __discoveryModeFromSettings(
    store.settings(uid)
  );
}

function __tokenAllowedForMode(mode,token){
  if(!__isPumpOriginToken(token))return false;

  if(mode==='dex'){
    return (
      token?.dexConfirmed===true &&
      Boolean(
        token?.dexUrl ||
        token?.dexPairAddress
      )
    );
  }

  // Pump: all Pump-origin candidates.
  // Hybrid: same Pump stream plus DEX verification/enrichment when available.
  return true;
}

function __tokenAllowedForSettings(settings,token){
  return __tokenAllowedForMode(
    __discoveryModeFromSettings(settings),
    token
  );
}

function __tokenAllowedForUser(uid,token,settings=null){
  return __tokenAllowedForSettings(
    settings||store.settings(uid),
    token
  );
}
"""

    app = app[:absolute_gate_start] + new_gate_helpers + app[gate_end:]

    # ------------------------------------------------------------
    # 6) HOLDER ADMISSION: no global drop; each active user is checked.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "  if(!__tokenAllowedByDiscoveryMode(token))return {allow:false,drop:true,reason:'discovery_source_gate'};\n",
        "",
        "remove V33 global holder gate"
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
        "holder per-user gate"
    )

    # ------------------------------------------------------------
    # 7) LIVE evaluator: configure one per-user callback, no global wrapper.
    # ------------------------------------------------------------
    eval_start = app.find("const __evaluateAllBase=makeEvaluateForActiveUsers(")
    eval_end_marker = "\nfunction "
    # V33 wrapper ends immediately before the next function declaration.
    if eval_start < 0:
        raise RuntimeError("V33 evaluateAll wrapper start not found")

    wrapper_marker = """function evaluateAll(token){
  if(!__tokenAllowedByDiscoveryMode(token)){
    return Promise.resolve({decisionLike:false,skipped:true,reason:'DISCOVERY_SOURCE_GATE'});
  }
  return __evaluateAllBase(token);
}"""

    if wrapper_marker not in app:
        raise RuntimeError("V33 evaluateAll global wrapper not found")

    app = replace_once(
        app,
        "onDecision:(uid,token,decision)=>{try{paper.onDecision(uid,token,decision,store.settings(uid))}catch(_){}}});",
        "onDecision:(uid,token,decision)=>{try{paper.onDecision(uid,token,decision,store.settings(uid))}catch(_){}},tokenEligibleForUser:__tokenAllowedForUser});",
        "liveeval app callback"
    )

    app = replace_once(
        app,
        wrapper_marker,
        """function evaluateAll(token){
  return __evaluateAllBase(token);
}""",
        "remove global evaluateAll gate"
    )

    # ------------------------------------------------------------
    # 8) PUMP CREATE: ALWAYS store/enrich; ALWAYS DEX-verify in background.
    # ------------------------------------------------------------
    create_start = app.find("      const __pumpCandidate={")
    create_end = app.find("    }else if(result.reason==='knownNonCreate'){", create_start)

    if create_start < 0 or create_end < 0:
        raise RuntimeError("V33 Pump candidate block not found")

    create_block = app[create_start:create_end]

    if "if(__discoverySource.mode==='dex')" not in create_block:
        raise RuntimeError("V33 DEX hold path is not present in Pump create block")

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

      // V34 multi-user architecture:
      // Pump discovery is global and canonical for EVERY user.
      // DEX verification runs in the background for every Pump mint.
      // Individual users only filter/evaluate the canonical stream.
      store.addToken(__pumpCandidate);

      try{
        __v1224LinkCreator(
          result.mint,
          __v1223Token(result.mint)
        );
      }catch{}

      try{
        const __created=
          store.state?.tokens?.[result.mint];

        const __creator=
          __created?.creator||null;

        if(__creator){
          eventHolderLedger.setCreator(
            result.mint,
            __creator
          );
        }
      }catch{}

      __submitPumpCandidateForDex(__pumpCandidate);

      void enrich(
        result.mint,
        result.curve
      ).catch(e=>{
        discMetrics.lastErrorAt=Date.now();
        discovery.lastError={
          message:'enrich: '+String(e?.message||e),
          at:Date.now()
        };
      });
"""

    app = app[:create_start] + new_create + app[create_end:]

    # ------------------------------------------------------------
    # 9) SHADOW VALIDATION + manual re-evaluation are user-specific.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "function shadowValidateSettings(settings,limit=50){const rows=store.tokens().filter(__tokenAllowedByDiscoveryMode).slice(0,Math.max(1,Math.min(200,limit)));",
        "function shadowValidateSettings(settings,limit=50){const rows=store.tokens().filter(token=>__tokenAllowedForSettings(settings,token)).slice(0,Math.max(1,Math.min(200,limit)));",
        "shadow settings per-user mode"
    )

    app = replace_once(
        app,
        "  const tokens=store.tokens().filter(__tokenAllowedByDiscoveryMode).slice(0,Math.max(50,Math.min(500,Number(process.env.SETTINGS_REEVALUATE_LIMIT||250))));",
        "  const tokens=store.tokens().filter(token=>__tokenAllowedForUser(uid,token,settings)).slice(0,Math.max(50,Math.min(500,Number(process.env.SETTINGS_REEVALUATE_LIMIT||250))));",
        "reevaluateUser per-user mode"
    )

    # ------------------------------------------------------------
    # 10) RECOVERY app hooks use (uid,token), not one global token filter.
    # ------------------------------------------------------------
    app = app.replace(
        "tokenFilter:__tokenAllowedByDiscoveryMode",
        "tokenEligibleForUser:__tokenAllowedForUser"
    )

    if "tokenFilter:__tokenAllowedByDiscoveryMode" in app:
        raise RuntimeError("one or more V33 global recovery hooks remained")

    # ------------------------------------------------------------
    # 11) Runtime: Pump + DEX verification are ALWAYS on globally.
    # ------------------------------------------------------------
    old_apply = r"""function __applyDiscoverySourceMode(){
  // Pump is the ONE discovery source in all three modes.
  __startPumpLiveFeed();

  if(!ws){
    startDiscovery();
  }

  const gate=
    __ensureDexVerifier();

  if(
    __discoverySource.mode==='dex' ||
    __discoverySource.mode==='hybrid'
  ){
    const seeded=
      __seedDexVerifierFromRecentPump();

    console.log(
      '[DISCOVERY SOURCE]',
      __discoverySource.mode,
      'Pump discovery + DEX verification',
      'seeded='+seeded
    );
  }else{
    // Pump mode does not verify new candidates.
    // Tracked already-verified tokens keep market updates for open positions.
    gate.clearPending();

    console.log(
      '[DISCOVERY SOURCE]',
      __discoverySource.mode,
      'Pump discovery only'
    );
  }

  __pruneDecisionsForDiscoveryMode();

  return __discoverySource.mode;
}"""

    new_apply = r"""function __applyDiscoverySourceMode(){
  // V34: physical scanners are global infrastructure, never user switches.
  // Pump discovers every token; DEX verifier tags the same Pump token.
  __startPumpLiveFeed();

  if(!ws){
    startDiscovery();
  }

  __ensureDexVerifier();

  const seeded=
    __seedDexVerifierFromRecentPump();

  console.log(
    '[DISCOVERY V34]',
    'Pump discovery + background DEX verification always on',
    'seeded='+seeded
  );

  return 'pump+dex-verification';
}"""

    app = replace_once(
        app,
        old_apply,
        new_apply,
        "global runtime always-on"
    )

    # Replace the global prune helper with a single-user prune helper.
    prune_start = app.find("function __pruneDecisionsForDiscoveryMode(){")
    prune_end = app.find("\nfunction __applyDiscoverySourceMode(){", prune_start)

    if prune_start < 0 or prune_end < 0:
        raise RuntimeError("V33 global prune helper not found")

    new_prune = r"""function __pruneDecisionsForUserMode(uid){
  const map=store?._uidDec?.[uid];

  if(!map)return 0;

  let removed=0;

  for(const [key] of [...map.entries()]){
    const decision=
      store.state?.decisions?.[key];

    const mint=
      decision?.mint||
      String(key).slice(
        String(uid).length+1
      );

    const token=
      store.state?.tokens?.[mint];

    if(
      !token ||
      !__tokenAllowedForUser(uid,token)
    ){
      store.deleteDecision?.(uid,mint);
      removed++;
    }
  }

  return removed;
}
"""

    app = app[:prune_start] + new_prune + app[prune_end:]

    # ------------------------------------------------------------
    # 12) Personalized status. Physical scanner remains shared.
    # ------------------------------------------------------------
    status_start = app.find("function __discoverySourceStatus(){")
    status_end = app.find("\n// MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT", status_start)

    if status_start < 0 or status_end < 0:
        raise RuntimeError("V33 discovery status function not found")

    old_status_block = app[status_start:status_end]

    # Keep everything after the status function in this block untouched by
    # parsing only the function itself.
    brace = app.find("{", status_start)
    depth = 0
    status_func_end = None
    for i in range(brace, status_end):
        if app[i] == "{":
            depth += 1
        elif app[i] == "}":
            depth -= 1
            if depth == 0:
                status_func_end = i + 1
                break

    if status_func_end is None:
        raise RuntimeError("could not parse V33 discovery status function")

    new_status = r"""function __discoverySourceStatusForUser(uid){
  const mode=
    __discoveryModeForUser(uid);

  const pumpTrade=
    __pumpLiveTradeFeed?.metrics?.()||
    null;

  const dexMetrics=
    __dexVerificationGate?.metrics?.()||
    {
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
      dexEnabled:
        mode==='dex'||
        mode==='hybrid',
      strategy:'pump-origin+dex-verification',
      scope:'user',
      userSpecific:true
    },

    strategy:
      'pump-origin+dex-verification',

    infrastructure:{
      pumpDiscoveryAlwaysOn:true,
      dexVerificationAlwaysOn:true
    },

    pump:{
      connected:Boolean(
        discovery.connected||
        pumpTrade?.connected
      ),
      createConnected:
        Boolean(discovery.connected),
      trade:pumpTrade
    },

    dex:{
      ...dexMetrics,
      connected:Boolean(
        discovery.connected &&
        dexMetrics.active!==false
      )
    }
  };
}"""

    app = app[:status_start] + new_status + app[status_func_end:]

    # ------------------------------------------------------------
    # 13) API: source mode is per user. NO OWNER restriction.
    # ------------------------------------------------------------
    old_get = "if(url.pathname==='/api/discovery-source'&&req.method==='GET')return json(res,200,__discoverySourceStatus());"
    new_get = "if(url.pathname==='/api/discovery-source'&&req.method==='GET')return json(res,200,__discoverySourceStatusForUser(u.id));"

    app = replace_once(
        app,
        old_get,
        new_get,
        "personal discovery GET"
    )

    old_post = """ if(url.pathname==='/api/discovery-source'&&req.method==='POST'){

   if(!u.isOwner)return json(res,403,{error:'OWNER_REQUIRED',message:'Only the owner can switch the global discovery source.'});

   const b=await body(req);

   try{__discoverySource.set(b?.mode);__applyDiscoverySourceMode();return json(res,200,__discoverySourceStatus())}
   catch(e){return json(res,400,{error:e.code||'INVALID_DISCOVERY_SOURCE',message:e.message})}

 }"""

    new_post = """ if(url.pathname==='/api/discovery-source'&&req.method==='POST'){
   const b=await body(req);
   const mode=String(b?.mode||'').trim().toLowerCase();

   if(!['pump','dex','hybrid'].includes(mode)){
     return json(res,400,{
       error:'INVALID_DISCOVERY_SOURCE',
       message:'Discovery source must be Pump.fun, DEX or Hybrid.'
     });
   }

   const before=JSON.parse(JSON.stringify(store.settings(u.id)));
   const user=store.user(u.id);

   // Persist independently from the main settings-version transaction so
   // tapping Platform cannot cause a later Save settings version conflict.
   user.settings={
     ...before,
     discoverySourceMode:mode
   };

   store.save();

   if(user.settings.changeLog!==false){
     store.recordSettingsChange(
       u.id,
       before,
       user.settings,
       {
         actor:u.id,
         source:'discovery_source_user'
       }
     );
   }

   const removed=
     __pruneDecisionsForUserMode(u.id);

   const decisionsReevaluated=
     reevaluateUser(u.id);

   return json(res,200,{
     ...__discoverySourceStatusForUser(u.id),
     settingsVersion:u.settingsVersion||1,
     decisionsRemoved:removed,
     decisionsReevaluated
   });
 }"""

    app = replace_once(
        app,
        old_post,
        new_post,
        "remove owner-only source POST"
    )

    # ------------------------------------------------------------
    # 14) Settings GET shows each user's mode.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "discoverySourceMode:__discoverySource.mode",
        "discoverySourceMode:store.settings(u.id).discoverySourceMode",
        "settings capability personalized mode"
    )

    # Main Save settings must preserve the Platform selection if the settings
    # UI does not include this separate top-card field in its PUT payload.
    app = replace_once(
        app,
        "if(url.pathname==='/api/settings'&&req.method==='PUT'){const b=await body(req);const checked=validateSettings(b.settings||{});",
        "if(url.pathname==='/api/settings'&&req.method==='PUT'){const b=await body(req);const __incomingSettings={...(b.settings||{})};if(__incomingSettings.discoverySourceMode==null)__incomingSettings.discoverySourceMode=store.settings(u.id).discoverySourceMode;const checked=validateSettings(__incomingSettings);",
        "preserve per-user source on settings PUT"
    )

    # ------------------------------------------------------------
    # 15) Live Token States uses THIS user's filter, never global mode.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "    const activeSource=String(__discoverySource?.mode||'dex').toLowerCase();",
        "    const activeSource=__discoveryModeForUser(u.id);",
        "token list user-specific source"
    )

    # V33 should already have converted DEX rows to Pump-origin+confirmed.
    if """const isDexToken=t=>{
      return (
        isPumpToken(t) &&
        t?.dexConfirmed===true &&
        Boolean(t?.dexUrl||t?.dexPairAddress)
      );
    };""" not in app:
        raise RuntimeError(
            "V33 Live Token States DEX verification filter not found; refusing partial patch"
        )

    # ------------------------------------------------------------
    # 16) Recovery callsite names must match the updated module.
    # ------------------------------------------------------------
    if "tokenEligibleForUser:__tokenAllowedForUser" not in app:
        raise RuntimeError(
            "per-user recovery callsites were not produced"
        )

    # ------------------------------------------------------------
    # 17) Fairness in the shared DexScreener queue:
    #     brand-new Pump mints beat old retries.
    # ------------------------------------------------------------
    gate = replace_once(
        gate,
        """      .sort((a, b) => a.nextAt - b.nextAt)
      .slice(0, 30);""",
        """      .sort(
        (a, b) =>
          Number(a.attempts || 0) - Number(b.attempts || 0) ||
          a.nextAt - b.nextAt
      )
      .slice(0, 30);""",
        "DEX queue new-token priority"
    )

    # ------------------------------------------------------------
    # WRITE + SYNTAX CHECK ALL TOGETHER.
    # ------------------------------------------------------------
    APP.write_text(app.rstrip() + f"\n\n// {PATCH_ID}\n", encoding="utf-8")
    SETTINGS.write_text(settings, encoding="utf-8")
    STORE.write_text(store, encoding="utf-8")
    LIVEEVAL.write_text(liveeval, encoding="utf-8")
    RECOVERY.write_text(recovery, encoding="utf-8")
    GATE.write_text(gate, encoding="utf-8")

    for path in FILES:
        node_check(path)

    # ------------------------------------------------------------
    # POST-INSTALL STRUCTURAL VALIDATION.
    # ------------------------------------------------------------
    final_app = APP.read_text(encoding="utf-8")
    final_settings = SETTINGS.read_text(encoding="utf-8")
    final_recovery = RECOVERY.read_text(encoding="utf-8")
    final_liveeval = LIVEEVAL.read_text(encoding="utf-8")

    validations = {
        "owner restriction removed":
            "Only the owner can switch the global discovery source." not in final_app,

        "per-user setting exists":
            "discoverySourceMode:'pump'" in final_settings,

        "per-user mode helper":
            "function __tokenAllowedForUser(uid,token,settings=null)" in final_app,

        "Pump candidates always stored":
            "store.addToken(__pumpCandidate);" in final_app,

        "all Pump candidates DEX verified":
            "__submitPumpCandidateForDex(__pumpCandidate);" in final_app,

        "global DEX hold removed":
            "if(__discoverySource.mode==='dex')" not in final_app,

        "scanners always on":
            "Pump discovery + background DEX verification always on" in final_app,

        "personalized source GET":
            "__discoverySourceStatusForUser(u.id)" in final_app,

        "token list personalized":
            "const activeSource=__discoveryModeForUser(u.id);" in final_app,

        "live eval per user":
            "tokenEligibleForUser = null" in final_liveeval,

        "recovery per user":
            "tokenEligibleForUser = null" in final_recovery,

        "old global recovery filter removed":
            "tokenFilter = null" not in final_recovery,

        "patch marker":
            PATCH_ID in final_app,
    }

    bad = [name for name, ok in validations.items() if not ok]
    if bad:
        raise RuntimeError(
            "POST-INSTALL validation failed: " + ", ".join(bad)
        )

    log("app-server.mjs syntax OK")
    log("src/settings.mjs syntax OK")
    log("src/store.mjs syntax OK")
    log("src/liveeval.mjs syntax OK")
    log("src/recovery.mjs syntax OK")
    log("src/dex-verification-gate.mjs syntax OK")
    log("")
    log("INSTALL COMPLETE")
    log("")
    log("FINAL MULTI-USER ARCHITECTURE:")
    log("  GLOBAL: Pump discovery ALWAYS ON")
    log("  GLOBAL: DexScreener verification ALWAYS ON in background")
    log("  USER Pump:   sees/evaluates all Pump-origin tokens")
    log("  USER DEX:    sees/evaluates Pump-origin tokens only after DEX confirmation")
    log("  USER Hybrid: sees/evaluates all Pump tokens; DEX data enriches them when available")
    log("  Platform choice is persisted separately inside each user's settings")
    log("  No owner permission is required to switch Platform")
    log("  One user's switch never changes another user's scanner/filter")
    log("  New Pump tokens are prioritized ahead of old DEX verification retries")
    log("")
    log(f"backup: {BACK}")
    log("Restart the Replit workflow/app, then reload Settings and Live token states.")

except Exception as exc:
    rollback(exc)
