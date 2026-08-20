const terminalStates=new Set(['EXPIRED','BLOCKED','REJECTED','CLOSED','IGNORED']);

const FILTERED_LIVE_TTL_MS=Math.max(
  60_000,
  Number(process.env.MEMEFLOW_FILTERED_LIVE_TTL_MS||15*60_000)
);
const PASSIVE_LIVE_TTL_MS=Math.max(
  FILTERED_LIVE_TTL_MS,
  Number(process.env.MEMEFLOW_PASSIVE_LIVE_TTL_MS||60*60_000)
);

function tsMs(v){
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='number'&&Number.isFinite(v))return v<1e12?v*1000:v;
  const n=Number(v);
  if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
  const d=Date.parse(String(v));
  return Number.isFinite(d)?d:null;
}

function lookupToken(tokenLookup,mint){
  if(typeof tokenLookup==='function')return tokenLookup(mint)||null;
  if(tokenLookup&&typeof tokenLookup==='object')return tokenLookup[mint]||null;
  return null;
}

function marketActivityAt(token={},decision={}){
  // updatedAt/lastPriceAt are deliberately NOT first: polling a flat market
  // must not keep a dead token alive forever.
  for(const v of [
    token.lastMarketActivityAt,
    token.lastPriceChangeAt,
    token.discoveredAt,
    token.createdAt,
    token.firstSeenAt,
    decision.createdAt,
    decision.updatedAt
  ]){
    const ms=tsMs(v);
    if(ms!==null)return ms;
  }
  return null;
}

export function isDecisionArchived(decision={},token=null,now=Date.now()){
  if(!token||typeof token!=='object')return false;
  const state=String(decision.state||'WAITING').trim().toUpperCase();

  // Never remove a currently qualified candidate merely because its market is quiet.
  if(state==='BUY READY')return false;

  const activity=marketActivityAt(token,decision);
  if(activity===null)return false;
  const idle=Math.max(0,Number(now)-activity);

  if(state==='WAITING'||state==='WATCH')return idle>=PASSIVE_LIVE_TTL_MS;
  if(terminalStates.has(state)||decision.terminal===true)return idle>=FILTERED_LIVE_TTL_MS;
  return false;
}

export function classifyDecisionVisibility(decision={},token=null,now=Date.now()){
  if(isDecisionArchived(decision,token,now))return 'archived';

  const state=String(decision.state||'WAITING').trim().toUpperCase();
  const closed=
    decision.terminal===true||
    String(decision.lifecycle||'').toLowerCase()==='closed'||
    terminalStates.has(state);

  if(state==='BUY READY'&&!closed)return 'candidate';
  if(state==='WAITING'&&!closed)return 'processing';
  return 'filtered';
}

export function candidateFeed(decisions=[],scope='candidates',tokenLookup=null,now=Date.now()){
  const rows=Array.isArray(decisions)?decisions.filter(Boolean):[];
  const normalized=String(scope||'candidates').trim().toLowerCase();
  const kindOf=row=>classifyDecisionVisibility(
    row,
    lookupToken(tokenLookup,row?.mint),
    now
  );

  // "all" is the live surface. "audit" stays exhaustive while the in-memory
  // decision exists; "archived" exposes lifecycle-hidden rows.
  if(normalized==='audit')return rows;
  if(normalized==='archived')return rows.filter(row=>kindOf(row)==='archived');
  if(normalized==='all')return rows.filter(row=>kindOf(row)!=='archived');
  if(normalized==='processing')return rows.filter(row=>kindOf(row)==='processing');
  if(normalized==='watch')return rows.filter(row=>
    String(row?.state||'').toUpperCase()==='WATCH'&&kindOf(row)!=='archived'
  );
  if(normalized==='filtered')return rows.filter(row=>kindOf(row)==='filtered');

  return rows.filter(row=>kindOf(row)==='candidate');
}

export function candidateVisibilityCounts(decisions=[],tokenLookup=null,now=Date.now()){
  const counts={
    candidates:0,
    processing:0,
    filtered:0,
    archived:0,
    visible:0,
    totalEvaluated:0,
    buyReady:0,
    watch:0,
    waiting:0,
    blocked:0
  };

  for(const row of Array.isArray(decisions)?decisions:[]){
    if(!row)continue;
    counts.totalEvaluated++;

    const token=lookupToken(tokenLookup,row?.mint);
    const kind=classifyDecisionVisibility(row,token,now);
    if(kind==='archived'){counts.archived++;continue}

    counts.visible++;
    const state=String(row.state||'WAITING').trim().toUpperCase();
    if(state==='BUY READY')counts.buyReady++;
    else if(state==='WATCH')counts.watch++;
    else if(state==='WAITING')counts.waiting++;
    else if(state==='BLOCKED')counts.blocked++;

    if(kind==='candidate')counts.candidates++;
    else if(kind==='processing')counts.processing++;
    else counts.filtered++;
  }
  return counts;
}
