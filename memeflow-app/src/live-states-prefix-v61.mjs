// MEMEFLOW_LIVE_STATES_PREFIX_HOTPATH_V61
//
// Exact replacement for:
//   store.tokens().filter(isCurrent).slice(0, limit)
//
// without globally sorting the entire scanner cache.
//
// Semantics preserved:
//   - same current-token membership
//   - same discoveredAt descending order
//   - same stable Object.values insertion order when discoveredAt ties
//   - exact full current-token count
//
// Only a bounded candidate set is sorted during the scan.

const toTime=value=>{
  const n=Number(value||0);
  return n;
};

const compareRows=(a,b)=>{
  const diff=
    toTime(b?.token?.discoveredAt)-
    toTime(a?.token?.discoveredAt);

  if(!Number.isNaN(diff)&&diff!==0){
    return diff;
  }

  // Array.sort is stable, but retain the legacy Object.values ordering
  // explicitly so compaction cannot perturb equal discoveredAt rows.
  return Number(a?.ordinal||0)-Number(b?.ordinal||0);
};

function compactRows(rows,limit){
  if(rows.length<=limit*2)return;

  rows.sort(compareRows);
  rows.length=limit;
}

export function selectNewestCurrentTokensV61({
  tokens=[],
  limit=200,
  isCurrent=()=>true
}={}){
  const cap=Math.max(
    1,
    Math.floor(Number(limit)||200)
  );

  const rows=[];
  let liveCount=0;
  let ordinal=0;

  for(const token of Array.isArray(tokens)?tokens:[]){
    const rowOrdinal=ordinal++;

    if(!isCurrent(token))continue;

    liveCount++;

    rows.push({
      token,
      ordinal:rowOrdinal
    });

    compactRows(rows,cap);
  }

  rows.sort(compareRows);

  if(rows.length>cap){
    rows.length=cap;
  }

  return {
    tokens:rows.map(row=>row.token),
    liveCount
  };
}
