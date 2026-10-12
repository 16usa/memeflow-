#!/usr/bin/env python3
"""Safely add Stage 19 decision-policy assessment to the existing Quantum engine.
Requires Stage 1 and Stage 2. No process restart, network, wallets or env edits.
"""
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[2]
engine=root/'memeflow-app/src/quantum-decision-engine.mjs'
evaluator=root/'memeflow-app/src/evaluate.mjs'
policy=root/'memeflow-app/src/quantum-stage19-policy.mjs'
if not all(p.is_file() for p in (engine,evaluator,policy)):
 sys.exit('ABORT: Stage 1/2 or Stage 19 files missing; no changes')
s=engine.read_text()
if 'MEMEFLOW_QUANTUM_STAGE19_POLICY' in s:
 print('Stage 19 already installed');sys.exit(0)
if 'MEMEFLOW_QUANTUM_STAGE2_ROUTING' not in evaluator.read_text():
 sys.exit('ABORT: Stage 2 evaluator routing absent; no changes')
imp='// Memflow Quantum Decision Engine v1'
anchor='  return {\n    analysisVersion:'
if s.count(imp)!=1 or s.count(anchor)!=1:
 sys.exit('ABORT: Quantum engine changed; no changes')
s2=s.replace(imp,"import {assessQuantumEntry} from './quantum-stage19-policy.mjs';\n// MEMEFLOW_QUANTUM_STAGE19_POLICY\n"+imp,1)
s2=s2.replace(anchor,"  // All three signals now drive a single conservative entry authority.\n  // Existing lifecycle, price and evidence blocks remain authoritative.\n  const stage19=assessQuantumEntry({score,risk,pattern:{ready:patternReady,probability,confidence:patternConfidence}});\n  if(state==='BUY READY'&&!stage19.eligible){state=stage19.proposedState;reasons.push(...stage19.reasons);}\n"+anchor,1)
s2=s2.replace("    state,confidence:completeness", "    stage19Policy:stage19,\n    state,confidence:completeness",1)
backup=engine.with_name('quantum-decision-engine.mjs.pre-stage19.bak')
if backup.exists():sys.exit('ABORT: backup exists; no changes')
backup.write_text(s)
engine.write_text(s2)
print('Stage 19 installed: score/risk/pattern policy wired to quantum decision. SHADOW default; no live execution changes.')
