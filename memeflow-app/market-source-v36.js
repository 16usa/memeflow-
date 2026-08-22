
export function createRealPriceSourceV36({
  market,
  chainId='solana'
}={}){
  if(
    !market ||
    typeof market.pushPrice!=='function'
  ){
    throw new Error(
      '[V36.3] market.pushPrice required'
    );
  }

  let currentChain=chainId;
  let tokenAddress='';

  let es=null;
  let reconnectTimer=0;
  let destroyed=false;
  let generation=0;

  let lastPrice=null;
  let lastSeen=0;
  let reads=0;
  let failures=0;

  let eventHandler=null;

  let status={
    state:'STARTING',
    path:'',
    price:null,
    ageMs:null,
    candidates:0,
    reads:0,
    failures:0,
    tokenAddress:'',
    chainId:currentChain
  };

  function setStatus(
    state,
    extra={}
  ){
    status={
      ...status,
      state,
      ...extra,
      reads,
      failures,
      tokenAddress,
      chainId:currentChain
    };
  }

  function shortMint(){
    if(!tokenAddress)return '';
    return (
      tokenAddress.slice(0,6)+
      '…'+
      tokenAddress.slice(-4)
    );
  }

  function pushLivePrice(
    raw,
    source='SSE'
  ){
    const price=Number(raw);

    if(
      !Number.isFinite(price) ||
      price<=0
    ){
      return false;
    }

    lastPrice=price;
    lastSeen=Date.now();
    reads++;

    market.pushPrice(
      price,
      performance.now(),
      'REAL'
    );

    setStatus('LIVE',{
      price,
      candidates:1,
      path:
        `${source} ${shortMint()}`
    });

    return true;
  }

  function seedPoints(points){
    if(
      !Array.isArray(points) ||
      !points.length
    ){
      return 0;
    }

    const clean=points
      .map(x=>({
        t:Number(x?.t),
        p:Number(x?.p)
      }))
      .filter(x=>
        Number.isFinite(x.t) &&
        Number.isFinite(x.p) &&
        x.p>0
      )
      .sort((a,b)=>a.t-b.t);

    if(!clean.length)return 0;

    const latest=
      clean[clean.length-1].t;

    // Market Bridge currently needs only a short window.
    const recent=
      clean.filter(
        x=>latest-x.t<=8000
      );

    const selected=
      recent.length>=3
        ? recent
        : clean.slice(-12);

    const perfNow=
      performance.now();

    let pushed=0;

    for(const point of selected){
      const age=
        Math.max(
          0,
          latest-point.t
        );

      const perfT=
        perfNow-age;

      market.pushPrice(
        point.p,
        perfT,
        'REAL'
      );

      lastPrice=point.p;
      pushed++;
    }

    if(pushed){
      lastSeen=Date.now();
      reads+=pushed;

      setStatus('LIVE',{
        price:lastPrice,
        candidates:1,
        path:
          `HISTORY ${shortMint()}`
      });
    }

    return pushed;
  }

  async function loadHistory(
    localGeneration
  ){
    if(!tokenAddress)return;

    try{
      setStatus('LOADING HISTORY',{
        candidates:1,
        path:shortMint()
      });

      const q=
        new URLSearchParams({
          chainId:currentChain,
          tokenAddress,
          interval:'1s',
          limit:'120'
        });

      const res=
        await fetch(
          '/api/chart/history?'+q,
          {
            credentials:'include',
            cache:'no-store'
          }
        );

      const data=
        await res.json()
          .catch(()=>({}));

      if(
        destroyed ||
        localGeneration!==generation
      ){
        return;
      }

      if(!res.ok){
        throw new Error(
          data?.error ||
          `history HTTP ${res.status}`
        );
      }

      seedPoints(
        data?.points || []
      );

    }catch(err){
      failures++;

      setStatus('HISTORY ERROR',{
        candidates:tokenAddress?1:0,
        error:String(
          err?.message || err
        )
      });
    }
  }

  function closeStream(){
    if(es){
      try{
        es.close();
      }catch{}
      es=null;
    }

    if(reconnectTimer){
      clearTimeout(
        reconnectTimer
      );
      reconnectTimer=0;
    }
  }

  function applySnapshot(data){
    if(
      Array.isArray(data?.points)
    ){
      seedPoints(data.points);
      return;
    }

    if(
      Array.isArray(
        data?.snapshot?.points
      )
    ){
      seedPoints(
        data.snapshot.points
      );
    }
  }

  function connectStream(
    localGeneration
  ){
    if(
      destroyed ||
      !tokenAddress ||
      localGeneration!==generation
    ){
      return;
    }

    closeStream();

    setStatus('CONNECTING',{
      candidates:1,
      path:shortMint()
    });

    const q=
      new URLSearchParams({
        chainId:currentChain,
        tokenAddress,
        interval:'1s',
        limit:'600'
      });

    const streamUrl=
      '/api/chart/stream?'+q;

    es=
      new EventSource(
        streamUrl
      );

    es.addEventListener(
      'snapshot',
      event=>{
        if(
          destroyed ||
          localGeneration!==generation
        ){
          return;
        }

        try{
          const data=
            JSON.parse(
              event.data
            );

          applySnapshot(data);

        }catch(err){
          console.warn(
            '[V36.3 snapshot]',
            err
          );
        }
      }
    );

    es.addEventListener(
      'update',
      event=>{
        if(
          destroyed ||
          localGeneration!==generation
        ){
          return;
        }

        try{
          const data=
            JSON.parse(
              event.data
            );

          if(data?.snapshot){
            applySnapshot(
              data.snapshot
            );
          }

          if(data?.point){
            pushLivePrice(
              data.point.p,
              'SSE'
            );
          }

          if(
            data?.status?.stale &&
            Date.now()-lastSeen>5000
          ){
            setStatus('STALE',{
              price:lastPrice,
              candidates:1,
              path:shortMint()
            });
          }

        }catch(err){
          console.warn(
            '[V36.3 update]',
            err
          );
        }
      }
    );

    es.onopen=()=>{
      if(
        destroyed ||
        localGeneration!==generation
      ){
        return;
      }

      setStatus(
        lastPrice
          ? 'LIVE'
          : 'CONNECTED',
        {
          price:lastPrice,
          candidates:1,
          path:
            `SSE ${shortMint()}`
        }
      );
    };

    es.onerror=()=>{
      if(
        destroyed ||
        localGeneration!==generation
      ){
        return;
      }

      failures++;

      setStatus('RECONNECTING',{
        price:lastPrice,
        candidates:1,
        path:shortMint()
      });

      closeStream();

      reconnectTimer=
        setTimeout(()=>{
          connectStream(
            localGeneration
          );
        },2500);
    };
  }

  async function selectToken(
    detail={}
  ){
    const next=
      String(
        detail.tokenAddress ||
        detail.mint ||
        ''
      ).trim();

    const nextChain=
      String(
        detail.chainId ||
        detail.chain ||
        currentChain ||
        'solana'
      );

    if(!next){
      return false;
    }

    if(
      next===tokenAddress &&
      nextChain===currentChain &&
      es
    ){
      return true;
    }

    generation++;
    const localGeneration=
      generation;

    tokenAddress=next;
    currentChain=nextChain;

    lastPrice=null;
    lastSeen=0;

    closeStream();

    setStatus('TOKEN SELECTED',{
      price:null,
      candidates:1,
      path:shortMint()
    });

    await loadHistory(
      localGeneration
    );

    if(
      destroyed ||
      localGeneration!==generation
    ){
      return false;
    }

    connectStream(
      localGeneration
    );

    return true;
  }

  async function loadConfig(){
    try{
      setStatus('CONFIG',{
        path:'/api/chart/config'
      });

      const res=
        await fetch(
          '/api/chart/config',
          {
            credentials:'include',
            cache:'no-store'
          }
        );

      if(!res.ok){
        throw new Error(
          `config HTTP ${res.status}`
        );
      }

      const config=
        await res.json();

      const nextChain=
        config?.chainId ||
        currentChain ||
        'solana';

      const nextToken=
        config?.tokenAddress ||
        config?.mint ||
        '';

      currentChain=
        nextChain;

      if(nextToken){
        await selectToken({
          tokenAddress:nextToken,
          chainId:nextChain
        });
      }else{
        setStatus(
          'WAITING CANDIDATE',
          {
            price:null,
            candidates:0,
            path:
              'memeflow:candidatechange'
          }
        );
      }

    }catch(err){
      failures++;

      setStatus(
        'CONFIG ERROR',
        {
          price:null,
          candidates:0,
          error:String(
            err?.message || err
          )
        }
      );
    }
  }

  function bindCandidateEvent(){
    eventHandler=
      event=>{
        const detail=
          event?.detail || {};

        selectToken(detail);
      };

    window.addEventListener(
      'memeflow:candidatechange',
      eventHandler
    );
  }

  function start(){
    destroyed=false;

    bindCandidateEvent();
    loadConfig();

    return api;
  }

  // Kept for compatibility with older V36 test code.
  function poll(){
    return loadConfig();
  }

  function unlock(){
    tokenAddress='';
    lastPrice=null;
    lastSeen=0;

    generation++;
    closeStream();

    setStatus(
      'WAITING CANDIDATE',
      {
        price:null,
        candidates:0,
        path:
          'memeflow:candidatechange'
      }
    );
  }

  function destroy(){
    destroyed=true;
    generation++;

    closeStream();

    if(eventHandler){
      window.removeEventListener(
        'memeflow:candidatechange',
        eventHandler
      );
      eventHandler=null;
    }
  }

  function getStatus(){
    return {
      ...status,

      ageMs:
        lastSeen
          ? Date.now()-lastSeen
          : null,

      lastPrice,
      price:
        status.price ??
        lastPrice,

      candidates:
        tokenAddress
          ? 1
          : 0,

      reads,
      failures,
      tokenAddress,
      chainId:currentChain
    };
  }

  const api={
    start,
    poll,
    unlock,
    destroy,
    selectToken,
    getStatus
  };

  return api;
}
