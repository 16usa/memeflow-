#!/usr/bin/env python3
"""Fail-closed Stage 8: bypass legacy admission only for Quantum analysis in ENFORCE.
Execution remains quarantined by Stage 5. Never touches funds or restarts processes.
"""
from pathlib import Path
import sys
p=Path('memeflow-app/app-server.mjs')
if not p.exists(): sys.exit('ERROR: run from workspace root; no files changed')
s=p.read_text()
marker='// MEMEFLOW_QUANTUM_STAGE8_ADMISSION_ISOLATION'
if marker in s: sys.exit('Stage 8 already installed; no changes')
needle="  const eligible=admission?.admitted===true;"
replacement="""  // MEMEFLOW_QUANTUM_STAGE8_ADMISSION_ISOLATION
  // In ENFORCE, the legacy entry filter cannot veto Quantum's analytical state.
  // This does NOT authorize order execution; Stage 5 quarantine remains mandatory.
  const quantumAnalysisMode=String(process.env.MEMEFLOW_QUANTUM_MODE||'SHADOW').trim().toUpperCase()==='ENFORCE';
  const eligible=quantumAnalysisMode || admission?.admitted===true;"""
if s.count(needle)!=1: sys.exit(f'ERROR: live decision signature mismatch ({s.count(needle)}); no files changed')
# Remove the legacy admission veto in settings reevaluation, but do not touch other gates.
needle2="""        if(admission?.admitted!==true){
          __mfClearDecisionForUserMint(uid,token.mint);"""
replacement2="""        if(String(process.env.MEMEFLOW_QUANTUM_MODE||'SHADOW').trim().toUpperCase()!=='ENFORCE' && admission?.admitted!==true){
          __mfClearDecisionForUserMint(uid,token.mint);"""
if s.count(needle2)!=1: sys.exit(f'ERROR: reevaluation signature mismatch ({s.count(needle2)}); no files changed')
# In ENFORCE tradeEligible must never be true, even if another code path fails to quarantine.
needle3="""    tradeEligible:
      isOpen
        ? true
        : (
            eligible &&"""
replacement3="""    tradeEligible:
      isOpen
        ? true
        : (
            !quantumAnalysisMode &&
            eligible &&"""
if s.count(needle3)!=1: sys.exit(f'ERROR: execution safety signature mismatch ({s.count(needle3)}); no files changed')
# For the same reason do not set the admission state to false in Quantum reevaluation.
needle4="""        __mfEntryAdmissionState.set(
          uid+':'+token.mint,
          true
        );"""
if s.count(needle4)!=1: sys.exit(f'ERROR: admission state signature mismatch ({s.count(needle4)}); no files changed')
modified=s.replace(needle,replacement,1).replace(needle2,replacement2,1).replace(needle3,replacement3,1)
backup=p.with_suffix(p.suffix+'.pre-quantum-stage8.bak')
if backup.exists(): sys.exit(f'ERROR: backup {backup} exists; no files changed')
backup.write_text(s)
p.write_text(modified)
print('Stage 8 installed: live display and reevaluation legacy admission veto isolated in ENFORCE.')
print('Live execution remains blocked in ENFORCE. SHADOW unchanged. Backup:',backup)
