#!/usr/bin/env python3
from pathlib import Path
import datetime, re, subprocess, sys

TAG="MEMEFLOW_CHART_CLEANUP_BACKPRESSURE_V10_DIRTY_SAFE"
CANONICAL_CSS='\n/* MEMEFLOW_CHART_CANONICAL_SURFACE_V10 */\n.chart-wrap {\n  position: relative;\n  height: 455px;\n  overflow: hidden;\n  isolation: isolate;\n  z-index: 0;\n  background: #131b23;\n}\n#chartCanvas {\n  position: absolute;\n  inset: 0;\n  z-index: 1;\n  display: block;\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n  background: #131b23;\n  touch-action: pan-y;\n  -webkit-user-select: none;\n  user-select: none;\n}\n#chartCanvas > div {\n  width: 100% !important;\n  height: 100% !important;\n  overflow: hidden !important;\n}\n#chartCanvas canvas { outline: 0; }\n.chart-legend {\n  position: absolute;\n  top: 8px;\n  left: 10px;\n  z-index: 6;\n  max-width: calc(100% - 24px);\n  display: flex;\n  flex-wrap: wrap;\n  gap: 7px;\n  pointer-events: none;\n}\n.chart-empty {\n  position: absolute;\n  inset: 0;\n  z-index: 7;\n  display: grid;\n  place-content: center;\n  gap: 6px;\n  text-align: center;\n  pointer-events: none;\n}\n@media (max-width: 820px) {\n  .chart-wrap { height: 365px; }\n}\n@media (max-width: 430px) {\n  .chart-wrap { height: 350px; }\n}\n'
OLD_CACHE="   const isLiveTokenAsset=\n     url.pathname==='/system-tokens.js' ||\n     url.pathname==='/system-tokens.css';\n   const noStoreAsset=isHTML||isLiveTokenAsset;"
NEW_CACHE="   const isLiveTokenAsset=\n     url.pathname==='/system-tokens.js' ||\n     url.pathname==='/system-tokens.css';\n\n   // MEMEFLOW_TRADING_NO_STORE_V10\n   const isTradingDevAsset=\n     url.pathname==='/trading.html' ||\n     url.pathname==='/trading.js' ||\n     url.pathname==='/trading.css';\n\n   const noStoreAsset=isHTML||isLiveTokenAsset||isTradingDevAsset;"
RPC_HELPER="  async _rpcCallWithRetry(method, args = [], {\n    attempts = 6,\n    baseDelayMs = 350\n  } = {}) {\n    let lastError = null;\n    for (let attempt = 0; attempt < attempts; attempt++) {\n      try {\n        return await this.rpc.call(method, args);\n      } catch (error) {\n        lastError = error;\n        const message = String(error?.message || error || '');\n        const limited =\n          /429|too many requests|rate limit|specific RPC call/i.test(message);\n        if (!limited || attempt >= attempts - 1) throw error;\n        const delay =\n          Math.min(6000, baseDelayMs * Math.pow(2, attempt)) +\n          Math.floor(Math.random() * 180);\n        await new Promise(resolve => setTimeout(resolve, delay));\n      }\n    }\n    throw lastError || new Error('chart history RPC failed');\n  }\n\n"
DIRECT_JOB='    const job = this._runBackfill(safe, onProgress)\n      .finally(() => {\n        if (this.inFlight.get(safe) === job) {\n          this.inFlight.delete(safe);\n        }\n      });\n\n    this.inFlight.set(safe, job);\n    return job;'
QUEUED_JOB='    const job = this.backfillQueue\n      .catch(() => {})\n      .then(() => this._runBackfill(safe, onProgress))\n      .finally(() => {\n        if (this.inFlight.get(safe) === job) {\n          this.inFlight.delete(safe);\n        }\n      });\n\n    this.backfillQueue = job.catch(() => {});\n    this.inFlight.set(safe, job);\n    return job;'
Y_ANCHOR='        scale:true,\n        axisLine:{show:false},'
Y_NEW='        scale:true,\n        min:value=>{\n          const span=Math.max(\n            Number(value?.max||0)-Number(value?.min||0),\n            Math.abs(Number(value?.max||1))*.01\n          );\n          return Math.max(0,Number(value?.min||0)-span*.08);\n        },\n        max:value=>{\n          const span=Math.max(\n            Number(value?.max||0)-Number(value?.min||0),\n            Math.abs(Number(value?.max||1))*.01\n          );\n          return Number(value?.max||0)+span*.08;\n        },\n        axisLine:{show:false},'

def log(msg):
    print(f"[{TAG}] {msg}", flush=True)

def run(*args,cwd=None,check=True):
    p=subprocess.run(args,cwd=cwd,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    if p.stdout:
        print(p.stdout,end="" if p.stdout.endswith("\n") else "\n")
    if check and p.returncode!=0:
        raise RuntimeError(f"command failed ({p.returncode}): {' '.join(args)}")
    return p

def find_app():
    cands=[
        Path.cwd()/ "memeflow-app",
        Path.cwd(),
        Path.home()/ "workspace"/ "memeflow-app",
        Path("/home/runner/workspace/memeflow-app")
    ]
    for p in cands:
        p=p.resolve()
        if all((p/x).is_file() for x in (
            "trading.html","trading.css","trading.js",
            "app-server.mjs","src/chart-history-archive.mjs"
        )):
            return p
    raise RuntimeError("memeflow-app not found")

def remove_marked(text,start_marker,end_marker):
    s=text.find(start_marker)
    if s<0:
        return text,False
    e=text.find(end_marker,s)
    if e<0:
        raise RuntimeError("missing end marker: "+end_marker)
    e += len(end_marker)
    return text[:s]+text[e:],True

def clean_css(css):
    pats=[
        r'(?ms)^[ \t]*\.chart-wrap[ \t]*\{[^{}]*\}[ \t]*',
        r'(?ms)^[ \t]*#chartCanvas[ \t]*\{[^{}]*\}[ \t]*',
        r'(?ms)^[ \t]*#chartCanvas[ \t]*>[ \t]*div[ \t]*\{[^{}]*\}[ \t]*',
        r'(?ms)^[ \t]*#chartCanvas[ \t]+canvas[ \t]*\{[^{}]*\}[ \t]*',
        r'(?ms)^[ \t]*#chartCanvas,[ \t]*\n[ \t]*#chartCanvas[ \t]*>[ \t]*div[ \t]*\{[^{}]*\}[ \t]*',
        r'(?ms)^[ \t]*\.chart-legend[ \t]*\{[^{}]*\}[ \t]*',
        r'(?ms)^[ \t]*\.chart-empty[ \t]*\{[^{}]*\}[ \t]*',
    ]
    n=0
    for pat in pats:
        css,c=re.subn(pat,"\n",css)
        n+=c
    css += "\n"+CANONICAL_CSS.strip()+"\n"
    return css,n

def patch_html(html):
    html,a=remove_marked(
        html,'<style id="mfTradingChartUnifyAllStatesV4">','</style>'
    )
    html,b=remove_marked(
        html,
        '/* ===== MEMEFLOW_TRADING_CHART_UNIFY_ALL_STATES_V4 ===== */',
        '/* ===== /MEMEFLOW_TRADING_CHART_UNIFY_ALL_STATES_V4 ===== */'
    )
    html=re.sub(
        r'href="/trading\.css\?v=[^"]+"',
        'href="/trading.css?v=chart-clean-v10-20260829"',
        html,count=1
    )
    html=re.sub(
        r'src="/trading\.js\?v=[^"]+"',
        'src="/trading.js?v=chart-clean-v10-20260829"',
        html,count=1
    )
    return html,a,b

def patch_server(server):
    if OLD_CACHE in server:
        server=server.replace(OLD_CACHE,NEW_CACHE,1)
    elif "MEMEFLOW_TRADING_NO_STORE_V10" not in server:
        raise RuntimeError("static cache anchor changed")
    server=re.sub(
        r'(const __mfChartArchive=new ChartHistoryArchive\(\{[\s\S]*?txConcurrency:)\s*\d+',
        r'\g<1>1',
        server,count=1
    )
    if TAG not in server:
        server += "\n// "+TAG+"\n"
    return server

def patch_archive(archive):
    anchor="    this.inFlight = new Map();"
    if anchor in archive and "this.backfillQueue = Promise.resolve();" not in archive:
        archive=archive.replace(anchor,anchor+"\n    this.backfillQueue = Promise.resolve();",1)

    if "async _rpcCallWithRetry(" not in archive:
        m="  _transactionPoints(mint, signatureRow) {"
        if m not in archive:
            raise RuntimeError("_transactionPoints anchor missing")
        archive=archive.replace(m,RPC_HELPER+m,1)

    archive=archive.replace(
        "await this.rpc.call('getTransaction', [",
        "await this._rpcCallWithRetry('getTransaction', [",1
    )
    archive=archive.replace(
        "const rows = await this.rpc.call('getSignaturesForAddress', [",
        "const rows = await this._rpcCallWithRetry('getSignaturesForAddress', [",1
    )

    s=archive.find("  ensureBackfill(mint, { onProgress = null } = {}) {")
    if s<0:
        raise RuntimeError("active ensureBackfill not found")
    e=archive.find("\n  async _runBackfill",s)
    if e<0:
        raise RuntimeError("_runBackfill anchor missing")
    active=archive[s:e]

    if DIRECT_JOB in active:
        active=active.replace(DIRECT_JOB,QUEUED_JOB,1)
    elif "this.backfillQueue = job.catch(() => {});" not in active:
        raise RuntimeError("V9.1 queue anchor changed")

    archive=archive[:s]+active+archive[e:]
    if TAG not in archive:
        archive += "\n// "+TAG+"\n"
    return archive

def patch_js(js):
    js,n1=re.subn(r'(?m)^[ \t]*graphic:[ \t]*offscreenGraphics,[ \t]*\n','',js)
    js,n2=re.subn(
        r'(?ms)\n[ \t]*for\(const level of \(chartRuntime\.offscreenLevels\|\|\[\]\)\.slice\(0,3\)\)\{.*?\n[ \t]*\}\n',
        '\n',js,count=1
    )
    js,n3=re.subn(
        r"const levelInfo=typeof chartLevelInfo==='function'\?chartLevelInfo\(candles\):\{visible:\[\],offscreen:\[\]\};",
        "const levelInfo={visible:(typeof strategyLevels==='function'?strategyLevels():[]),offscreen:[]};",
        js,count=1
    )
    js,n4=re.subn(
        r'(?ms)const offscreenGraphics=\s*chartOffscreenLevelGraphicsV8\([^;]*?\);',
        'const offscreenGraphics=[];',js,count=1
    )
    js,n5=re.subn(r'(?m)^[ \t]*chartRuntime\.api\.clear\(\);[ \t]*\n','',js,count=1)

    if Y_ANCHOR in js and "MEMEFLOW_CHART_CANDLE_SCALE_V10" not in js:
        js=js.replace(Y_ANCHOR,Y_NEW,1)
        js += "\n/* MEMEFLOW_CHART_CANDLE_SCALE_V10 */\n"

    if TAG not in js:
        js += "\n/* "+TAG+" */\n"
    return js,{"graphic_removed":n1,"legend_removed":n2,"level_info_replaced":n3,"offscreen_disabled":n4,"clear_removed":n5}

def main():
    app=find_app()
    repo=app.parent if (app.parent/".git").exists() else app
    html_p=app/"trading.html"
    css_p=app/"trading.css"
    js_p=app/"trading.js"
    server_p=app/"app-server.mjs"
    archive_p=app/"src"/"chart-history-archive.mjs"
    files=[html_p,css_p,js_p,server_p,archive_p]
    original={p:p.read_text(encoding="utf-8") for p in files}

    log(f"app: {app}")
    guards={
        "V9.1 frontend present":"MEMEFLOW_CHART_HISTORY_LIVE_LEVELS_V9_1_DIRTY_SAFE" in original[js_p],
        "canonical stream client present":"/api/chart/stream?tokenAddress=" in original[js_p],
        "history archive present":"export class ChartHistoryArchive" in original[archive_p],
        "V9.1 backfill active":"this._runBackfill(safe, onProgress)" in original[archive_p],
        "legacy runtime painter present":"mfTradingChartUnifyAllStatesV4" in original[html_p],
    }
    for name,ok in guards.items():
        log(("AUDIT OK: " if ok else "AUDIT FAIL: ")+name)
        if not ok:
            raise RuntimeError("current build differs from audited state: "+name)

    stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup=app/".patch-backups"/f"chart-cleanup-v10-{stamp}"
    backup.mkdir(parents=True,exist_ok=False)
    for p,content in original.items():
        dest=backup/p.relative_to(app)
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(content,encoding="utf-8")
    log(f"backup: {backup}")

    try:
        html,a,b=patch_html(original[html_p])
        css,css_removed=clean_css(original[css_p])
        js,stats=patch_js(original[js_p])
        server=patch_server(original[server_p])
        archive=patch_archive(original[archive_p])

        html_p.write_text(html,encoding="utf-8")
        css_p.write_text(css,encoding="utf-8")
        js_p.write_text(js,encoding="utf-8")
        server_p.write_text(server,encoding="utf-8")
        archive_p.write_text(archive,encoding="utf-8")

        checks={
            "runtime painter removed":"mfTradingChartUnifyAllStatesV4" not in html,
            "cache bust updated":"chart-clean-v10-20260829" in html,
            "canonical CSS installed":"MEMEFLOW_CHART_CANONICAL_SURFACE_V10" in css,
            "trading assets no-store":"MEMEFLOW_TRADING_NO_STORE_V10" in server,
            "history global queue":"this.backfillQueue = job.catch(() => {});" in archive,
            "RPC retry/backoff":"async _rpcCallWithRetry(" in archive,
            "txConcurrency=1":re.search(r"txConcurrency:\s*1",server) is not None,
            "screen overlay removed":"graphic:offscreenGraphics" not in js,
            "clear per tick removed":"chartRuntime.api.clear();" not in js,
            "candle scale guard":"MEMEFLOW_CHART_CANDLE_SCALE_V10" in js,
        }
        for name,ok in checks.items():
            log(("OK: " if ok else "FAIL: ")+name)
            if not ok:
                raise RuntimeError("verification failed: "+name)

        log(f"CSS duplicate structural blocks removed: {css_removed}")
        log(f"HTML unify style removed: {a}")
        log(f"HTML unify script removed: {b}")
        for k,v in stats.items():
            log(f"JS {k}: {v}")

        run("node","--check",str(js_p),cwd=app)
        run("node","--check",str(server_p),cwd=app)
        run("node","--check",str(archive_p),cwd=app)

    except Exception:
        for p,content in original.items():
            p.write_text(content,encoding="utf-8")
        log("FAILED: all target files restored from backup")
        raise

    if (repo/".git").exists():
        rels=[str(p.relative_to(repo)) for p in files]
        run("git","diff","--check","--",*rels,cwd=repo,check=False)
        log("DIRTY-SAFE: no git add / commit / push performed")
        run("git","status","--short","--",*rels,cwd=repo,check=False)

    log("FIX COMPLETE")
    log("Removed CSS/runtime conflicts, screen-space level overlay, cache staleness, and history RPC stampede.")
    log("Restart Replit app/workflow, then fully close and reopen Safari.")
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}",file=sys.stderr)
        raise
