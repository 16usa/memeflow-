const terminalStates=new Set(['EXPIRED','BLOCKED','REJECTED','CLOSED','IGNORED']);

export function classifyDecisionVisibility(decision={}){
  const state=String(decision.state||'WAITING').trim().toUpperCase();
  const closed=decision.terminal===true||String(decision.lifecycle||'').toLowerCase()==='closed'||terminalStates.has(state);

  if(state==='BUY READY'&&!closed)return 'candidate';
  if(state==='WAITING'&&!closed)return 'processing';
  return 'filtered';
}

export function candidateFeed(decisions=[],scope='candidates'){
  const rows=Array.isArray(decisions)?decisions.filter(Boolean):[];
  const normalized=String(scope||'candidates').trim().toLowerCase();

  if(normalized==='all'||normalized==='audit')return rows;
  if(normalized==='processing')return rows.filter(x=>classifyDecisionVisibility(x)==='processing');
  if(normalized==='filtered')return rows.filter(x=>classifyDecisionVisibility(x)==='filtered');

  // Default public/user Candidates feed: only fully qualified BUY READY decisions.
  return rows.filter(x=>classifyDecisionVisibility(x)==='candidate');
}

export function candidateVisibilityCounts(decisions=[]){
  const counts={candidates:0,processing:0,filtered:0,totalEvaluated:0};
  for(const row of Array.isArray(decisions)?decisions:[]){
    if(!row)continue;
    counts.totalEvaluated++;
    const kind=classifyDecisionVisibility(row);
    if(kind==='candidate')counts.candidates++;
    else if(kind==='processing')counts.processing++;
    else counts.filtered++;
  }
  return counts;
}
