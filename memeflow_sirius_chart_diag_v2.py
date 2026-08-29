#!/usr/bin/env python3
import json, os, pathlib, re, sqlite3, subprocess, urllib.request, urllib.error

TAG="MEMEFLOW_SIRIUS_CHART_DIAG_V2"
APP=Path.home()/"workspace"/"memeflow-app"
if not APP.exists():
    APP=Path("/home/runner/workspace/memeflow-app")
if not APP.exists():
    raise SystemExit(f"[{TAG}] memeflow-app not found")

BASE=f"http://127.0.0.1:{os.environ.get('PORT','3000')}"
needle_names=("sirius","the first bitcoin cat")
needle_prefix="CAamcCF"

print(f"[{TAG}] app: {APP}")
print(f"[{TAG}] base: {BASE}")

candidates=[]

def add(mint, source, context=""):
    mint=str(mint or "").strip()
    if re.fullmatch(r"[1-9A-HJ-NP-Za-km-z]{32,64}", mint):
        row=(mint,source,context[:240])
        if row not in candidates:
            candidates.append(row)

# 1) Search ordinary text/state files.
for root in [APP/"data", APP]:
    if not root.exists():
        continue
    for p in root.rglob("*"):
        try:
            if not p.is_file() or p.stat().st_size > 80_000_000:
                continue
            if p.suffix.lower() not in {".json",".jsonl",".txt",".log",".ndjson",".mjs",".js"}:
                continue
            text=p.read_text(encoding="utf-8",errors="ignore")
        except Exception:
            continue
        low=text.lower()
        if needle_prefix.lower() not in low and not any(n in low for n in needle_names):
            continue
        for m in re.finditer(r"[1-9A-HJ-NP-Za-km-z]{32,64}", text):
            val=m.group(0)
            lo=max(0,m.start()-350); hi=min(len(text),m.end()+350)
            ctx=text[lo:hi]
            lctx=ctx.lower()
            if (needle_prefix.lower() in val.lower()
                or needle_prefix.lower() in lctx
                or any(n in lctx for n in needle_names)):
                add(val, str(p.relative_to(APP)), ctx.replace("\n"," "))

# 2) Search SQLite databases if state is persisted there.
for p in (APP/"data").rglob("*") if (APP/"data").exists() else []:
    try:
        if not p.is_file() or p.suffix.lower() not in {".db",".sqlite",".sqlite3"}:
            continue
        con=sqlite3.connect(f"file:{p}?mode=ro", uri=True)
        cur=con.cursor()
        tables=[r[0] for r in cur.execute("select name from sqlite_master where type='table'")]
        for table in tables:
            try:
                cols=[r[1] for r in cur.execute(f'pragma table_info("{table}")')]
            except Exception:
                continue
            textcols=[]
            for c in cols:
                lc=c.lower()
                if any(k in lc for k in ("mint","token","symbol","name","data","json","payload","state")):
                    textcols.append(c)
            if not textcols:
                continue
            # Keep this bounded and read-only.
            sel=", ".join([f'"{c}"' for c in textcols[:8]])
            try:
                rows=cur.execute(f'SELECT {sel} FROM "{table}" LIMIT 20000').fetchall()
            except Exception:
                continue
            for row in rows:
                joined=" ".join("" if v is None else str(v) for v in row)
                low=joined.lower()
                if needle_prefix.lower() not in low and not any(n in low for n in needle_names):
                    continue
                for val in re.findall(r"[1-9A-HJ-NP-Za-km-z]{32,64}", joined):
                    if needle_prefix.lower() in val.lower() or any(n in low for n in needle_names):
                        add(val, f"{p.relative_to(APP)}::{table}", joined)
        con.close()
    except Exception:
        pass

# Prefer visible mint prefix first.
candidates.sort(key=lambda x: (0 if x[0].startswith(needle_prefix) else 1, x[1], x[0]))

print("\n===== SIRIUS MINT CANDIDATES =====")
for i,(mint,src,ctx) in enumerate(candidates[:20],1):
    print(f"{i}. {mint}")
    print(f"   source: {src}")
    if ctx:
        c=ctx
        for n in needle_names:
            j=c.lower().find(n)
            if j>=0:
                c=c[max(0,j-100):j+180]
                break
        print(f"   context: {c[:300]}")
if not candidates:
    print("NONE FOUND")
    raise SystemExit(f"[{TAG}] Could not resolve SIRIUS mint from local data.")

mint=candidates[0][0]
print(f"\n[{TAG}] selected mint: {mint}")

def get_json(path, timeout=20):
    req=urllib.request.Request(BASE+path, headers={"Accept":"application/json"})
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            return r.status, r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8","replace")

print("\n===== HISTORY API =====")
code,body=get_json("/api/chart/history?tokenAddress="+mint)
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
    print(body[:4000])

archive=APP/"data"/"chart-history-v30-10"
meta=archive/f"{mint}.meta.json"
points=archive/f"{mint}.jsonl"

print("\n===== ARCHIVE FILES =====")
print(json.dumps({
    "dirExists":archive.exists(),
    "metaExists":meta.exists(),
    "pointsExists":points.exists(),
    "pointsBytes":points.stat().st_size if points.exists() else 0
},indent=2))

if meta.exists():
    print("\n===== ARCHIVE META =====")
    try:
        print(json.dumps(json.loads(meta.read_text()),indent=2,ensure_ascii=False))
    except Exception as e:
        print("meta read error:",e)

if points.exists():
    print("\n===== ARCHIVE POINT SAMPLE =====")
    lines=[]
    try:
        with points.open("r",encoding="utf-8",errors="ignore") as f:
            for line in f:
                if line.strip():
                    lines.append(line.strip())
                    if len(lines)>=3:
                        break
        print("first:")
        for line in lines:
            print(line[:800])
        # tail using shell avoids loading huge file.
        print("last:")
        subprocess.run(["bash","-lc",f"tail -3 {str(points)!r} | head -c 2500"])
        print()
    except Exception as e:
        print("points read error:",e)

print("\n===== STREAM FIRST FRAME (6 sec max) =====")
try:
    port=os.environ.get("PORT","3000")
    subprocess.run([
        "bash","-lc",
        f"timeout 6 curl -sN 'http://127.0.0.1:{port}/api/chart/stream?tokenAddress={mint}' | head -50"
    ],timeout=8)
except Exception as e:
    print("stream error:",e)

print(f"\n[{TAG}] DONE")
