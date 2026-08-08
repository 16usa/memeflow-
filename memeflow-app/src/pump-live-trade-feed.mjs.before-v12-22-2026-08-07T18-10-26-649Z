// MEMEFLOW V12.21 LIVE TRADE STREAM HOLDER FEED
// Independent Pump program logsSubscribe -> getTransaction -> V12.20 holder + V12.18 market ledgers.
const PUMP_PROGRAM='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

function listEnv(name){
  return String(process.env[name]||'').split(',').map(x=>x.trim()).filter(Boolean);
}
function wsFromHttp(u){
  try{
    const x=new URL(u);
    x.protocol=x.protocol==='https:'?'wss:':'ws:';
    return x.toString();
  }catch{return null}
}
async function makeWebSocket(url){
  if(typeof globalThis.WebSocket==='function') return new globalThis.WebSocket(url);
  const mod=await import('ws');
  return new mod.WebSocket(url);
}
async function rpcCall(url,method,params,timeoutMs=8000){
  const ctl=new AbortController();
  const t=setTimeout(()=>ctl.abort(),timeoutMs); t.unref?.();
  try{
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:ctl.signal});
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    const j=await r.json();
    if(j?.error)throw Error(j.error?.message||JSON.stringify(j.error));
    return j?.result??null;
  }finally{clearTimeout(t)}
}
function tokenFromStore(store,m){
  try{
    return store?.getToken?.(m) || store?.state?.tokens?.[m] ||
      (Array.isArray(store?.state?.tokens)?store.state.tokens.find(x=>x?.mint===m):null) || null;
  }catch{return null}
}

export function startPumpLiveTradeFeed(opts={}){
  const {
    eventHolderLedger,eventMarketLedger,store,publish,evaluateAI
  }=opts;

  const rpcUrls=listEnv('SOLANA_RPC_URLS');
  let wsUrls=listEnv('SOLANA_WS_URLS');
  if(!wsUrls.length)wsUrls=rpcUrls.map(wsFromHttp).filter(Boolean);

  const metrics={
    version:'V12.21',startedAt:Date.now(),connected:false,reconnects:0,
    notifications:0,signaturesQueued:0,signaturesProcessed:0,duplicates:0,
    txMissing:0,fetchErrors:0,holderSnapshots:0,marketSnapshots:0,
    repeatTradeEvents:0,distinctMints:0,distinctUsers:0,lastSignature:null,
    lastMint:null,lastError:null,queueDepth:0,active:0
  };

  const seen=new Map(), mintCounts=new Map(), users=new Set(), q=[];
  let active=0, stopped=false, ws=null, rpcIndex=0, wsIndex=0, reconnectTimer=null;

  function remember(sig){
    if(seen.has(sig)){metrics.duplicates++;return false}
    seen.set(sig,Date.now());
    if(seen.size>10000){
      const cutoff=Date.now()-10*60_000;
      for(const [k,v] of seen){if(v<cutoff)seen.delete(k);if(seen.size<=8000)break}
    }
    return true;
  }
  function enqueue(sig){
    if(!sig||!remember(sig))return;
    q.push(sig); metrics.signaturesQueued++; metrics.queueDepth=q.length;
    drain();
  }
  async function fetchTx(sig){
    if(!rpcUrls.length)throw Error('SOLANA_RPC_URLS is empty');
    let last=null;
    for(let i=0;i<rpcUrls.length;i++){
      const url=rpcUrls[(rpcIndex+i)%rpcUrls.length];
      try{
        const tx=await rpcCall(url,'getTransaction',[sig,{
          encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0
        }],8000);
        if(tx){rpcIndex=(rpcIndex+i+1)%rpcUrls.length;return tx}
      }catch(e){last=e}
    }
    if(last)throw last;
    return null;
  }
  async function processSig(sig){
    metrics.lastSignature=sig;
    let tx=null;
    // transaction may not be queryable for a few hundred ms after log notification
    for(const delay of [0,250,750,1500]){
      if(delay)await new Promise(r=>setTimeout(r,delay));
      try{tx=await fetchTx(sig)}catch(e){metrics.lastError=String(e?.message||e)}
      if(tx)break;
    }
    if(!tx){metrics.txMissing++;return}

    let hs=[],ms=[];
    try{hs=eventHolderLedger?.ingestTransaction?.(tx)||[]}catch(e){metrics.lastError='holder:'+String(e?.message||e)}
    try{ms=eventMarketLedger?.ingestTransaction?.(tx)||[]}catch(e){metrics.lastError='market:'+String(e?.message||e)}

    metrics.holderSnapshots+=hs.length;
    metrics.marketSnapshots+=ms.length;

    for(const snap of hs){
      const mint=snap?.mint;if(!mint)continue;
      const prev=mintCounts.get(mint)||0;
      mintCounts.set(mint,prev+1);
      if(prev>0)metrics.repeatTradeEvents++;
      metrics.distinctMints=mintCounts.size;
      if(snap?.eventLedgerLastUser)users.add(snap.eventLedgerLastUser);
      metrics.distinctUsers=users.size;
      metrics.lastMint=mint;

      // Creator from existing Pump CREATE token state, independent of trade signer.
      try{
        const t=tokenFromStore(store,mint);
        const creator=t?.creator||t?.developer||t?.creatorWallet||null;
        if(creator)eventHolderLedger?.setCreator?.(mint,creator);
      }catch{}

      let updated=null;
      try{updated=eventHolderLedger?.applyToStore?.(store,mint)}catch{}
      if(updated){
        try{Promise.resolve(evaluateAI?.(updated)).catch(()=>{})}catch{}
        try{publish?.(mint)}catch{}
      }
    }
    for(const snap of ms){
      const mint=snap?.mint;if(!mint)continue;
      try{
        const updated=eventMarketLedger?.applyToStore?.(store,mint);
        if(updated){
          try{Promise.resolve(evaluateAI?.(updated)).catch(()=>{})}catch{}
          try{publish?.(mint)}catch{}
        }
      }catch{}
    }
    metrics.signaturesProcessed++;
  }
  function drain(){
    const max=Math.max(1,Math.min(4,Number(process.env.PUMP_LIVE_TX_CONCURRENCY||2)));
    while(active<max&&q.length){
      const sig=q.shift();active++;metrics.active=active;metrics.queueDepth=q.length;
      processSig(sig).catch(e=>{metrics.fetchErrors++;metrics.lastError=String(e?.message||e)})
        .finally(()=>{active--;metrics.active=active;metrics.queueDepth=q.length;drain()});
    }
  }

  async function connect(){
    if(stopped||!wsUrls.length){
      if(!wsUrls.length)metrics.lastError='No SOLANA_WS_URLS/SOLANA_RPC_URLS';
      return;
    }
    const url=wsUrls[wsIndex++%wsUrls.length];
    try{
      ws=await makeWebSocket(url);
      ws.onopen=()=>{
        metrics.connected=true;
        try{ws.send(JSON.stringify({jsonrpc:'2.0',id:121,method:'logsSubscribe',
          params:[{mentions:[PUMP_PROGRAM]},{commitment:'confirmed'}]}))}catch{}
      };
      ws.onmessage=ev=>{
        try{
          const j=JSON.parse(typeof ev.data==='string'?ev.data:String(ev.data));
          const v=j?.params?.result?.value;
          if(!v?.signature||v?.err)return;
          metrics.notifications++;
          enqueue(v.signature);
        }catch(e){metrics.lastError='ws-message:'+String(e?.message||e)}
      };
      ws.onerror=e=>{metrics.lastError='ws-error'};
      ws.onclose=()=>{
        metrics.connected=false;
        if(stopped)return;
        metrics.reconnects++;
        clearTimeout(reconnectTimer);
        reconnectTimer=setTimeout(connect,1500);reconnectTimer.unref?.();
      };
    }catch(e){
      metrics.connected=false;metrics.lastError=String(e?.message||e);metrics.reconnects++;
      reconnectTimer=setTimeout(connect,1500);reconnectTimer.unref?.();
    }
  }

  connect();
  return {
    metrics:()=>({...metrics,queueDepth:q.length,active}),
    stop:()=>{stopped=true;clearTimeout(reconnectTimer);try{ws?.close?.()}catch{}}
  };
}
