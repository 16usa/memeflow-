import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const FILE=path.join(ROOT,'memeflow-app','system-tokens.js');

if(!fs.existsSync(FILE)){
  console.error('[MEMEFLOW TOKEN FLOW V6] Missing '+FILE);
  process.exit(1);
}

const original=fs.readFileSync(FILE,'utf8');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(ROOT,'memeflow-app','.token-flow-v6-backup',stamp);
fs.mkdirSync(backupDir,{recursive:true});
const backupFile=path.join(backupDir,'system-tokens.js');
fs.copyFileSync(FILE,backupFile);

function restore(){ try{fs.copyFileSync(backupFile,FILE)}catch{} }

function findMatchingBrace(text,openIndex){
  let depth=0, quote=null, esc=false, lineComment=false, blockComment=false;
  for(let i=openIndex;i<text.length;i++){
    const c=text[i], n=text[i+1];

    if(lineComment){ if(c==='\n') lineComment=false; continue; }
    if(blockComment){ if(c==='*'&&n==='/'){blockComment=false;i++;} continue; }

    if(quote){
      if(esc){esc=false;continue;}
      if(c==='\\'){esc=true;continue;}
      if(c===quote)quote=null;
      continue;
    }

    if(c==='/'&&n==='/'){lineComment=true;i++;continue;}
    if(c==='/'&&n==='*'){blockComment=true;i++;continue;}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue;}

    if(c==='{')depth++;
    else if(c==='}'){
      depth--;
      if(depth===0)return i;
    }
  }
  return -1;
}

try{
  let src=original;

  // Add a compatibility normalizer once. The canonical /api/ai/decisions
  // candidateView shape exposes state/score at top level, while the existing
  // Token Flow renderer expects row.decision.state / row.decision.score.
  if(!src.includes('function canonicalDecisionRow(row)')){
    const pos=src.indexOf('const state = {');
    if(pos<0)throw new Error('state object anchor not found');

    const helper=`function canonicalDecisionRow(row) {
  const nested =
    row?.decision && typeof row.decision === 'object'
      ? row.decision
      : {};

  return {
    ...row,
    decision: {
      ...nested,
      state:
        row?.state ??
        nested?.state ??
        'WAITING',
      score:
        row?.score ??
        nested?.score ??
        null,
      primaryReason:
        row?.primaryReason ??
        nested?.primaryReason ??
        nested?.reason ??
        null,
      reasons:
        Array.isArray(row?.reasons)
          ? row.reasons
          : Array.isArray(nested?.reasons)
            ? nested.reasons
            : []
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
  }

  // Replace ONLY the active loadTokens() function. Other debug strings,
  // comments or diagnostic helpers elsewhere in the file are irrelevant and
  // are intentionally left untouched.
  const fnNeedle='async function loadTokens()';
  const fnStart=src.indexOf(fnNeedle);
  if(fnStart<0)throw new Error('loadTokens() function not found');

  const open=src.indexOf('{',fnStart);
  if(open<0)throw new Error('loadTokens() opening brace not found');

  const close=findMatchingBrace(src,open);
  if(close<0)throw new Error('loadTokens() closing brace not found');

  const canonicalLoad=`async function loadTokens() {
  if (state.loading) {
    return;
  }

  state.loading = true;

  try {
    // Same per-user, server-authoritative decisions feed used by Trading Terminal.
    const response =
      await fetch(
        '/api/ai/decisions?scope=all&limit=200',
        {
          cache: 'no-store',
          credentials: 'same-origin'
        }
      );

    if (!response.ok) {
      throw new Error(
        \`HTTP \${response.status}\`
      );
    }

    const payload =
      await response.json();

    const rows =
      Array.isArray(payload?.decisions)
        ? payload.decisions
        : [];

    state.rows =
      rows
        .map(canonicalDecisionRow)
        .filter(
          (row) => row?.mint
        );

    $('lastUpdate').textContent =
      \`Updated \${new Date().toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }
      )}\`;

    render();
  } catch (error) {
    console.error(
      '[MEMEFLOW TOKEN FLOW]',
      error
    );

    $('lastUpdate').textContent =
      'Decision feed unavailable';
  } finally {
    state.loading = false;
  }
}`;

  src=src.slice(0,fnStart)+canonicalLoad+src.slice(close+1);

  fs.writeFileSync(FILE,src,'utf8');

  execFileSync(process.execPath,['--check',FILE],{stdio:'pipe'});

  const check=fs.readFileSync(FILE,'utf8');
  const checkStart=check.indexOf(fnNeedle);
  const checkOpen=check.indexOf('{',checkStart);
  const checkClose=findMatchingBrace(check,checkOpen);
  const activeLoad=check.slice(checkStart,checkClose+1);

  if(!activeLoad.includes('/api/ai/decisions?scope=all&limit=200')){
    throw new Error('canonical decisions endpoint missing from active loadTokens()');
  }
  if(activeLoad.includes('/api/debug/filter-pipeline-lifecycle')){
    throw new Error('debug lifecycle endpoint still used by active loadTokens()');
  }
  if(!activeLoad.includes('.map(canonicalDecisionRow)')){
    throw new Error('canonical decision normalization missing from active loadTokens()');
  }

  console.log('');
  console.log('[MEMEFLOW TOKEN FLOW V6] INSTALLED OK');
  console.log('[MEMEFLOW TOKEN FLOW V6] Active loadTokens() now uses /api/ai/decisions.');
  console.log('[MEMEFLOW TOKEN FLOW V6] Same user/session decisions as Trading Terminal.');
  console.log('[MEMEFLOW TOKEN FLOW V6] UI, scanner, evaluator and user settings untouched.');
  console.log('[MEMEFLOW TOKEN FLOW V6] Backup: '+backupDir);
  console.log('');
}catch(e){
  restore();
  console.error('');
  console.error('[MEMEFLOW TOKEN FLOW V6] FAILED — system-tokens.js restored.');
  console.error('[MEMEFLOW TOKEN FLOW V6] '+String(e?.message||e));
  console.error('[MEMEFLOW TOKEN FLOW V6] Backup: '+backupDir);
  process.exit(1);
}
