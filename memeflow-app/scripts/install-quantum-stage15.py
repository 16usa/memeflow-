#!/usr/bin/env python3
"""Stage 15: fail-closed BUY gate at both Smart Vault execution call sites.
Run from repo root. Does not start server, modify settings, or touch funds.
"""
from pathlib import Path
import shutil

root=Path(__file__).resolve().parents[2]
server=root/'memeflow-app/app-server.mjs'
s=server.read_text()
marker='// MEMEFLOW_QUANTUM_STAGE15_EXECUTION_GATE'
if marker in s:
    print('Stage 15 already installed; no changes')
    raise SystemExit(0)

import_anchor="import {evaluate,tokenAgeMinutes,configureQuantumPatternProvider} from './src/evaluate.mjs';"
if s.count(import_anchor)!=1: raise SystemExit('ABORT: evaluator import anchor changed')

# The gate intentionally never authorizes a trade: it can only veto BUY in ENFORCE.
# SHADOW returns immediately. SELL is untouched so risk exits cannot be trapped.
gate='''// MEMEFLOW_QUANTUM_STAGE15_EXECUTION_GATE
function __mfQuantumExecutionBuyGate({uid,mint,side}){
  if(String(process.env.MEMEFLOW_QUANTUM_MODE||'SHADOW').trim().toUpperCase()!=='ENFORCE')return;
  if(String(side||'').trim().toUpperCase()!=='BUY')return;
  const fail=reason=>{
    const e=new Error('Quantum pre-execution BUY veto: '+reason);
    e.code='QUANTUM_EXECUTION_BUY_BLOCKED';
    e.quantumReason=reason;
    throw e;
  };
  const id=String(uid||'').trim();
  const address=String(mint||'').trim();
  if(!id||!validPubkey(address))fail('missing user or valid token mint');
  const token=store.state.tokens?.[address];
  if(!token||String(token.mint||'')!==address)fail('fresh token evidence unavailable');
  const settings=store.settings(id);
  if(!settings)fail('user settings unavailable');
  let decision;
  try {decision=evaluate(token,settings,{includePreOpenRisk:true});}
  catch {fail('quantum evaluation unavailable');}
  if(decision?.scoreAuthority!=='quantum-decision-engine'||decision?.state!=='BUY READY'){
    fail('quantum decision is not BUY READY');
  }
  // This is a veto only; the existing execution, entitlement and wallet gates remain authoritative.
}
'''
# Insert after store initialization, before use, so the closure resolves store.
init_anchor='const opportunityEngine=createOpportunityEngine(); // MEMEFLOW_OPPORTUNITY_ENGINE_V1'
if s.count(init_anchor)!=1:raise SystemExit('ABORT: store initialization anchor changed')
s=s.replace(init_anchor,gate+'\n'+init_anchor,1)

old_callback='executeTrade:async(args)=>__mfSmartVaultD4.executeTrade(args)'
new_callback='executeTrade:async(args)=>{\n    __mfQuantumExecutionBuyGate({uid:args?.uid,mint:args?.mint,side:args?.side});\n    return __mfSmartVaultD4.executeTrade(args);\n  }'
if s.count(old_callback)!=1:raise SystemExit('ABORT: OpenAI execution callback anchor changed')
s=s.replace(old_callback,new_callback,1)

old_probe='''   const result=await __mfSmartVaultD4.executeTrade({
    uid:u.id,
    mint,
    side,
    amountSol,
    d4Probe:true
   });'''
new_probe='''   __mfQuantumExecutionBuyGate({uid:u.id,mint,side});
   const result=await __mfSmartVaultD4.executeTrade({
    uid:u.id,
    mint,
    side,
    amountSol,
    d4Probe:true
   });'''
if s.count(old_probe)!=1:raise SystemExit('ABORT: D5 execution call anchor changed')
s=s.replace(old_probe,new_probe,1)

# Prevent generic 500 for a deliberately rejected BUY; do not change other errors.
old_catch="""  }catch(e){
   return json(res,500,{
    error:e?.code||'D5_DEVNET_EXECUTION_FAILED',"""
new_catch="""  }catch(e){
   return json(res,e?.code==='QUANTUM_EXECUTION_BUY_BLOCKED'?423:500,{
    error:e?.code||'D5_DEVNET_EXECUTION_FAILED',"""
if s.count(old_catch)!=1:raise SystemExit('ABORT: D5 catch anchor changed')
s=s.replace(old_catch,new_catch,1)

backup=server.with_name('app-server.mjs.pre-quantum-stage15.bak')
if backup.exists():raise SystemExit('ABORT: existing Stage 15 backup; inspect before proceeding')
shutil.copy2(server,backup)
server.write_text(s)
print('Stage 15 installed; backup:',backup)
print('SHADOW unchanged; ENFORCE BUY veto at two call sites; SELL unchanged; no restart.')
