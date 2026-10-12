from pathlib import Path
import sys
base=Path('memeflow-app')
e=base/'src/evaluate.mjs'
s=base/'app-server.mjs'
provider=base/'src/quantum-pattern-provider.mjs'
if not all(p.is_file() for p in [e,s,provider,base/'src/quantum-decision-engine.mjs']):sys.exit('ERROR: Run from workspace root; Stage 1-3 and app-server required')
a=e.read_text();b=s.read_text()
marker='MEMEFLOW_QUANTUM_STAGE4_PATTERN_PROVIDER'
if marker in a and marker in b:
 print('Stage 4 already installed');sys.exit(0)
if marker in a or marker in b:sys.exit('ERROR: Partial Stage 4 detected; no changes made')
if 'MEMEFLOW_QUANTUM_STAGE3_SINGLE_AUTHORITY' not in a or 'MEMEFLOW_QUANTUM_STAGE2_ROUTING' not in a:sys.exit('ERROR: Stage 3 not installed')
needle="import {quantumDecision} from './quantum-decision-engine.mjs';"
if a.count(needle)!=1:sys.exit('ERROR: Evaluator import unexpected')
newimport=needle+"\nimport {resolveQuantumPattern} from './quantum-pattern-provider.mjs';\n// MEMEFLOW_QUANTUM_STAGE4_PATTERN_PROVIDER\nlet quantumPatternProvider=null;\nexport function configureQuantumPatternProvider(provider){\n  if(typeof provider!=='function')throw new TypeError('Quantum pattern provider must be a function');\n  quantumPatternProvider=provider;\n}\n"
a=a.replace(needle,newimport,1)
needle='  const quantum=quantumDecision(token,s,options?.quantumIntelligence||token?.quantumIntelligence||{});'
if a.count(needle)!=1:sys.exit('ERROR: Stage 2 decision call unexpected')
replacement='''  // Provider reads the existing V23 history; missing/stale data fails closed.
  // Explicit test injection remains supported via options.quantumIntelligence.
  let quantumIntel=options?.quantumIntelligence??token?.quantumIntelligence??null;
  if(quantumIntel==null && quantumPatternProvider && token?.mint){
    try { quantumIntel=resolveQuantumPattern(quantumPatternProvider(token.mint)); }
    catch { quantumIntel={shadowTokenPattern:{ready:false,status:'PATTERN_PROVIDER_ERROR'}}; }
  }
  const quantum=quantumDecision(token,s,quantumIntel||{});'''
a=a.replace(needle,replacement,1)
importline="import {evaluate,tokenAgeMinutes} from './src/evaluate.mjs';"
if b.count(importline)!=1:sys.exit('ERROR: Server evaluator import unexpected')
b=b.replace(importline,"import {evaluate,tokenAgeMinutes,configureQuantumPatternProvider} from './src/evaluate.mjs';",1)
needle='const v24ControlledPolicyBridge=createV24ControlledPolicyBridgeV24_0({'
if b.count(needle)!=1:sys.exit('ERROR: Server bridge initialization unexpected')
b=b.replace(needle,"// MEMEFLOW_QUANTUM_STAGE4_PATTERN_PROVIDER\nconfigureQuantumPatternProvider(mint=>tokenIntelligenceShadowV23.inspect(mint));\n"+needle,1)
# An older V24 policy bridge must not change quantum decisions in ENFORCE.
needle='function __mfApplyV24PolicyBridge(uid,token,decision){\n  return v24ControlledPolicyBridge.apply({'
if b.count(needle)!=1:sys.exit('ERROR: V24 bridge call unexpected')
b=b.replace(needle,"function __mfApplyV24PolicyBridge(uid,token,decision){\n  if(String(process.env.MEMEFLOW_QUANTUM_MODE||'SHADOW').toUpperCase()==='ENFORCE')return decision;\n  return v24ControlledPolicyBridge.apply({",1)
for path in [e,s]:
 backup=path.with_name(path.name+'.pre-quantum-stage4.bak')
 if backup.exists():sys.exit(f'ERROR: Existing backup {backup}; nothing modified')
for path,contents in [(e,a),(s,b)]:
 backup=path.with_name(path.name+'.pre-quantum-stage4.bak')
 backup.write_text(path.read_text());path.write_text(contents)
print('Stage 4 installed: V23 pattern snapshots wired into Quantum SHADOW evaluator. Backups created.')
print('No restart, no wallet changes, no automatic ENFORCE. Historical data may remain cold or stale.')
