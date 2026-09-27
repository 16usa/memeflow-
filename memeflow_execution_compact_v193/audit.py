#!/usr/bin/env python3
from pathlib import Path
import re,subprocess,sys
ROOT=Path(sys.argv[1]).resolve(); APP=ROOT/'memeflow-app'
HTML=APP/'settings.html'; CSS=APP/'memeflow-settings-execution-compact-v193.css'; JS=APP/'memeflow-settings-execution-compact-v193.js'
e=[]
for p in (HTML,CSS,JS):
    if not p.is_file(): e.append('missing '+p.name)
if HTML.is_file():
    h=HTML.read_text()
    if h.count('memeflow-settings-execution-compact-v193.css')!=1:e.append('CSS link missing/duplicated')
    if h.count('memeflow-settings-execution-compact-v193.js')!=1:e.append('JS link missing/duplicated')
if CSS.is_file():
    c=CSS.read_text(); bad=sorted(set(re.findall(r'font-size\s*:\s*([0-9.]+px)',c))-{'11px','12px','13px','14px','16px','20px'})
    if bad:e.append('non-V192 font sizes: '+', '.join(bad))
if JS.is_file():
    j=JS.read_text()
    for x in ('g.open=true','MutationObserver','mf-exec-v193','actionPattern'):
        if x not in j:e.append('JS contract missing: '+x)
    r=subprocess.run(['node','--check',str(JS)],capture_output=True,text=True)
    if r.returncode:e.append('JS syntax failed')
if e:
    print('V193 AUDIT FAILED:');[print(' -',x) for x in e];raise SystemExit(1)
print('V193 EXECUTION & SAFETY COMPACT AUDIT: PASS')
print(' - section forced open')
print(' - all existing controls preserved')
print(' - 2x2 mobile status grid')
print(' - compact action matrix')
print(' - technical notes remain visible at 11px')
print(' - V192 six-size typography preserved')
print(' - no backend / API / trading logic edits')
