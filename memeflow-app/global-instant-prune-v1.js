// MEMEFLOW_GLOBAL_INSTANT_PRUNE_V1
(()=>{
  'use strict';

  if(window.MEMEFLOW_GLOBAL_PRUNE_V1)return;

  const globalPrunedMints=new Set();
  const subscribers=new Set();
  const seenEvents=new Set();
  const storageKey='memeflow:global-token-removed:v1';
  const channel=
    typeof BroadcastChannel==='function'
      ? new BroadcastChannel('memeflow:global-events:v1')
      : null;

  const mintOf=value=>String(
    value?.mint||
    value?.tokenMint||
    value?.tokenAddress||
    value?.address||
    ''
  ).trim();

  function eventId(payload){
    return String(
      payload?.eventId||
      `${payload?.seq||''}:${payload?.ts||''}:${mintOf(payload)}`
    );
  }

  function remember(id){
    if(seenEvents.has(id))return false;
    seenEvents.add(id);
    if(seenEvents.size>500){
      const oldest=seenEvents.values().next().value;
      seenEvents.delete(oldest);
    }
    return true;
  }

  function purgeRenderedCandidate(mint){
    document.querySelectorAll(
      '.candidate[data-mint],'+
      '#candidateQueue [data-mint],'+
      '#mobileQueue [data-mint],'+
      '#candidateList [data-mint],'+
      '.flow-token[data-mint]'
    ).forEach(node=>{
      const owner=
        node.matches?.('.candidate,.flow-token')
          ? node
          : node.closest?.('.candidate,.flow-token,[data-candidate]');
      const ownerMint=mintOf({
        mint:
          owner?.getAttribute?.('data-mint')||
          node.getAttribute?.('data-mint')
      });
      if(ownerMint===mint)(owner||node).remove();
    });
  }

  function apply(payload,{relay=false}={}){
    if(payload?.type!=='token_removed')return false;
    const mint=mintOf(payload);
    if(!mint)return false;

    const id=eventId(payload);
    if(!remember(id))return false;

    if(payload.sessionPruned!==false){
      globalPrunedMints.add(mint);
    }

    const detail={...payload,mint,eventId:id};
    purgeRenderedCandidate(mint);
    subscribers.forEach(listener=>{
      try{listener(detail)}catch(error){
        console.warn('[MEMEFLOW PRUNE] subscriber',error);
      }
    });
    window.dispatchEvent(
      new CustomEvent('memeflow:tokenremoved',{detail})
    );

    if(relay){
      try{channel?.postMessage(detail)}catch{}
      if(!channel){
        try{
          localStorage.setItem(
            storageKey,
            JSON.stringify({...detail,relayedAt:Date.now()})
          );
        }catch{}
      }
    }
    return true;
  }

  channel?.addEventListener(
    'message',
    event=>apply(event.data)
  );

  window.addEventListener('storage',event=>{
    if(event.key!==storageKey||!event.newValue)return;
    try{apply(JSON.parse(event.newValue))}catch{}
  });

  if(typeof EventSource==='function'){
    const source=new EventSource('/api/system/stream');
    source.addEventListener('token_removed',event=>{
      try{
        apply(
          {...JSON.parse(event.data||'{}'),type:'token_removed'},
          {relay:true}
        );
      }catch(error){
        console.warn('[MEMEFLOW PRUNE] invalid event',error);
      }
    });
  }

  window.MEMEFLOW_GLOBAL_PRUNE_V1={
    globalPrunedMints,
    isPruned:mint=>globalPrunedMints.has(String(mint||'')),
    filterRows:rows=>
      (Array.isArray(rows)?rows:[]).filter(
        row=>!globalPrunedMints.has(mintOf(row))
      ),
    subscribe(listener){
      if(typeof listener!=='function')return ()=>{};
      subscribers.add(listener);
      return ()=>subscribers.delete(listener);
    }
  };
})();