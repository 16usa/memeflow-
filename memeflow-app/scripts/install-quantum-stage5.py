from pathlib import Path
import sys
base=Path('memeflow-app')
engine=base/'src/quantum-decision-engine.mjs'
server=base/'app-server.mjs'
evaluator=base/'src/evaluate.mjs'
for p in (engine,server,evaluator):
    if not p.is_file():sys.exit(f'ERROR: missing {p}; run from workspace root')
a=engine.read_text();b=server.read_text();c=evaluator.read_text()
marker='MEMEFLOW_QUANTUM_STAGE5_GUARDS'
if marker in a and marker in b:
    print('Stage 5 already installed');sys.exit(0)
if marker in a or marker in b:sys.exit('ERROR: partial Stage 5 installation; no files modified')
if 'MEMEFLOW_QUANTUM_STAGE4_PATTERN_PROVIDER' not in c or 'MEMEFLOW_QUANTUM_STAGE3_SINGLE_AUTHORITY' not in c or 'MEMEFLOW_QUANTUM_STAGE4_PATTERN_PROVIDER' not in b:
    sys.exit('ERROR: Stage 1-4 not fully installed; no files modified')
# Preserve user-configured wallet-risk limits as hard execution checks. Never treat unknown as safe.
needle="  const bullish=patternReady && probability>=60 && patternConfidence>=40;"
if a.count(needle)!=1:sys.exit('ERROR: unexpected Quantum engine version; no changes')
a=a.replace(needle,"""  // MEMEFLOW_QUANTUM_STAGE5_GUARDS
  // Final pre-open checks are execution safety, NOT a competing legacy score.
  const finalPreOpen=arguments[0]?.includePreOpenRisk===true;
""".replace("  const finalPreOpen=arguments[0]?.includePreOpenRisk===true;", "  const finalPreOpen=intelligence?.__quantumPreOpen===true;")+needle,1)
# The engine is a pure function; evaluator forwards the final-preopen context explicitly.
needle="  else if(!patternReady){reasons.push('historical pattern evidence unavailable');}"
if a.count(needle)!=1:sys.exit('ERROR: unexpected pattern logic; no changes')
a=a.replace(needle,"""  else if(finalPreOpen && (
    (num(settings.maxSuspectedRiskyWalletsPct)!==null && (riskWallets===null || riskWallets>num(settings.maxSuspectedRiskyWalletsPct))) ||
    (num(settings.maxInsidersPct)!==null && (insiders===null || insiders>num(settings.maxInsidersPct)))
  )){state='BLOCKED';reasons.push('final pre-open wallet safety check failed or unavailable');}
"""+needle,1)
# Forward context only at the final preopen path; avoid mutating provider snapshots.
needle='  const quantum=quantumDecision(token,s,quantumIntel||{});'
if c.count(needle)!=1:sys.exit('ERROR: Stage 4 evaluator integration unexpected; no changes')
c=c.replace(needle,"  const quantum=quantumDecision(token,s,{...(quantumIntel||{}),__quantumPreOpen:options?.includePreOpenRisk===true});",1)
# Do not resurrect legacy score during ENFORCE, including on cold start.
needle="    String(persisted?.scoreAuthority||'evaluate')==='evaluate'"
if b.count(needle)!=1:sys.exit('ERROR: legacy persisted score fallback changed; no changes')
b=b.replace(needle,"    String(process.env.MEMEFLOW_QUANTUM_MODE||'SHADOW').trim().toUpperCase()!=='ENFORCE' &&\n"+needle,1)
# Ensure display score source correctly indicates quantum, not legacy.
needle="      scoreSource:'evaluate-live'"
if b.count(needle)!=1:sys.exit('ERROR: expected live score metadata not found; no changes')
b=b.replace(needle,"      scoreSource:String(process.env.MEMEFLOW_QUANTUM_MODE||'SHADOW').trim().toUpperCase()==='ENFORCE'?'quantum-live':'evaluate-live'",1)
# Do not allow ENFORCE to initiate automated paper or real execution before validation.
needle="async function __mfHandleDecision(\n  uid,\n  token,\n  decision\n){"
if b.count(needle)!=1:sys.exit('ERROR: execution entrypoint changed; no changes')
b=b.replace(needle,needle+"\n  // MEMEFLOW_QUANTUM_STAGE5_GUARDS: analysis-only until separately validated.\n  if(String(process.env.MEMEFLOW_QUANTUM_MODE||'SHADOW').trim().toUpperCase()==='ENFORCE')return {action:'NONE',reason:'QUANTUM_EXECUTION_NOT_VALIDATED'};",1)
for p in (engine,server,evaluator):
    backup=p.with_name(p.name+'.pre-quantum-stage5.bak')
    if backup.exists():sys.exit(f'ERROR: existing backup {backup}; no changes made')
# Stage 5 is intentionally limited: no deletion of legacy modules until all callers migrated.
for p,updated in ((engine,a),(server,b),(evaluator,c)):
    p.with_name(p.name+'.pre-quantum-stage5.bak').write_text(p.read_text())
    p.write_text(updated)
print('Stage 5 installed: quantum final pre-open safety, legacy score isolation, execution quarantine.')
print('Default SHADOW unchanged. ENFORCE is analysis-only and blocks automated execution.')
