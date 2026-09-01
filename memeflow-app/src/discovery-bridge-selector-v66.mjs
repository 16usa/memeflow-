// MEMEFLOW_DISCOVERY_BRIDGE_HOTPATH_V66
//
// Exact bounded replacement for the old discovery-bridge scheduler:
//   all -> freshWindow -> fresh sort -> recovery includes() -> recovery sort.
//
// Native Array#sort is stable. The bounded selector below preserves the same
// stable input order for equal discoveredAt values by carrying the original
// eligible-order index as an explicit tie-breaker.

function discoveredAtV66(token){
  return Number(token?.discoveredAt||0);
}

function compareOldestV66(a,b){
  if(a.discoveredAt!==b.discoveredAt){
    return a.discoveredAt-b.discoveredAt;
  }

  return a.order-b.order;
}

function pushBoundedOldestV66(bucket,item,limit){
  if(limit<=0)return;

  let lo=0;
  let hi=bucket.length;

  while(lo<hi){
    const mid=(lo+hi)>>1;

    if(compareOldestV66(bucket[mid],item)<=0){
      lo=mid+1;
    }else{
      hi=mid;
    }
  }

  bucket.splice(lo,0,item);

  if(bucket.length>limit){
    bucket.pop();
  }
}

export function selectDiscoveryBridgeWorkV66({
  tokens=[],
  now=Date.now(),
  maxAgeMs,
  minAgeMs,
  freshMaxAgeMs,
  freshBatch,
  recoveryBatch,
  slaEscalateMs,
  slaMs,
  isPump,
  ageMs,
  needsFastStart
}={}){
  const freshLimit=Math.max(0,Number(freshBatch)||0);
  const recoveryLimit=Math.max(0,Number(recoveryBatch)||0);

  const freshTop=[];
  const recoveryTop=[];

  let eligibleCount=0;
  let currentFreshBacklog=0;
  let currentUrgentFreshBacklog=0;
  let oldestFreshUnprocessedAgeMs=0;
  let slaMissesCurrent=0;
  let eligibleOrder=0;

  for(const token of Array.isArray(tokens)?tokens:[]){
    if(!isPump(token))continue;

    const age=ageMs(token,now);

    if(
      age>maxAgeMs ||
      age<minAgeMs
    ){
      continue;
    }

    const order=eligibleOrder++;
    eligibleCount++;

    const inFreshWindow=
      age<=freshMaxAgeMs;

    // Old code called bridgeNeedsFastStart only for fresh-window tokens when
    // deciding fresh/recovery membership. No ordering semantics depend on it.
    const needsFast=
      inFreshWindow &&
      Boolean(needsFastStart(token));

    const item={
      token,
      order,
      discoveredAt:discoveredAtV66(token)
    };

    if(needsFast){
      currentFreshBacklog++;

      if(age>=slaEscalateMs){
        currentUrgentFreshBacklog++;
      }

      if(age>oldestFreshUnprocessedAgeMs){
        oldestFreshUnprocessedAgeMs=age;
      }

      if(age>slaMs){
        slaMissesCurrent++;
      }

      pushBoundedOldestV66(
        freshTop,
        item,
        freshLimit
      );
    }else{
      // This is exactly the old recovery predicate:
      // !freshWindow.includes(token) || !bridgeNeedsFastStart(token)
      pushBoundedOldestV66(
        recoveryTop,
        item,
        recoveryLimit
      );
    }
  }

  const fresh=freshTop.map(item=>item.token);
  const recovery=recoveryTop.map(item=>item.token);

  return {
    fresh,
    recovery,
    eligibleCount,
    currentFreshBacklog,
    currentUrgentFreshBacklog,
    oldestFreshUnprocessedAgeMs:
      currentFreshBacklog
        ? oldestFreshUnprocessedAgeMs
        : 0,
    slaMissesCurrent,
    hasFreshEscalation:
      fresh.some(
        token=>
          ageMs(token,now)>=slaEscalateMs
      )
  };
}
