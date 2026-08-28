/* MEMEFLOW_NONCUSTODIAL_LIVE_SOLANA_V1 */
(() => {
  'use strict';
  if(window.__MEMEFLOW_NONCUSTODIAL_LIVE_SOLANA_V1__)return;
  window.__MEMEFLOW_NONCUSTODIAL_LIVE_SOLANA_V1__=true;
  const nativeFetch=window.fetch.bind(window),LIVE_PATH='/api/live/execute';
  let web3Promise=null,liveStatus=null,billingStatus=null,settingsState=null,uiBusy=false;

  const provider=()=>window.phantom?.solana?.isPhantom?window.phantom.solana:window.solana?.isPhantom?window.solana:window.solflare?.isSolflare?window.solflare:null;
  const providerName=p=>p?.isPhantom?'Phantom':p?.isSolflare?'Solflare':p?'Solana wallet':'Not connected';
  async function getJson(path,options={}){const r=await nativeFetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});let body={};try{body=await r.json()}catch{}if(!r.ok)throw Object.assign(Error(body.message||body.error||`HTTP ${r.status}`),{status:r.status,code:body.error});return body}
  function base64Bytes(v){const b=atob(v),out=new Uint8Array(b.length);for(let i=0;i<b.length;i++)out[i]=b.charCodeAt(i);return out}
  function loadWeb3(){if(window.solanaWeb3?.VersionedTransaction)return Promise.resolve(window.solanaWeb3);if(web3Promise)return web3Promise;web3Promise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.dataset.mfSolanaWeb3='1';s.src='/vendor/solana-web3.iife.js?v=1.98';s.onload=()=>window.solanaWeb3?.VersionedTransaction?resolve(window.solanaWeb3):reject(Error('Solana transaction library is unavailable.'));s.onerror=()=>reject(Error('Solana transaction library failed to load.'));document.head.appendChild(s)});return web3Promise}
  async function connectedWallet(interactive=false){const p=provider();if(!p)throw Error('Phantom or Solflare is required for LIVE trading.');if(!p.publicKey&&interactive)await p.connect();if(!p.publicKey)throw Error('Connect Phantom or Solflare before LIVE trading.');return {provider:p,address:String(p.publicKey.toString())}}
  async function signAndSend(tx64){const {provider:p}=await connectedWallet(true);if(typeof p.signAndSendTransaction!=='function')throw Error(`${providerName(p)} does not expose signAndSendTransaction.`);const web3=await loadWeb3(),tx=web3.VersionedTransaction.deserialize(base64Bytes(tx64));const sent=await p.signAndSendTransaction(tx,{skipPreflight:false,preflightCommitment:'confirmed'}),signature=typeof sent==='string'?sent:String(sent?.signature||'');if(!signature)throw Error('Wallet returned no Solana transaction signature.');return signature}
  const responseJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

  window.fetch=async function memeflowLiveFetch(input,init={}){
    let url;try{url=new URL(typeof input==='string'?input:input.url,location.href)}catch{return nativeFetch(input,init)}
    const method=String(init?.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase();
    if(url.origin!==location.origin||url.pathname!==LIVE_PATH||method!=='POST')return nativeFetch(input,init);
    try{
      const {address}=await connectedWallet(true);let body={};if(typeof init.body==='string'&&init.body.trim()){try{body=JSON.parse(init.body)}catch{return responseJson({error:'INVALID_JSON',message:'LIVE request body must be JSON.'},400)}}body={...body,walletAddress:address};
      const r=await nativeFetch(url.pathname+url.search,{...init,credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','content-type':'application/json',...(init.headers||{})},body:JSON.stringify(body)}),built=await r.clone().json().catch(()=>null);
      if(!r.ok||!built?.requiresWalletSignature||!built?.transaction)return r;
      const signature=await signAndSend(built.transaction),confirmation=await getJson('/api/live/confirm',{method:'POST',body:JSON.stringify({signature,intent:built.intent||null})}).catch(e=>({confirmed:false,message:e.message}));
      window.dispatchEvent(new CustomEvent('memeflow:live-executed',{detail:{...built,signature,confirmation}}));
      return responseJson({...built,executed:true,requiresWalletSignature:false,signature,confirmation});
    }catch(e){return responseJson({executed:false,error:e.code||'LIVE_WALLET_EXECUTION_FAILED',message:e.message||'LIVE wallet execution failed.'},e.status||409)}
  };

  window.MEMEFLOW_LIVE=Object.freeze({async execute(payload){const r=await window.fetch(LIVE_PATH,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload||{})}),b=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(b.message||b.error||`HTTP ${r.status}`),{status:r.status,code:b.error});return b},status:()=>liveStatus,wallet:()=>provider()?.publicKey?String(provider().publicKey.toString()):null});

  function findStat(label){const wanted=String(label).trim().toLowerCase();return [...document.querySelectorAll('.mf-account-stat')].find(n=>String(n.querySelector('small')?.textContent||'').trim().toLowerCase()===wanted)||null}
  function message(text='',danger=false){const n=document.getElementById('mfAccountWalletMessage');if(!n)return;n.hidden=!text;n.textContent=text;n.classList.toggle('danger',danger)}
  const armed=()=>String(settingsState?.settings?.tradingEnvironment||'paper').toLowerCase()==='live';
  function render(){
    const connected=Boolean(provider()?.publicKey),entitled=Boolean(billingStatus?.liveEntitled),adapter=Boolean(liveStatus?.enabled),isArmed=armed(),ready=adapter&&entitled&&connected;
    const live=findStat('LIVE execution')?.querySelector('b');if(live){live.textContent=isArmed&&ready?'LIVE ARMED':ready?'READY':'LOCKED';live.classList.toggle('mf-status-ok',ready);live.classList.toggle('mf-status-danger',!ready)}
    const ad=findStat('LIVE adapter')?.querySelector('b');if(ad){ad.textContent=adapter?'READY':'NOT READY';ad.classList.toggle('mf-status-ok',adapter);ad.classList.toggle('mf-status-danger',!adapter)}
    const mode=findStat('Trading mode')?.querySelector('b');if(mode)mode.textContent=isArmed?'LIVE · WALLET APPROVAL':'PAPER INDEPENDENT';
    const group=document.getElementById('mfAccountWalletGroup'),actions=group?.querySelector('.mf-account-actions');if(actions&&!document.getElementById('mfToggleLiveMode')){const b=document.createElement('button');b.id='mfToggleLiveMode';b.type='button';b.className='mf293-secondary';b.addEventListener('click',toggleLiveMode);actions.appendChild(b)}
    const btn=document.getElementById('mfToggleLiveMode');if(btn){btn.textContent=isArmed?'Return to PAPER':'Arm LIVE mode';btn.disabled=uiBusy||(!isArmed&&(!adapter||!entitled));btn.classList.toggle('mf-status-danger',isArmed)}
    const note=group?.querySelector('.mf-account-note.danger');if(note)note.innerHTML=adapter?(isArmed?'<strong>LIVE mode armed.</strong> Every real Pump.fun BUY/SELL must be approved inside your Phantom or Solflare wallet.':'<strong>LIVE adapter ready.</strong> Connect your wallet and press <em>Arm LIVE mode</em>. Real trades still require wallet approval.'):'<strong>LIVE execution locked.</strong> Set <code>LIVE_TRADING_ENABLED=true</code> and configure a Solana RPC in Replit Secrets. Until then the backend stays fail-closed.';
  }
  async function refresh(){const [l,b,s]=await Promise.all([getJson('/api/live/status').catch(()=>null),getJson('/api/billing/status').catch(()=>null),getJson('/api/settings').catch(()=>null)]);if(l)liveStatus=l;if(b)billingStatus=b;if(s)settingsState=s;render()}
  async function toggleLiveMode(){if(uiBusy)return;uiBusy=true;render();message();try{const cur=await getJson('/api/settings'),isArmed=String(cur.settings?.tradingEnvironment||'paper').toLowerCase()==='live';if(!isArmed){if(!liveStatus?.enabled)throw Error('LIVE adapter is not ready on the backend.');if(!billingStatus?.liveEntitled)throw Error('LIVE trading requires Pro or owner entitlement.');await connectedWallet(true)}const next={...(cur.settings||{}),tradingEnvironment:isArmed?'paper':'live',operatingMode:'assist'};await getJson('/api/settings',{method:'PUT',body:JSON.stringify({settings:next,version:cur.version})});await refresh();message(isArmed?'Returned to PAPER mode.':'LIVE mode armed. Each real transaction will open your wallet for approval.')}catch(e){message(e.message||'Unable to change LIVE mode.',true)}finally{uiBusy=false;render()}}
  const timer=setInterval(()=>{if(document.getElementById('mfAccountWalletGroup'))refresh()},5000);window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
})();
/* /MEMEFLOW_NONCUSTODIAL_LIVE_SOLANA_V1 */
