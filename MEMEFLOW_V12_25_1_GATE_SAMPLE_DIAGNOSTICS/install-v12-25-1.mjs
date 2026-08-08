import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(process.env.HOME || '/home/runner', 'workspace/memeflow-app/app-server.mjs');
if (!fs.existsSync(APP)) {
  console.error('ABORT: app-server.mjs not found at ' + APP);
  process.exit(1);
}

const original = fs.readFileSync(APP, 'utf8');
const anchor = "diagnosticVersion:'V10.2-same-instance',";
const matches = original.split(anchor).length - 1;
if (matches !== 1) {
  console.error(`ABORT: expected exactly 1 diagnostics anchor, found ${matches}. No changes made.`);
  process.exit(1);
}

const backup = APP + '.before-v12-25-1-' + new Date().toISOString().replace(/[:.]/g,'-');
fs.copyFileSync(APP, backup);

const injection = `diagnosticVersion:'V10.2-same-instance',
      v12_25:{
        version:'V12.25.1',
        diagnosticsOnly:true,
        tradingLogicChanged:false,
        note:'Gate sample diagnostics only; evaluator and execution paths are unchanged.'
      },
      gateSampleDiagnostics:sample.map((row)=>{
        const holder=row?.holder||{};
        const market=row?.market||{};
        const decision=row?.decision||null;
        const holdersValue=holder.count??null;
        const top10Value=holder.top10Pct??null;
        const developerValue=holder.developerPct??null;
        const buyPressureValue=market.buyPressure??null;
        const holdersPass=holdersValue!=null?holdersValue>=settings.minHolders:null;
        const top10Pass=top10Value!=null?top10Value<=settings.maxTop10Pct:null;
        const developerPass=developerValue!=null?developerValue<=settings.maxDeveloperPct:null;
        const buyPressurePass=buyPressureValue!=null?buyPressureValue>=settings.minBuyPressure:null;
        const failed=[];
        if(holdersPass===false)failed.push('MIN_HOLDERS');
        if(top10Pass===false)failed.push('MAX_TOP10');
        if(developerPass===false)failed.push('MAX_DEVELOPER');
        if(buyPressurePass===false)failed.push('MIN_BUY_PRESSURE');
        return {
          mint:row?.mint??null,
          ageMinutes:row?.ageMinutes??null,
          gates:{
            holders:{value:holdersValue,threshold:settings.minHolders,operator:'>=',pass:holdersPass},
            top10Pct:{value:top10Value,threshold:settings.maxTop10Pct,operator:'<=',pass:top10Pass},
            developerPct:{value:developerValue,threshold:settings.maxDeveloperPct,operator:'<=',pass:developerPass},
            buyPressure:{value:buyPressureValue,threshold:settings.minBuyPressure,operator:'>=',pass:buyPressurePass}
          },
          failedGates:failed,
          decisionState:decision?.state??null,
          decisionReason:decision?.primaryReason??(Array.isArray(decision?.reasons)&&decision.reasons.length?decision.reasons[0]:null)
        };
      }),`;

let patched = original.replace(anchor, injection);

try {
  fs.writeFileSync(APP, patched);
  console.log('PASS: V12.25.1 installed');
  console.log('Backup: ' + backup);
  console.log('Next: node MEMEFLOW_V12_25_1_GATE_SAMPLE_DIAGNOSTICS/self-test-v12-25-1.mjs');
} catch (e) {
  try { fs.copyFileSync(backup, APP); } catch {}
  console.error('ABORT: write failed; backup restored: ' + e.message);
  process.exit(1);
}
