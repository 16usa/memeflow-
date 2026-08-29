#!/usr/bin/env python3
from pathlib import Path
import json, os, re, subprocess, urllib.request, urllib.error

TAG="MEMEFLOW_SIRIUS_CHART_FAST_DIAG_V2_2"
APP=Path.home()/"workspace"/"memeflow-app"
if not APP.exists():
    APP=Path("/home/runner/workspace/memeflow-app")
if not APP.exists():
    raise SystemExit(f"[{TAG}] memeflow-app not found")

BASE=f"http://127.0.0.1:{os.environ.get('PORT','3000')}"
PREFIX="CAamcCF"

print(f"[{TAG}] app: {APP}", flush=True)
print(f"[{TAG}] base: {BASE}", flush=True)

def run_rg(paths, pattern, timeout=8):
    cmd=[
        "rg","-a","-n","-i","-m","40",
        "--glob","!node_modules/**",
        "--glob","!.git/**",
        "--glob","!.patch-backups/**",
        "--glob","!*.map",
        pattern,
    ] + [str(p) for p in paths if p.exists()]
    try:
        p=subprocess.run(cmd, text=True, stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL, timeout=timeout)
        return p.stdout or ""
    except FileNotFoundError:
        return ""
    except subprocess.TimeoutExpired as e:
        return (e.stdout or "") if isinstance(e.stdout,str) else ""

def extract_mints(text):
    vals=re.findall(r"[1-9A-HJ-NP-Za-km-z]{32,64}", text or "")
    out=[]
    for v in vals:
        if v not in out:
            out.append(v)
    return out

# Fast path: only data directory first.
print("\n===== FAST LOCAL SEARCH =====", flush=True)
text=run_rg([APP/"data"], r"CAamcCF|SIRIUS|The first bitcoin cat")
if not text:
    # Limited project search, still excludes heavy dirs.
    text=run_rg([APP], r"CAamcCF|SIRIUS|The first bitcoin cat", timeout=10)

print((text[:5000] if text else "NO TEXT MATCHES"), flush=True)

mints=extract_mints(text)
mint=next((m for m in mints if m.startswith(PREFIX)), None)

# If context only had a shortened address, search all base58 strings beginning
# with the visible prefix, but still only in data first.
if not mint:
    prefix_text=run_rg([APP/"data"], PREFIX, timeout=8)
    if not prefix_text:
        prefix_text=run_rg([APP], PREFIX, timeout=10)
    for m in extract_mints(prefix_text):
        if m.startswith(PREFIX):
            mint=m
            break

print("\n===== RESOLVED MINT =====")
print(mint or "NOT FOUND", flush=True)

if not mint:
    print(f"\n[{TAG}] Could not resolve full SIRIUS mint from local files.")
    print(f"[{TAG}] DONE")
    raise SystemExit(0)

def get(path, timeout=20):
    req=urllib.request.Request(BASE+path,headers={"Accept":"application/json"})
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            return r.status,r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e:
        return e.code,e.read().decode("utf-8","replace")

print("\n===== HISTORY API =====", flush=True)
code,body=get("/api/chart/history?tokenAddress="+mint, timeout=20)
print("HTTP",code)
try:
    j=json.loads(body)
    pts=j.get("points") or []
    print(json.dumps({
        "points":len(pts),
        "first":pts[0] if pts else None,
        "last":pts[-1] if pts else None,
        "status":j.get("status"),
        "tokenAddress":j.get("tokenAddress"),
    },indent=2,ensure_ascii=False))
except Exception:
    print(body[:5000])

archive=APP/"data"/"chart-history-v30-10"
meta=archive/f"{mint}.meta.json"
ptsfile=archive/f"{mint}.jsonl"

print("\n===== ARCHIVE =====")
print(json.dumps({
    "directory":str(archive),
    "directoryExists":archive.exists(),
    "metaExists":meta.exists(),
    "pointsExists":ptsfile.exists(),
    "pointsBytes":ptsfile.stat().st_size if ptsfile.exists() else 0,
},indent=2))

if meta.exists():
    print("\n===== ARCHIVE META =====")
    try:
        print(json.dumps(json.loads(meta.read_text()),indent=2,ensure_ascii=False))
    except Exception as e:
        print("META ERROR:",e)

print("\n===== STREAM FIRST FRAME (6 sec max) =====", flush=True)
port=os.environ.get("PORT","3000")
try:
    subprocess.run(
        ["bash","-lc",
         f"timeout 6 curl -sN 'http://127.0.0.1:{port}/api/chart/stream?tokenAddress={mint}' | head -50"],
        timeout=8
    )
except Exception as e:
    print("STREAM ERROR:",e)

print(f"\n[{TAG}] DONE")
