import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const FILE=path.join(ROOT,'memeflow-app','system-tokens.js');

if(!fs.existsSync(FILE)){
  console.error('[MEMEFLOW TOKEN FLOW V5] Missing '+FILE);
  process.exit(1);
}

const original=fs.readFileSync(FILE,'utf8');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(ROOT,'memeflow-app','.token-flow-v5-backup',stamp);
fs.mkdirSync(backupDir,{recursive:true});
const backupFile=path.join(backupDir,'system-tokens.js');
fs.copyFileSync(FILE,backupFile);

function restore(){try{fs.copyFileSync(backupFile,FILE)}catch{}}
function replaceOnce(src,from,to,label){
  const n=src.split(from).length-1;
  if(n!==1)throw new Error(`${label}: expected 1 match, found ${n}`);
  return src.replace(from,to);
}

try{
  let src=original;
  const changes=[];

  // -----------------------------------------------------------------------
  // Canonical normalization:
  // /api/ai/decisions returns candidateView rows with state/score at top level.
  // Token Flow historically consumed the debug lifecycle shape where these
  // values lived under row.decision. Normalize once so the UI remains intact.
  // -----------------------------------------------------------------------
  if(!src.includes('function canonicalDecisionRow(row)')){
    const anchor=`function stateLabel(state = '') {`;
    const at=src.indexOf(anchor);
    if(at<0)throw new Error('stateLabel anchor not found');

    // Insert after the complete stateLabel function by locating the next
    // "const state =" declaration, which is stable in current builds.
    const next=`const state = {`;
    const pos=src.indexOf(next,at);
    if(pos<0)throw new Error('state object anchor not found');

    const helper=`function canonicalDecisionRow(row) {
  const nested =
    row?.decision &&
    typeof row.decision === 'object'
      ? row.decision
      : {};

  const decisionState =
    row?.state ??
    nested?.state ??
    'WAITING';

  const decisionScore =
    row?.score ??
    nested?.score ??
    null;

  const primaryReason =
    row?.primaryReason ??
    nested?.primaryReason ??
    nested?.reason ??
    null;

  const reasons =
    Array.isArray(row?.reasons)
      ? row.reasons
      : Array.isArray(nested?.reasons)
        ? nested.reasons
        : [];

  return {
    ...row,
    decision: {
      ...nested,
      state: decisionState,
      score: decisionScore,
      primaryReason,
      reasons
    },
    holder: {
      ...(row?.holder || {}),
      count:
        row?.holder?.count ??
        row?.holderCount ??
        row?.holders ??
        null,
      top10Pct:
        row?.holder?.top10Pct ??
        row?.top10Pct ??
        row?.top10 ??
        null,
      developerPct:
        row?.holder?.developerPct ??
        row?.developerPct ??
        row?.developerSharePct ??
        null
    },
    market: {
      ...(row?.market || {}),
      buyPressure:
        row?.market?.buyPressure ??
        row?.buyPressure ??
        row?.momentum ??
        null,
      priceSol:
        row?.market?.priceSol ??
        row?.priceSol ??
        row?.price ??
        null
    }
  };
}

`;
    src=src.slice(0,pos)+helper+src.slice(pos);
    changes.push('canonical decision normalizer added');
  }

  // -----------------------------------------------------------------------
  // Source of truth:
  // The full Token Flow MUST consume the exact per-user decisions endpoint
  // used by Trading Terminal. Debug lifecycle is diagnostics only.
  // -----------------------------------------------------------------------
  const debugUrl=`'/api/debug/filter-pipeline-lifecycle?limit=250'`;
  const canonicalUrl=`'/api/ai/decisions?scope=all&limit=200'`;

  if(src.includes(debugUrl)){
    src=replaceOnce(src,debugUrl,canonicalUrl,'canonical API URL');
    changes.push('debug lifecycle endpoint replaced by /api/ai/decisions');
  }else if(src.includes('/api/ai/decisions?scope=all')){
    console.log('[MEMEFLOW TOKEN FLOW V5] Canonical decisions endpoint already present.');
  }else{
    throw new Error('Token Flow data endpoint not recognized; refusing blind edit');
  }

  // Replace the old debug payload extraction with canonical decisions.
  const oldRows=`    const rows =
      Array.isArray(payload?.sample)
        ? payload.sample
        : Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(payload?.tokens)
            ? payload.tokens
            : [];

    state.rows =
      rows.filter(
        (row) => row?.mint
      );`;

  const newRows=`    const rows =
      Array.isArray(payload?.decisions)
        ? payload.decisions
        : [];

    state.rows =
      rows
        .map(canonicalDecisionRow)
        .filter(
          (row) => row?.mint
        );`;

  if(src.includes(oldRows)){
    src=replaceOnce(src,oldRows,newRows,'canonical payload extraction');
    changes.push('Token Flow now renders canonical candidateView decisions');
  }else if(src.includes('.map(canonicalDecisionRow)') && src.includes('payload?.decisions')){
    console.log('[MEMEFLOW TOKEN FLOW V5] Canonical payload normalization already present.');
  }else{
    throw new Error('Token Flow payload parser not recognized; refusing blind edit');
  }

  fs.writeFileSync(FILE,src,'utf8');

  // Syntax + semantic assertions.
  execFileSync(process.execPath,['--check',FILE],{stdio:'pipe'});
  const check=fs.readFileSync(FILE,'utf8');

  if(check.includes('/api/debug/filter-pipeline-lifecycle?limit=250')){
    throw new Error('debug lifecycle endpoint still present in active Token Flow loader');
  }
  if(!check.includes('/api/ai/decisions?scope=all&limit=200')){
    throw new Error('canonical decisions endpoint missing after install');
  }
  if(!check.includes('.map(canonicalDecisionRow)')){
    throw new Error('canonical decision normalization missing after install');
  }

  console.log('');
  console.log('[MEMEFLOW TOKEN FLOW V5] INSTALLED OK');
  for(const c of changes)console.log('[MEMEFLOW TOKEN FLOW V5] '+c+'.');
  console.log('[MEMEFLOW TOKEN FLOW V5] Token Flow now uses the same /api/ai/decisions source as Trading Terminal.');
  console.log('[MEMEFLOW TOKEN FLOW V5] UI, scanner, filters and evaluator were not changed.');
  console.log('[MEMEFLOW TOKEN FLOW V5] Backup: '+backupDir);
  console.log('');
}catch(e){
  restore();
  console.error('');
  console.error('[MEMEFLOW TOKEN FLOW V5] FAILED — system-tokens.js restored.');
  console.error('[MEMEFLOW TOKEN FLOW V5] '+String(e?.message||e));
  console.error('[MEMEFLOW TOKEN FLOW V5] Backup: '+backupDir);
  process.exit(1);
}
