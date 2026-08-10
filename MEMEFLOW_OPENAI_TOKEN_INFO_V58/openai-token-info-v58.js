(() => {
  'use strict';
  if (window.__MEMEFLOW_OPENAI_TOKEN_INFO_V58__) return;
  window.__MEMEFLOW_OPENAI_TOKEN_INFO_V58__ = true;

  const API='/api/openai/token-scan-v58';
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function root(){
    const h=[...document.querySelectorAll('h1,h2,h3,[role="heading"]')].find(x=>norm(x.textContent).toLowerCase()==='memeflow openai');
    return h?.closest('.mobile-sheet,.sheet,.modal,[role="dialog"]')||h?.parentElement?.parentElement||null;
  }
  function button(r){return [...(r?.querySelectorAll('button,[role="button"]')||[])].find(x=>['analyze','analyze token','scanning...'].includes(norm(x.textContent).toLowerCase()))||null}
  function input(r){const a=[...(r?.querySelectorAll('input[type="text"],input[type="search"],input:not([type]),textarea')||[])];return a.find(x=>/mint|pump|dexscreener/i.test(x.placeholder||''))||a[0]||null}
  function host(r){
    const phrases=['token analysis will appear here','scanning solana token','request timed out','check rpc/server status','paste a solana mint'];
    const a=[...(r?.querySelectorAll('div,section,article,p')||[])].filter(x=>phrases.some(p=>norm(x.textContent).toLowerCase().includes(p)));
    if(a.length){a.sort((x,y)=>x.querySelectorAll('*').length-y.querySelectorAll('*').length);return a[0]}
    return null;
  }
  function fmt(v,d=2){const n=Number(v);if(!Number.isFinite(n))return'—';if(Math.abs(n)>=1e9)return(n/1e9).toFixed(2)+'B';if(Math.abs(n)>=1e6)return(n/1e6).toFixed(2)+'M';if(Math.abs(n)>=1e3)return(n/1e3).toFixed(2)+'K';return n.toLocaleString(undefined,{maximumFractionDigits:d})}
  function usd(v){const n=Number(v);if(!Number.isFinite(n))return'—';return n>=1?'$'+n.toLocaleString(undefined,{maximumFractionDigits:4}):'$'+n.toPrecision(6)}
  function sol(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:8})+' SOL':'—'}
  function pct(v){const n=Number(v);return Number.isFinite(n)?n.toFixed(1)+'%':'—'}
  function row(k,v){return `<div class="data-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`}
  function loading(h){if(h)h.innerHTML='<div class="empty-state production-empty">Scanning Solana token…</div>'}
  function error(h,m){if(h)h.innerHTML=`<div class="empty-state production-empty">${esc(m||'Token scan failed.')}</div>`}
  function render(h,d){
    if(!h)return;const t=d.token||{},m=d.market||{},e=d.evaluation||{},s=d.sources||{};
    const name=[t.name,t.symbol?`(${t.symbol})`:''].filter(Boolean).join(' ')||t.mint||'Solana token';
    const price=Number.isFinite(Number(m.priceUsd))?usd(m.priceUsd):Number.isFinite(Number(m.priceSol))?sol(m.priceSol):'—';
    const cap=Number.isFinite(Number(m.marketCapUsd))?usd(m.marketCapUsd):Number.isFinite(Number(m.marketCapSol))?sol(m.marketCapSol):'—';
    const liq=Number.isFinite(Number(m.liquidityUsd))?usd(m.liquidityUsd):Number.isFinite(Number(m.liquiditySol))?sol(m.liquiditySol):'—';
    h.innerHTML=`<div class="data-list">${[
      row('Token',name),row('Price',price),row('Market cap',cap),row('Liquidity',liq),
      row('Holders',t.holderCount==null?'—':fmt(t.holderCount,0)),row('Top 10',pct(t.top10Pct)),
      row('Buy pressure',m.buyPressure==null?'—':Number(m.buyPressure).toFixed(2)+'×'),row('Developer',t.developerPct==null?'—':pct(t.developerPct)),
      row('Supply',t.totalSupply==null?'—':fmt(t.totalSupply)),row('AI score',e.score==null?'—':e.score),row('Confidence',e.confidence==null?'—':pct(e.confidence)),row('Decision',e.state||'—')
    ].join('')}</div><div class="reason" style="margin-top:12px"><b>${esc(e.primaryReason||e.reasons?.[0]||'Scan completed.')}</b><span>${esc([s.solana?'Solana':'',s.dexScreener?'DexScreener':'',s.cached?'MEMEFLOW cache':''].filter(Boolean).join(' · ')||'On-chain scan')}</span></div>`;
  }
  async function scan(r){
    const b=button(r),i=input(r),h=host(r);if(!b||!i||!h)return;
    const raw=String(i.value||'').trim();if(!raw)return error(h,'Enter a Solana mint address.');if(b.dataset.mfV58Busy==='1')return;
    const old=norm(b.textContent)||'Analyze';b.dataset.mfV58Busy='1';b.disabled=true;b.textContent='Scanning…';loading(h);
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),12500);
    try{
      const x=await fetch(API,{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({mint:raw}),signal:c.signal});
      const d=await x.json().catch(()=>({}));if(!x.ok)throw Error(d.message||d.error||`Token scan HTTP ${x.status}`);render(h,d);
    }catch(e){error(h,e?.name==='AbortError'?'Token scan exceeded 12 seconds. RPC returned no usable data.':(e?.message||'Token scan failed.'))}
    finally{clearTimeout(timer);b.disabled=false;b.textContent=old==='Scanning...'?'Analyze':old;delete b.dataset.mfV58Busy}
  }
  document.addEventListener('click',e=>{const r=root();if(!r)return;const b=e.target?.closest?.('button,[role="button"]');if(!b||!r.contains(b))return;const t=norm(b.textContent).toLowerCase();if(t!=='analyze'&&t!=='analyze token'&&t!=='scanning...')return;e.preventDefault();e.stopImmediatePropagation();scan(r)},true);
  document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const r=root(),i=input(r);if(!r||e.target!==i)return;e.preventDefault();scan(r)},true);
})();
