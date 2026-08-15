
const GOOD_KEYS = new Set([
  'price',
  'currentprice',
  'tokenprice',
  'lastprice',
  'markprice',
  'liveprice',
  'tradeprice',
  'solprice'
]);

const BAD_WORDS = [
  'change',
  'percent',
  'pct',
  'marketcap',
  'market_cap',
  'liquidity',
  'volume',
  'amount',
  'balance',
  'supply',
  'holder',
  'score',
  'ratio',
  'high',
  'low'
];

function cleanKey(v=''){
  return String(v)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g,'');
}

function isBadPath(path){
  const p=path.toLowerCase();
  return BAD_WORDS.some(x=>p.includes(x));
}

function collectCandidates(
  value,
  path='root',
  out=[],
  depth=0
){
  if(depth>10)return out;

  if(Array.isArray(value)){
    value.slice(0,40).forEach((v,i)=>{
      collectCandidates(
        v,
        `${path}[${i}]`,
        out,
        depth+1
      );
    });
    return out;
  }

  if(!value || typeof value!=='object'){
    return out;
  }

  for(const [key,val] of Object.entries(value)){
    const nextPath=`${path}.${key}`;
    const ck=cleanKey(key);

    if(
      typeof val==='number' &&
      Number.isFinite(val) &&
      val>0 &&
      !isBadPath(nextPath)
    ){
      let score=0;

      if(GOOD_KEYS.has(ck))score+=100;

      if(ck==='price')score+=50;
      if(ck.includes('token') && ck.includes('price'))score+=45;
      if(ck.includes('current') && ck.includes('price'))score+=40;
      if(ck.includes('last') && ck.includes('price'))score+=35;

      if(nextPath.toLowerCase().includes('token'))score+=12;
      if(nextPath.toLowerCase().includes('market'))score+=5;

      if(score>0){
        out.push({
          path:nextPath,
          key,
          value:val,
          score
        });
      }
    }

    if(
      typeof val==='string' &&
      val.trim()!=='' &&
      !isBadPath(nextPath)
    ){
      const num=Number(val);

      if(
        Number.isFinite(num) &&
        num>0 &&
        (
          GOOD_KEYS.has(ck) ||
          ck.includes('price')
        )
      ){
        out.push({
          path:nextPath,
          key,
          value:num,
          score:
            (GOOD_KEYS.has(ck)?90:40)
        });
      }
    }

    if(val && typeof val==='object'){
      collectCandidates(
        val,
        nextPath,
        out,
        depth+1
      );
    }
  }

  return out;
}

export function createRealPriceSourceV36({
  market,
  url='/data/state.json',
  intervalMs=350
}={}){
  if(
    !market ||
    typeof market.pushPrice!=='function'
  ){
    throw new Error(
      '[V36] market.pushPrice required'
    );
  }

  let timer=0;
  let lockedPath='';
  let lastPrice=null;
  let lastSeen=0;
  let successfulReads=0;
  let failures=0;

  let status={
    state:'SEARCHING',
    path:'',
    price:null,
    ageMs:null,
    candidates:0,
    reads:0,
    failures:0
  };

  function findBest(data){
    const candidates=
      collectCandidates(data)
        .sort((a,b)=>b.score-a.score);

    if(!candidates.length){
      return {
        best:null,
        candidates
      };
    }

    if(lockedPath){
      const locked=
        candidates.find(
          x=>x.path===lockedPath
        );

      if(locked){
        return {
          best:locked,
          candidates
        };
      }
    }

    return {
      best:candidates[0],
      candidates
    };
  }

  async function poll(){
    try{
      const res=await fetch(
        `${url}?v=${Date.now()}`,
        {
          cache:'no-store',
          headers:{
            'Cache-Control':'no-cache'
          }
        }
      );

      if(!res.ok){
        throw new Error(
          `HTTP ${res.status}`
        );
      }

      const data=await res.json();

      const {
        best,
        candidates
      }=findBest(data);

      successfulReads++;

      if(!best){
        status={
          state:'NO PRICE FOUND',
          path:'',
          price:null,
          ageMs:null,
          candidates:0,
          reads:successfulReads,
          failures
        };
        return;
      }

      if(!lockedPath){
        lockedPath=best.path;
      }

      const now=Date.now();

      lastPrice=best.value;
      lastSeen=now;

      market.pushPrice(
        best.value,
        performance.now(),
        'REAL'
      );

      status={
        state:'LIVE',
        path:best.path,
        price:best.value,
        ageMs:0,
        candidates:candidates.length,
        reads:successfulReads,
        failures
      };

    }catch(err){
      failures++;

      status={
        ...status,
        state:'ERROR',
        failures,
        error:String(
          err?.message || err
        )
      };
    }
  }

  function start(){
    if(timer)return api;

    poll();

    timer=setInterval(
      poll,
      intervalMs
    );

    return api;
  }

  function destroy(){
    if(timer){
      clearInterval(timer);
      timer=0;
    }
  }

  function unlock(){
    lockedPath='';
  }

  function getStatus(){
    const now=Date.now();

    return {
      ...status,
      ageMs:
        lastSeen
          ? now-lastSeen
          : null,
      lastPrice
    };
  }

  const api={
    start,
    destroy,
    unlock,
    poll,
    getStatus
  };

  return api;
}
