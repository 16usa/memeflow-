
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number.isFinite(v)?v:0));

function pickPrice(payload){
  if(Number.isFinite(payload)&&payload>0)return Number(payload);
  if(!payload||typeof payload!=='object')return null;

  const keys=[
    'price','currentPrice','current_price',
    'tokenPrice','token_price',
    'lastPrice','last_price',
    'markPrice','mark_price'
  ];

  for(const k of keys){
    const v=Number(payload[k]);
    if(Number.isFinite(v)&&v>0)return v;
  }

  for(const k of ['data','market','token','quote','payload']){
    const v=pickPrice(payload[k]);
    if(v)return v;
  }

  return null;
}

export function createMarketBridgeV35({
  motion,
  historyMs=8000,
  sampleMinMs=80
}={}){
  if(!motion||typeof motion.setMarket!=='function'){
    throw new Error('[MARKET BRIDGE V35] motion.setMarket required');
  }

  const samples=[];
  let enabled=true;
  let source='demo';
  let lastSampleAt=0;
  let lastRealAt=0;
  let lastBoostAt=-Infinity;
  let pollTimer=0;
  let demoTimer=0;
  let eventHandler=null;

  let telemetry={
    source:'demo',
    price:1,
    shortReturn:0,
    mediumReturn:0,
    direction:0,
    speed:0.22,
    thrust:0.25,
    volatility:0.08,
    boost:0
  };

  const nearestBefore=(target)=>{
    for(let i=samples.length-1;i>=0;i--){
      if(samples[i].t<=target)return samples[i];
    }
    return samples[0]||null;
  };

  function pushPrice(rawPrice,t=performance.now(),nextSource='external'){
    const price=Number(rawPrice);
    if(!Number.isFinite(price)||price<=0)return null;

    if(samples.length&&t-lastSampleAt<sampleMinMs){
      return telemetry;
    }

    lastSampleAt=t;

    if(nextSource!=='demo'){
      source=nextSource;
      lastRealAt=Date.now();
    }else if(Date.now()-lastRealAt>1400){
      source='demo';
    }

    samples.push({p:price,t});

    while(samples.length>2&&samples[0].t<t-historyMs){
      samples.shift();
    }

    const shortRef=nearestBefore(t-1400);
    const mediumRef=nearestBefore(t-5000);

    const shortReturn=shortRef
      ? Math.log(price/shortRef.p)
      : 0;

    const mediumReturn=mediumRef
      ? Math.log(price/mediumRef.p)
      : shortReturn;

    let sumSq=0;
    let count=0;

    for(let i=Math.max(1,samples.length-24);i<samples.length;i++){
      const a=samples[i-1];
      const b=samples[i];

      const dt=Math.max(0.04,(b.t-a.t)/1000);
      const r=Math.log(b.p/a.p)/Math.sqrt(dt);

      sumSq+=r*r;
      count++;
    }

    const rms=count
      ? Math.sqrt(sumSq/count)
      : 0;

    const volatility=clamp(rms/0.0035,0,1);

    const momentum=
      shortReturn*0.72+
      mediumReturn*0.28;

    const direction=Math.tanh(momentum/0.0025);

    const speed=clamp(
      0.18+
      Math.abs(direction)*0.58+
      volatility*0.22,
      0,
      1
    );

    const thrust=clamp(
      0.20+
      Math.max(direction,0)*0.70+
      speed*0.12-
      Math.max(-direction,0)*0.15,
      0.08,
      1
    );

    let boost=0;
    const now=performance.now();

    if(
      direction>0.82 &&
      shortReturn>0.0035 &&
      now-lastBoostAt>2600
    ){
      boost=1;
      lastBoostAt=now;
    }

    telemetry={
      source,
      price,
      shortReturn,
      mediumReturn,
      direction,
      speed,
      thrust,
      volatility,
      boost
    };

    if(enabled){
      motion.setMarket({
        direction,
        speed,
        thrust,
        volatility,
        boost
      });
    }

    return telemetry;
  }

  function handlePayload(payload,nextSource='external'){
    const price=pickPrice(payload);

    if(price!=null){
      pushPrice(
        price,
        performance.now(),
        nextSource
      );
    }

    return price;
  }

  function startDemo(){
    if(demoTimer)return;

    const started=performance.now();

    demoTimer=window.setInterval(()=>{
      // If real data is arriving, demo immediately gets out of the way.
      if(Date.now()-lastRealAt<1400)return;

      const t=(performance.now()-started)/1000;
      const cycle=t%18;

      // Synthetic pump + dump only for V35 visual verification.
      const pump=
        0.010*
        Math.exp(
          -Math.pow((cycle-5.2)/1.20,2)
        );

      const dump=
        -0.008*
        Math.exp(
          -Math.pow((cycle-12.3)/1.05,2)
        );

      const wave=
        0.0022*Math.sin(t*0.42)+
        0.0008*Math.sin(t*1.55);

      pushPrice(
        1+wave+pump+dump,
        performance.now(),
        'demo'
      );
    },120);
  }

  function startStatePolling(url='/data/state.json'){
    if(pollTimer)return;

    pollTimer=window.setInterval(async()=>{
      try{
        const res=await fetch(
          `${url}?v=${Date.now()}`,
          {cache:'no-store'}
        );

        if(!res.ok)return;

        const data=await res.json();
        handlePayload(data,'state.json');
      }catch{}
    },500);
  }

  function bindWindowEvent(name='memeflow:price'){
    eventHandler=(event)=>{
      handlePayload(event?.detail,'event');
    };

    window.addEventListener(
      name,
      eventHandler
    );
  }

  function start({
    stateUrl='/data/state.json',
    demoFallback=true,
    eventName='memeflow:price'
  }={}){
    bindWindowEvent(eventName);

    if(stateUrl){
      startStatePolling(stateUrl);
    }

    if(demoFallback){
      startDemo();
    }

    return api;
  }

  function setEnabled(value=true){
    enabled=Boolean(value);
    return enabled;
  }

  function destroy(){
    if(pollTimer)clearInterval(pollTimer);
    if(demoTimer)clearInterval(demoTimer);

    pollTimer=0;
    demoTimer=0;
  }

  const api={
    pushPrice,
    handlePayload,
    start,
    setEnabled,
    isEnabled:()=>enabled,
    getTelemetry:()=>telemetry,
    destroy
  };

  return api;
}
