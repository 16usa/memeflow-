#!/usr/bin/env python3
"""Targeted, reversible Stage 7: isolate legacy policy bridge from Quantum decisions."""
from pathlib import Path
import sys
p=Path('memeflow-app/app-server.mjs')
if not p.exists():
    sys.exit('ERROR: run from workspace root; app-server.mjs not found')
s=p.read_text()
marker='// MEMEFLOW_QUANTUM_STAGE7_LEGACY_BRIDGE_ISOLATION'
if marker in s:
    print('Stage 7 already installed');sys.exit(0)
needle='function __mfApplyV24PolicyBridge(uid,token,decision){\n  return v24ControlledPolicyBridge.apply({'
if s.count(needle)!=1:
    sys.exit('ERROR: V24 bridge signature changed; no files modified')
replacement='''function __mfApplyV24PolicyBridge(uid,token,decision){
  // MEMEFLOW_QUANTUM_STAGE7_LEGACY_BRIDGE_ISOLATION
  // V24 policy is a competing analytical decision engine. Never let it
  // downgrade or replace a Quantum decision, including in SHADOW mode.
  // SHADOW uses the original evaluator as authority; ENFORCE uses Quantum.
  if (String(decision?.scoreAuthority||'')==='quantum-decision-engine') return decision;
  return v24ControlledPolicyBridge.apply({'''
s=s.replace(needle,replacement)
backup=p.with_suffix(p.suffix+'.pre-quantum-stage7.bak')
if not backup.exists():backup.write_text(p.read_text())
p.write_text(s)
print('Stage 7 installed: V24 bridge cannot override Quantum-authoritative decisions.')
print('Legacy entry admission remains unchanged; automated trading quarantine remains active.')
