#!/usr/bin/env python3
import json, os, pathlib, subprocess, sys, urllib.request

TAG="MEMEFLOW_CHART_RUNTIME_DIAG_V1"
BASE=f"http://127.0.0.1:{os.environ.get('PORT','3000')}"

def get(path, timeout=8):
    with urllib.request.urlopen(BASE+path, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8","replace"))

def out(title, value):
    print(f"\n===== {title} =====")
    print(json.dumps(value, indent=2, ensure_ascii=False))

print(f"[{TAG}] base: {BASE}")

try:
    health=get("/api/health")
    out("HEALTH", health)
except Exception as e:
    print(f"[{TAG}] HEALTH ERROR: {e}")

status={}
try:
    status=get("/api/discovery/status")
    live=status.get("liveTradeFeed")
    if live is None:
        live=((status.get("pump") or {}).get("trade")
              or (status.get("discovery") or {}).get("liveTradeFeed"))
    if not isinstance(live, dict):
        live={}
    keys=[
        "connected","notifications","logBatchesIngested","dedicatedLogBatches",
        "externalLogBatches","programDataSeen","tradeEventsDecoded",
        "duplicateTradeEventsSkipped","unknownMintEventsIgnored","marketSnapshots",
        "lastTradeEventAt","lastTradeEventSource","lastStoreUpdateAt",
        "lastStoreUpdateMint","lastError","decodeErrors"
    ]
    out("LIVE TRADE FEED", {k:live.get(k) for k in keys if k in live} or {"raw": live})
except Exception as e:
    print(f"[{TAG}] DISCOVERY STATUS ERROR: {e}")

mint=""
selected={}
try:
    d=get("/api/ai/decisions?scope=candidates&limit=100")
    rows=d.get("decisions") or []
    for x in rows:
        s=(str(x.get("symbol",""))+" "+str(x.get("name",""))).lower()
        if "sirius" in s:
            selected=x
            break
    if not selected and rows:
        selected=rows[0]
    mint=str(selected.get("mint") or selected.get("tokenAddress") or "")
    out("SELECTED CANDIDATE", {
        "symbol":selected.get("symbol"),
        "name":selected.get("name"),
        "mint":mint,
        "priceSol":selected.get("priceSol"),
        "state":selected.get("state"),
    })
except Exception as e:
    print(f"[{TAG}] CANDIDATE ERROR: {e}")

if mint:
    try:
        h=get("/api/chart/history?tokenAddress="+mint, timeout=15)
        pts=h.get("points") or []
        out("CHART HISTORY", {
            "points":len(pts),
            "first":pts[0] if pts else None,
            "last":pts[-1] if pts else None,
            "status":h.get("status"),
            "tokenAddress":h.get("tokenAddress"),
        })
    except Exception as e:
        print(f"[{TAG}] HISTORY ERROR: {e}")

    app=pathlib.Path.home()/ "workspace" / "memeflow-app"
    if not app.exists():
        app=pathlib.Path.cwd()/ "memeflow-app"
    hist=app/"data"/"chart-history-v30-10"
    meta=hist/f"{mint}.meta.json"
    points=hist/f"{mint}.jsonl"
    out("ARCHIVE FILES", {
        "metaExists":meta.exists(),
        "pointsExists":points.exists(),
        "pointsBytes":points.stat().st_size if points.exists() else 0,
    })
    if meta.exists():
        try:
            out("ARCHIVE META", json.loads(meta.read_text()))
        except Exception as e:
            print(f"[{TAG}] META READ ERROR: {e}")

    print("\n===== STREAM FIRST FRAME (5 sec max) =====")
    try:
        port=os.environ.get("PORT","3000")
        cmd=["bash","-lc",
             f"timeout 5 curl -sN 'http://127.0.0.1:{port}/api/chart/stream?tokenAddress={mint}' | head -30"]
        subprocess.run(cmd, timeout=7)
    except Exception as e:
        print(f"[{TAG}] STREAM ERROR: {e}")

print(f"\n[{TAG}] DONE")
