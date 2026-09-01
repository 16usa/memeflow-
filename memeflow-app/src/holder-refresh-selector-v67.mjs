// MEMEFLOW_HOLDER_REFRESH_HOTPATH_V67
//
// The old scheduler globally stable-sorted every eligible token and then
// traversed rows until it completed maxEnqueue successful enqueue attempts,
// skipping rows whose holder job was already pending/active.
//
// If B eligible rows are already busy, the old traversal can never need more
// than maxEnqueue + B rows. Keeping that exact stable sorted prefix therefore
// preserves the old traversal result without sorting the full candidate set.

function compareRowsV67(a,b,fairness){
  if(fairness && a.scannedAt!==b.scannedAt){
    return a.scannedAt-b.scannedAt;
  }

  const ar=a.rank||{};
  const br=b.rank||{};

  if(
    ar.lane===3 &&
    br.lane===3 &&
    Boolean(ar.nearDecision)!==Boolean(br.nearDecision)
  ){
    return ar.nearDecision?-1:1;
  }

  if(ar.lane!==br.lane){
    return Number(ar.lane||0)-Number(br.lane||0);
  }

  if(ar.score!==br.score){
    return Number(br.score||0)-Number(ar.score||0);
  }

  if(a.activityAt!==b.activityAt){
    return b.activityAt-a.activityAt;
  }

  if(a.scannedAt!==b.scannedAt){
    return a.scannedAt-b.scannedAt;
  }

  // Native Array#sort is stable; explicit input order reproduces that tie.
  return a.order-b.order;
}

function pushBoundedV67(bucket,row,limit,fairness){
  let lo=0;
  let hi=bucket.length;

  while(lo<hi){
    const mid=(lo+hi)>>1;

    if(compareRowsV67(bucket[mid],row,fairness)<=0){
      lo=mid+1;
    }else{
      hi=mid;
    }
  }

  bucket.splice(lo,0,row);

  if(bucket.length>limit){
    bucket.pop();
  }
}

export function selectHolderRefreshPrefixV67({
  rows=[],
  fairness=false,
  maxEnqueue=3
}={}){
  const source=Array.isArray(rows)?rows:[];
  const max=Math.max(1,Number(maxEnqueue)||3);

  let busyCount=0;

  for(const row of source){
    if(row?.busy)busyCount++;
  }

  const limit=Math.min(
    source.length,
    max+busyCount
  );

  if(limit<=0)return [];

  const prefix=[];

  for(const row of source){
    pushBoundedV67(
      prefix,
      row,
      limit,
      Boolean(fairness)
    );
  }

  return prefix;
}
