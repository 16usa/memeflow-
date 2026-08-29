#!/usr/bin/env python3
from pathlib import Path
import json, os, re, subprocess, urllib.request, urllib.error

TAG="MEMEFLOW_SIRIUS_CHART_FAST_DIAG_V2_3"
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
        "rg","-a","-n","-i","-m","60",
        "--glob","!node_modules/**",
        "--glob","!.git/**",
        "--glob","!.patch-backups/**",
        "--glob","!*.map",
        pattern,
    ] + [str(p) for p in paths if p.exists()]
    try:
        p=subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=timeout,
            check=False
        )
        return (p.stdout or b"").decode("utf-8","replace")
    except FileNotFoundError:
        return ""
    except subprocess.TimeoutExpired as e:
        raw=e.stdout or b""
        if isinstance(raw,str):
            return raw
        return raw.decode("utf-8","replace")

def extract_mints(text):
    vals=re.findall(r"[1-9A-HJ-NP-Za-km-z]{32,64}", text or "")
    out=[]
    for v in vals:
        if v not in out:
            out.append(v)
    return out

print("\n===== FAST LOCAL SEARCH =====", flush=True)

# Prefer text-like data files first to avoid large/binary stores.
search_roots=[]
for p in [
    APP/"data"/"tokens.json",
    APP/"data"/"store.json",
    APP/"data"/"state.json",
    APP/"data",
]:
    if p.exists():
        search_roots.append(p)

text=run_rg(search_roots, r"CAamcCF|SIRIUS|The first bitcoin cat", timeout=8)
if not text:
    text=run_rg([APP], r"CAamcCF|SIRIUS|The first bitcoin cat", timeout=10)

print(text[:6000] if text else "NO TEXT MATCHES", flush=True)

mints=extract_mints(text)
mint=next((m for m in mints if m.startswith(PREFIX)), None)

if not mint:
    prefix_text=run_rg(search_roots, PREFIX, timeout=8)
    if not prefix_text:
        prefix_text=run_rg([APP], PREFIX, timeout=10)
    for m in extract_mints(prefix_text):
        if m.startswith(PREFIX):
            mint=m
            break

print("\n===== RESOLVED MINT =====")
print(mint or "NOT FOUND", flush=True)

if not mint:
    print(f"\n[{TAG}] Full SIRIUS mint was not found locally.")
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
        print(json.dumps(json.loads(meta.read_text(encoding="utf-8",errors="replace")),
                         indent=2,ensure_ascii=False))
    except Exception as e:
        print("META ERROR:",e)

if ptsfile.exists():
    print("\n===== ARCHIVE POINT COUNTS =====")
    try:
        with ptsfile.open("rb") as f:
            n=sum(1 for line in f if line.strip())
        print("jsonl lines:",n)
    except Exception as e:
        print("POINT COUNT ERROR:",e)

print("\n===== STREAM FIRST FRAME (6 sec max) =====", flush=True)
port=os.environ.get("PORT","3000")
try:
    subprocess.run(
        ["bash","-lc",
         f"timeout 6 curl -sN 'http://127.0.0.1:{port}/api/chart/stream?tokenAddress={mint}' | head -50"],
        timeout=8,
        check=False
    )
except Exception as e:
    print("STREAM ERROR:",e)

print(f"\n[{TAG}] DONE")
