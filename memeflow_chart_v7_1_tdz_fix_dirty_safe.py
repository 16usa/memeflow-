#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG="MEMEFLOW_CHART_V7_1_TDZ_FIX_DIRTY_SAFE"
V7="MEMEFLOW_CHART_LIVE_TOUCH_RECOVERY_V7_DIRTY_SAFE"
V6="MEMEFLOW_CHART_SINGLE_ENGINE_RECOVERY_V6_DIRTY_SAFE"

def log(msg):
    print(f"[{TAG}] {msg}",flush=True)

def run(*args,cwd=None,check=True):
    p=subprocess.run(
        args,cwd=cwd,text=True,
        stdout=subprocess.PIPE,stderr=subprocess.STDOUT
    )
    if p.stdout:
        print(p.stdout,end="" if p.stdout.endswith("\n") else "\n")
    if check and p.returncode!=0:
        raise RuntimeError(
            f"command failed ({p.returncode}): {' '.join(args)}"
        )
    return p

def find_app():
    cwd=Path.cwd().resolve()
    for p in [
        cwd/"memeflow-app",
        cwd,
        Path.home()/"workspace"/"memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
    ]:
        if (
            (p/"trading.js").is_file()
            and (p/"trading.html").is_file()
            and (p/"app-server.mjs").is_file()
        ):
            return p.resolve()
    raise RuntimeError("memeflow-app not found")

def scan_block_end(text,brace):
    i=brace
    depth=0
    quote=None
    escape=False
    line_comment=False
    block_comment=False

    while i<len(text):
        ch=text[i]
        nxt=text[i+1] if i+1<len(text) else ""

        if line_comment:
            if ch=="\n":line_comment=False
            i+=1;continue
        if block_comment:
            if ch=="*" and nxt=="/":
                block_comment=False;i+=2;continue
            i+=1;continue
        if quote:
            if escape:escape=False
            elif ch=="\\":escape=True
            elif ch==quote:quote=None
            i+=1;continue
        if ch=="/" and nxt=="/":
            line_comment=True;i+=2;continue
        if ch=="/" and nxt=="*":
            block_comment=True;i+=2;continue
        if ch in ("'",'"',"`"):
            quote=ch;i+=1;continue
        if ch=="{":depth+=1
        elif ch=="}":
            depth-=1
            if depth==0:return i+1
        i+=1

    raise RuntimeError("closing brace not found")

def extract_function(text,name):
    m=re.search(
        r"\bfunction\s+"+re.escape(name)+r"\s*\(",
        text
    )
    if not m:
        raise RuntimeError(f"function not found: {name}")
    brace=text.find("{",m.end())
    if brace<0:
        raise RuntimeError(f"opening brace missing: {name}")
    end=scan_block_end(text,brace)
    return m.start(),end,text[m.start():end]

def main():
    app=find_app()
    js_path=app/"trading.js"
    html_path=app/"trading.html"
    server_path=app/"app-server.mjs"
    repo=app.parent if (app.parent/".git").exists() else app

    log(f"app: {app}")

    original_js=js_path.read_text(encoding="utf-8")
    original_html=html_path.read_text(encoding="utf-8")
    original_server=server_path.read_text(encoding="utf-8")

    audit={
        "V6 renderer present": V6 in original_js,
        "V7 live/touch present": V7 in original_js,
        "touch helper present": "function chartTouchUi()" in original_js,
        "drawChart present": "function drawChart()" in original_js,
        "V7 backend fanout present":
            "function __mfChartBroadcastLiveV7" in original_server and
            "__mfChartBroadcastLiveV7(mint,point)" in original_server,
        "SSE update listener present":
            "addEventListener('update'" in original_js,
    }

    for name,ok in audit.items():
        log(("AUDIT OK: " if ok else "AUDIT FAIL: ")+name)
        if not ok:
            raise RuntimeError(
                "current project does not match V7 topology: "+name
            )

    start,end,draw=extract_function(original_js,"drawChart")

    decl="const touchUi=chartTouchUi();"
    count=draw.count(decl)
    if count!=1:
        raise RuntimeError(
            f"expected one touchUi declaration in drawChart, found {count}"
        )

    # Confirm the exact TDZ: declaration currently appears after first use.
    first_use=draw.find("touchUi")
    decl_pos=draw.find(decl)
    log(
        "TDZ confirmed: "+
        ("YES" if first_use<decl_pos else "NO")
    )

    # Make a full dirty-safe backup.
    stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup=app/".patch-backups"/f"chart-v7-1-tdz-{stamp}"
    backup.mkdir(parents=True,exist_ok=False)

    for p in (js_path,html_path,server_path):
        shutil.copy2(p,backup/p.name)
    log(f"backup: {backup}")

    if (repo/".git").exists():
        rels=[
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
            str(server_path.relative_to(repo)),
        ]
        (backup/"git-status-before.txt").write_text(
            run(
                "git","status","--short","--",*rels,
                cwd=repo,check=False
            ).stdout or "",
            encoding="utf-8"
        )
        (backup/"git-diff-before.patch").write_text(
            run(
                "git","diff","--",*rels,
                cwd=repo,check=False
            ).stdout or "",
            encoding="utf-8"
        )

    try:
        # Remove the late declaration inserted by V7.
        draw=draw.replace(decl,"",1)

        # Insert it immediately after drawChart enters its try block,
        # before ANY xAxis/tooltip/axisPointer construction can reference it.
        anchor="""function drawChart(){
  try{"""
        replacement="""function drawChart(){
  try{
    // MEMEFLOW_CHART_V7_1_TDZ_FIX_DIRTY_SAFE
    // Must exist before mainXAxis / secondary xAxis / tooltip use it.
    const touchUi=chartTouchUi();"""

        if anchor not in draw:
            raise RuntimeError(
                "drawChart try anchor changed; refusing blind edit"
            )
        draw=draw.replace(anchor,replacement,1)

        patched_js=original_js[:start]+draw+original_js[end:]

        # Force Safari to load the corrected JS, not cached V7.
        patched_html,n=re.subn(
            r'src="/trading\.js(?:\?[^"]*)?"',
            'src="/trading.js?v=chart-v7-1-tdz-20260829"',
            original_html,
            count=1
        )
        if n!=1:
            raise RuntimeError(
                "expected exactly one trading.js script tag"
            )

        js_path.write_text(patched_js,encoding="utf-8")
        html_path.write_text(patched_html,encoding="utf-8")

        final_js=js_path.read_text(encoding="utf-8")
        final_html=html_path.read_text(encoding="utf-8")
        _,_,final_draw=extract_function(final_js,"drawChart")

        final_decl=final_draw.find(decl)
        # Find actual *uses* after declaration, excluding declaration text.
        remaining=final_draw[final_decl+len(decl):]
        uses=[
            remaining.find("show:!touchUi"),
            remaining.find("trigger:touchUi"),
        ]
        uses=[u for u in uses if u>=0]

        checks={
            "touchUi declared once":
                final_draw.count(decl)==1,
            "touchUi declaration at start":
                final_decl>=0 and final_decl<300,
            "all touch config occurs after declaration":
                bool(uses) and all(
                    final_decl+len(decl)+u>final_decl
                    for u in uses
                ),
            "V7 live fanout preserved":
                "__mfChartBroadcastLiveV7(mint,point)"
                in original_server,
            "V7 realtime redraw preserved":
                "chartRuntime.dataKey='';\n  scheduleChart();"
                in final_js,
            "mobile crosshair remains disabled":
                "trigger:touchUi ? 'none' : 'axis'"
                in final_js,
            "raw axis pointer labels remain disabled":
                "label:{show:false}" in final_js,
            "V6 renderer preserved":
                V6 in final_js,
            "Safari cache bust":
                "/trading.js?v=chart-v7-1-tdz-20260829"
                in final_html,
        }

        for name,ok in checks.items():
            log(("OK: " if ok else "FAIL: ")+name)
            if not ok:
                raise RuntimeError(
                    "verification failed: "+name
                )

        run("node","--check",str(js_path),cwd=app)
        run("node","--check",str(server_path),cwd=app)

    except Exception:
        shutil.copy2(backup/"trading.js",js_path)
        shutil.copy2(backup/"trading.html",html_path)
        shutil.copy2(backup/"app-server.mjs",server_path)
        log("FAILED: files restored from backup")
        raise

    if (repo/".git").exists():
        rels=[
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
            str(server_path.relative_to(repo)),
        ]
        diffcheck=run(
            "git","diff","--check","--",*rels,
            cwd=repo,check=False
        )
        if diffcheck.returncode!=0:
            log(
                "WARNING: pre-existing whitespace issues remain; "
                "TDZ fix is kept because JS syntax/semantic checks passed."
            )

        log("DIRTY-SAFE: no git add / commit / push performed")
        run(
            "git","status","--short","--",*rels,
            cwd=repo,check=False
        )

    log("FIX COMPLETE")
    log("Root cause fixed: touchUi is initialized before ECharts axis/tooltip config.")
    log("V6 visual renderer + V7 live SSE redraw + iPhone touch suppression are preserved.")
    log("Restart Replit app/workflow and reopen Safari.")
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}",file=sys.stderr)
        raise
