// MEMEFLOW_UNIFIED_SCORE_RANKING_V21
// One ranking number: view.score from evaluate().
// Order: state lane -> canonical Score -> factual live tie-breakers.

const STATE_PRIORITY=Object.freeze({
  'OPEN POSITION':500,'OPEN_POSITION':500,'OPEN':500,'POSITION':500,
  'BUY READY':400,'BUY_READY':400,'WATCH':300,'WAITING':300,
  'BLOCKED':100,'REJECTED':50,'EXPIRED':25
});

const number=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

function normalizedState(state){
  return String(state||'WAITING').trim().toUpperCase();
}
function statePriority(state){
  return STATE_PRIORITY[normalizedState(state)]??0;
}

// Compatibility export: no second formula anymore.
export function candidateRelevanceScore(view={}){
  return number(view?.score);
}

export function compareCandidateViews(a={},b={}){
  const stateDelta=statePriority(b.state)-statePriority(a.state);
  if(stateDelta)return stateDelta;

  const as=number(a.score),bs=number(b.score);
  if(as!==null||bs!==null){
    const ar=as??Number.NEGATIVE_INFINITY;
    const br=bs??Number.NEGATIVE_INFINITY;
    if(br!==ar)return br-ar;
  }

  const at=number(a.transactions5m)??0,bt=number(b.transactions5m)??0;
  if(bt!==at)return bt-at;

  const av=number(a.volume5mUsd)??number(a.volume5mSol)??0;
  const bv=number(b.volume5mUsd)??number(b.volume5mSol)??0;
  if(bv!==av)return bv-av;

  const amc=number(a.marketCapUsd)??number(a.marketCapSol??a.marketCap)??0;
  const bmc=number(b.marketCapUsd)??number(b.marketCapSol??b.marketCap)??0;
  if(bmc!==amc)return bmc-amc;

  const ah=number(a.holderCount??a.holders??a.observedHolderCount)??0;
  const bh=number(b.holderCount??b.holders??b.observedHolderCount)??0;
  if(bh!==ah)return bh-ah;

  const aq=number(a.quoteAgeMs)??Number.MAX_SAFE_INTEGER;
  const bq=number(b.quoteAgeMs)??Number.MAX_SAFE_INTEGER;
  if(aq!==bq)return aq-bq;

  return String(a.mint||a.id||'').localeCompare(String(b.mint||b.id||''));
}

export function rankCandidateViews(views=[]){
  return (Array.isArray(views)?views:[])
    .filter(Boolean)
    .map(view=>{
      const score=number(view.score);
      const base={...view};
      // Rolling-deploy cleanup: old rows may still carry these legacy fields.
      // Delete them without creating another score/ranking path.
      delete base.feedScore;
      delete base.relevanceScore;
      return {
        ...base,
        score,
        decisionScore:score,
        scoreAuthority:'evaluate',
        statePriority:statePriority(view.state)
      };
    })
    .sort(compareCandidateViews);
}

export {statePriority as candidateStatePriority};
