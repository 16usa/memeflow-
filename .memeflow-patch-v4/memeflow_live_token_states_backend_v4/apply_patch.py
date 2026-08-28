#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

PATCH_ID = "MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V4"


def die(message: str) -> None:
    raise RuntimeError(message)


def find_app_root() -> Path:
    cwd = Path.cwd()
    candidates = [
        cwd,
        cwd / "memeflow-app",
        Path.home() / "workspace",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace"),
        Path("/home/runner/workspace/memeflow-app"),
        Path("/workspace"),
        Path("/workspace/memeflow-app"),
    ]
    seen: set[str] = set()
    for candidate in candidates:
        try:
            root = candidate.resolve()
        except Exception:
            continue
        key = str(root)
        if key in seen:
            continue
        seen.add(key)
        if (root / "app-server.mjs").is_file() and (root / "system.js").is_file():
            return root
    die("MEMEFLOW app root not found (need app-server.mjs + system.js).")


def count_regex(text: str, pattern: str) -> int:
    return len(re.findall(pattern, text, flags=re.M))


def insert_after_match(text: str, pattern: str, addition: str, label: str) -> str:
    matches = list(re.finditer(pattern, text, flags=re.M))
    if len(matches) != 1:
        die(f"{label}: expected exactly 1 anchor, found {len(matches)}")
    m = matches[0]
    return text[: m.end()] + addition + text[m.end() :]


def insert_before_match(text: str, pattern: str, addition: str, label: str) -> str:
    matches = list(re.finditer(pattern, text, flags=re.M))
    if len(matches) != 1:
        die(f"{label}: expected exactly 1 anchor, found {len(matches)}")
    m = matches[0]
    return text[: m.start()] + addition + text[m.start() :]


def main() -> int:
    root = find_app_root()
    server_path = root / "app-server.mjs"
    system_path = root / "system.js"

    server = server_path.read_text(encoding="utf-8")
    system = system_path.read_text(encoding="utf-8")

    # Frontend contract: this patch is only for the current V31 live System View.
    required_frontend = [
        "new EventSource('/api/system/stream')",
        "connectSystemStreamV31",
        "runCreateRouteV31",
        "runTokenRouteV31",
    ]
    missing = [marker for marker in required_frontend if marker not in system]
    if missing:
        die("system.js is not the expected current live-system frontend; missing: " + ", ".join(missing))

    complete = all(
        marker in server
        for marker in (
            PATCH_ID,
            "const __systemViewStreamsV31 = new Set();",
            "if(url.pathname==='/api/system/stream'&&req.method==='GET')",
            "__systemViewEmitV31('token'",
            "__systemViewEmitV31('create'",
        )
    )
    if complete:
        print(f"[PATCH] {PATCH_ID} already installed; no changes needed.")
        return 0

    # Refuse to collide with an unrelated/partial implementation of the same route.
    if "/api/system/stream" in server and PATCH_ID not in server:
        die("app-server.mjs already contains /api/system/stream from another implementation. Refusing to overwrite it.")

    helpers = r'''

// MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V4
// Read-only System View event transport. No settings, decisions or positions are mutated here.
const __systemViewStreamsV31 = new Set();
let __systemViewSeqV31 = 0;
const __systemViewLastMintV31 = new Map();

function __systemViewEmitV31(type,payload={}){
  if(!__systemViewStreamsV31.size)return;

  const now=Date.now();
  if(type==='token'&&payload?.mint){
    const key=String(payload.mint);
    const previous=Number(__systemViewLastMintV31.get(key)||0);
    // publish() can fire multiple times in the same tick; keep the visual stream bounded.
    if(now-previous<18)return;
    __systemViewLastMintV31.set(key,now);
    if(__systemViewLastMintV31.size>1000){
      for(const [mint,ts] of __systemViewLastMintV31){
        if(now-ts>30000)__systemViewLastMintV31.delete(mint);
      }
    }
  }

  const eventType=String(type||'system').replace(/[^a-z0-9_-]/gi,'');
  const body=JSON.stringify({type:eventType,seq:++__systemViewSeqV31,ts:now,...payload});
  const frame=`event: ${eventType}\ndata: ${body}\n\n`;

  for(const res of [...__systemViewStreamsV31]){
    try{res.write(frame)}catch{__systemViewStreamsV31.delete(res)}
  }
}
'''

    stream_registry_pattern = r"const\s+streams\s*=\s*new Map\(\)[^;\n]*;"
    server = insert_after_match(server, stream_registry_pattern, helpers, "stream registry")

    route = r'''
 // MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V4_ROUTE
 if(url.pathname==='/api/system/stream'&&req.method==='GET'){
  res.writeHead(200,{
   'content-type':'text/event-stream; charset=utf-8',
   'cache-control':'no-cache, no-store, no-transform',
   'connection':'keep-alive',
   'x-accel-buffering':'no'
  });
  try{res.flushHeaders?.()}catch{}
  __systemViewStreamsV31.add(res);

  try{
   res.write(`retry: 1000\nevent: hello\ndata: ${JSON.stringify({type:'hello',seq:__systemViewSeqV31,ts:Date.now()})}\n\n`);
  }catch{}

  const heartbeat=setInterval(()=>{
   try{res.write(`: v31 ${Date.now()}\n\n`)}catch{}
  },15000);
  heartbeat.unref?.();

  let closed=false;
  const closeSystemStream=()=>{
   if(closed)return;
   closed=true;
   clearInterval(heartbeat);
   __systemViewStreamsV31.delete(res);
  };
  req.on('close',closeSystemStream);
  res.on('close',closeSystemStream);
  return;
 }

'''
    chart_route_pattern = r"(?m)^[ \t]*if\s*\(\s*url\.pathname\s*===\s*['\"]\/api\/chart\/stream['\"]\s*\)"
    server = insert_before_match(server, chart_route_pattern, route, "chart stream route")

    # Emit actual token-pipeline impulses from the existing publish() cadence.
    publish_pattern = r"function\s+publish\s*\(\s*mint\s*\)\s*\{"
    matches = list(re.finditer(publish_pattern, server, flags=re.M))
    if len(matches) != 1:
        die(f"publish(mint): expected exactly 1 function, found {len(matches)}")
    m = matches[0]
    publish_hook = r'''
  // V4 System View: actual backend publish cadence drives the 3D/token-flow impulse.
  if(__systemViewStreamsV31.size){
   try{
    const __v31t=store?.state?.tokens?.[mint]||{};
    __systemViewEmitV31('token',{
     mint:String(mint||''),
     updatedAt:Number(__v31t?.updatedAt||Date.now())
    });
   }catch{}
  }
'''
    server = server[: m.end()] + publish_hook + server[m.end() :]

    # Emit only after the existing Pump CREATE filter has accepted the event.
    accepted_pattern = r"(?m)^(\s*)discMetrics\.createEventsAccepted\+\+;"
    accepted_matches = list(re.finditer(accepted_pattern, server))
    if len(accepted_matches) != 1:
        die(f"Pump CREATE accepted anchor: expected exactly 1, found {len(accepted_matches)}")
    a = accepted_matches[0]
    indent = a.group(1)
    create_hook = (
        f"{indent}// V4 System View: accepted real Pump CREATE event.\n"
        f"{indent}try{{__systemViewEmitV31('create',{{signature:String(sig||''),ts:Date.now()}})}}catch{{}}\n"
    )
    server = server[: a.start()] + create_hook + server[a.start() :]

    # Semantic postconditions before touching disk.
    required_server = [
        PATCH_ID,
        "const __systemViewStreamsV31 = new Set();",
        "if(url.pathname==='/api/system/stream'&&req.method==='GET')",
        "__systemViewEmitV31('token'",
        "__systemViewEmitV31('create'",
        "event: hello",
    ]
    missing_server = [marker for marker in required_server if marker not in server]
    if missing_server:
        die("internal validation failed; missing: " + ", ".join(missing_server))

    if server.count("if(url.pathname==='/api/system/stream'&&req.method==='GET')") != 1:
        die("internal validation failed: system stream route count is not 1")
    if server.count("__systemViewEmitV31('token'") != 1:
        die("internal validation failed: token hook count is not 1")
    if server.count("__systemViewEmitV31('create'") != 1:
        die("internal validation failed: create hook count is not 1")

    server_path.write_text(server, encoding="utf-8")
    print(f"[PATCH] patched: {server_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[PATCH] ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
