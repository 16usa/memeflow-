#!/usr/bin/env python3
from pathlib import Path
import sys
p=Path('memeflow-app/src/store.mjs')
s=p.read_text()
marker='// MEMEFLOW_STAGE24_SHADOW_CAPTURE_IMPORT'
if marker in s:
 print('Stage 24 already installed; unchanged');sys.exit(0)
anchor="import {TokenRegistry} from './token-registry.mjs';"
if s.count(anchor)!=1:sys.exit('STOP: import anchor mismatch; no changes')
method='''    this.state.decisions[key]={...d,userId:uid,mint,updatedAt:now};'''
if s.count(method)!=1:sys.exit('STOP: decision anchor mismatch; no changes')
s=s.replace(anchor,anchor+"\n// MEMEFLOW_STAGE24_SHADOW_CAPTURE_IMPORT\nimport {createStage24Capture} from './quantum-stage24-capture.mjs';",1)
constructor='''    this.dir=dir;this.file=path.join(dir,'state.json');'''
if s.count(constructor)!=1:sys.exit('STOP: constructor anchor mismatch; no changes')
s=s.replace(constructor,constructor+"\n    this.stage24Capture=createStage24Capture({dataDir:dir,enabled:process.env.MEMEFLOW_STAGE24_SHADOW_CAPTURE==='1'});",1)
s=s.replace(method,method+'''\n    // MEMEFLOW_STAGE24_SHADOW_CAPTURE: observe only; failures cannot affect decisions.\n    try{this.stage24Capture?.observe({mint,token:this.state.tokens?.[mint],decision:this.state.decisions[key]})}catch{}''',1)
p.write_text(s)
print('Stage 24 installed in store.mjs; disabled by default (set MEMEFLOW_STAGE24_SHADOW_CAPTURE=1 on next manual restart)')
