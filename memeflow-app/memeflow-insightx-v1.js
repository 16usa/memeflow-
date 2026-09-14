// MEMEFLOW_INSIGHTX_WALLET_INTELLIGENCE_UI_V1
(() => {
  'use strict';

  const BUTTON_CLASS='mf-insightx-open-v1';
  const MODAL_ID='mfInsightXModalV1';
  let activeMint='';
  let activeName='';
  let requestSerial=0;
  let publicConfig=null;
  const prefetched=new Set();

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
  const pct=value=>finite(value)?`${Number(value).toFixed(Number(value)<10?1:0)}%`:'—';
  const num=value=>finite(value)?Number(value).toLocaleString(undefined,{maximumFractionDigits:2}):'—';

  function buttonSvg(){
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="7" y="5" width="13" height="13" rx="2.5"></rect>
        <path d="M7 9h13"></path>
        <path d="M4 8.5V17a3 3 0 0 0 3 3h9"></path>
        <circle cx="10" cy="7" r=".7"></circle>
        <circle cx="12.5" cy="7" r=".7"></circle>
      </svg>`;
  }

  function decorateCards(root=document){
    root.querySelectorAll?.('.flow-token').forEach(card=>{
      if(card.querySelector(`.${BUTTON_CLASS}`))return;
      const mint=String(card.dataset.mint||'').trim();
      const name=card.querySelector('.token-name');
      if(!mint||!name)return;
      const button=document.createElement('button');
      button.type='button';
      button.className=BUTTON_CLASS;
      button.dataset.mint=mint;
      button.setAttribute('aria-label','Open holder wallet map');
      button.setAttribute('title','Holder wallet map');
      button.innerHTML=buttonSvg();
      name.insertAdjacentElement('afterend',button);
    });
  }

  function ensureModal(){
    let modal=document.getElementById(MODAL_ID);
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id=MODAL_ID;
    modal.className='mf-insightx-modal-v1';
    modal.hidden=true;
    modal.innerHTML=`
      <div class="mf-insightx-backdrop-v1" data-mf-insightx-close></div>
      <section class="mf-insightx-panel-v1" role="dialog" aria-modal="true" aria-labelledby="mfInsightXTitleV1">
        <div class="mf-insightx-handle-v1" aria-hidden="true"></div>
        <header class="mf-insightx-header-v1">
          <div class="mf-insightx-title-wrap-v1">
            <span class="mf-insightx-kicker-v1">WALLET INTELLIGENCE · INSIGHTX</span>
            <h2 id="mfInsightXTitleV1">Holder wallet map</h2>
            <span class="mf-insightx-subtitle-v1">Shadow intelligence · canonical MEMEFLOW Score unchanged</span>
          </div>
          <div class="mf-insightx-actions-v1">
            <button type="button" class="mf-insightx-refresh-v1" data-mf-insightx-refresh aria-label="Refresh InsightX data" title="Refresh">↻</button>
            <button type="button" class="mf-insightx-close-v1" data-mf-insightx-close aria-label="Close holder wallet map">×</button>
          </div>
        </header>
        <div class="mf-insightx-status-v1" data-mf-insightx-status>Loading wallet intelligence…</div>
        <div class="mf-insightx-metrics-v1" data-mf-insightx-metrics hidden></div>
        <div class="mf-insightx-atlas-v1" data-mf-insightx-atlas></div>
      </section>`;
    document.body.appendChild(modal);
    return modal;
  }

  function metric(label,value){
    return `<div class="mf-insightx-metric-v1"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function renderMetrics(container,data){
    const intelligence=data?.intelligence||null;
    if(!intelligence){
      container.hidden=true;
      container.innerHTML='';
      return;
    }
    const distribution=intelligence.distribution||{};
    const tagBits=[];
    for(const tag of ['team','funding_address','volume_bot','intermediary']){
      const count=Number(intelligence?.tagCounts?.[tag]||0);
      if(count>0)tagBits.push(`${tag.replaceAll('_',' ')} ${count}`);
    }
    container.innerHTML=[
      metric('Clustered supply',pct(intelligence.clusteredSupplyPct)),
      metric('Largest cluster',pct(intelligence.largestClusterPct)),
      metric('Linked wallets',num(intelligence.linkedWalletCount)),
      metric('Clusters',num(intelligence.clusterCount)),
      metric('Bundlers',pct(intelligence.bundlersPct)),
      metric('Insiders + dev',pct(intelligence.insiderCombinedPct)),
      metric('Snipers',pct(intelligence.snipersPct)),
      metric('Nakamoto',num(distribution.nakamoto)),
      metric('Gini',num(distribution.gini)),
      metric('Top 10',pct(distribution.top10Pct)),
      tagBits.length?`<div class="mf-insightx-tags-v1">${tagBits.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''
    ].join('');
    container.hidden=false;
  }

  function renderAtlas(container,atlasUrl){
    container.innerHTML='';
    const url=String(atlasUrl||'');
    if(!url.startsWith('https://embed.insightx.network/atlas/')){
      container.innerHTML='<div class="mf-insightx-atlas-empty-v1">Atlas Live embed is not configured for this environment.</div>';
      return;
    }
    const iframe=document.createElement('iframe');
    iframe.className='mf-insightx-frame-v1';
    iframe.src=url;
    iframe.title='InsightX Atlas Live holder wallet map';
    iframe.allow='clipboard-write';
    iframe.loading='eager';
    iframe.referrerPolicy='strict-origin-when-cross-origin';
    container.appendChild(iframe);
  }

  async function loadActive({force=false}={}){
    if(!activeMint)return;
    const modal=ensureModal();
    const status=modal.querySelector('[data-mf-insightx-status]');
    const metrics=modal.querySelector('[data-mf-insightx-metrics]');
    const atlas=modal.querySelector('[data-mf-insightx-atlas]');
    const serial=++requestSerial;
    status.hidden=false;
    status.textContent=force?'Refreshing InsightX wallet intelligence…':'Loading InsightX wallet intelligence…';
    metrics.hidden=true;
    const query=new URLSearchParams({mint:activeMint});
    if(force)query.set('refresh','1');
    try{
      const response=await fetch(`/api/insightx/wallet-intelligence?${query}`,{
        credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}
      });
      const payload=await response.json().catch(()=>null);
      if(serial!==requestSerial)return;
      const atlasUrl=payload?.atlasUrl || publicConfig?.atlasUrl || '';
      renderAtlas(atlas,atlasUrl);
      renderMetrics(metrics,payload);
      const label=activeName||activeMint.slice(0,8)+'…';
      modal.querySelector('#mfInsightXTitleV1').textContent=`${label} · Holder wallet map`;
      if(payload?.ok){
        const partial=payload.status==='PARTIAL'?' · partial upstream data':'';
        const cached=payload.cached?' · cached':'';
        status.textContent=`InsightX ${payload.status||'READY'}${partial}${cached} · read-only shadow layer`;
      }else if(payload?.status==='API_KEY_MISSING'){
        status.textContent='InsightX API key is not configured. Atlas can still open when the production embed is configured.';
      }else if(payload?.status==='DISABLED'){
        status.textContent='InsightX wallet intelligence is disabled in this environment.';
      }else{
        status.textContent='InsightX metrics are temporarily unavailable. MEMEFLOW trading logic remains unaffected.';
      }
    }catch(error){
      if(serial!==requestSerial)return;
      metrics.hidden=true;
      status.textContent='InsightX metrics could not be loaded. MEMEFLOW trading logic remains unaffected.';
      renderAtlas(atlas,publicConfig?.atlasUrl||'');
    }
  }

  function openFor(button){
    const card=button.closest('.flow-token');
    activeMint=String(button.dataset.mint||card?.dataset?.mint||'').trim();
    activeName=String(card?.querySelector('.token-name')?.textContent||'').trim();
    if(!activeMint)return;
    const modal=ensureModal();
    modal.hidden=false;
    document.documentElement.classList.add('mf-insightx-modal-open-v1');
    requestAnimationFrame(()=>modal.classList.add('is-open'));
    publicConfig={...(publicConfig||{}),atlasUrl:`https://embed.insightx.network/atlas/sol/${encodeURIComponent(activeMint)}`};
    void loadActive();
  }

  function close(){
    const modal=document.getElementById(MODAL_ID);
    if(!modal||modal.hidden)return;
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('mf-insightx-modal-open-v1');
    setTimeout(()=>{if(!modal.classList.contains('is-open'))modal.hidden=true},180);
  }

  async function loadConfig(){
    try{
      const response=await fetch('/api/insightx/config',{credentials:'same-origin',cache:'no-store'});
      if(response.ok)publicConfig=await response.json();
    }catch{}
    maybePrefetch();
  }

  function maybePrefetch(){
    if(publicConfig?.shadowPrefetch!==true||publicConfig?.apiConfigured!==true)return;
    const cards=[...document.querySelectorAll('.flow-token[data-mint]')];
    let index=0;
    const next=()=>{
      if(index>=cards.length)return;
      const mint=String(cards[index++]?.dataset?.mint||'').trim();
      if(!mint||prefetched.has(mint)){schedule(next);return;}
      prefetched.add(mint);
      fetch(`/api/insightx/wallet-intelligence?mint=${encodeURIComponent(mint)}&compact=1`,{
        credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}
      }).catch(()=>{}).finally(()=>schedule(next));
    };
    schedule(next);
  }

  function schedule(fn){
    if('requestIdleCallback' in window)window.requestIdleCallback(fn,{timeout:1200});
    else setTimeout(fn,180);
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.(`.${BUTTON_CLASS}`);
    if(button){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openFor(button);
      return;
    }
    const closeButton=event.target.closest?.('[data-mf-insightx-close]');
    if(closeButton){event.preventDefault();close();return;}
    const refresh=event.target.closest?.('[data-mf-insightx-refresh]');
    if(refresh){event.preventDefault();void loadActive({force:true});}
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')close();
  });

  const observer=new MutationObserver(mutations=>{
    let changed=false;
    for(const mutation of mutations){
      if(mutation.addedNodes?.length){changed=true;break;}
    }
    if(!changed)return;
    decorateCards();
    maybePrefetch();
  });

  function boot(){
    decorateCards();
    observer.observe(document.getElementById('tokenList')||document.body,{subtree:true,childList:true});
    void loadConfig();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
