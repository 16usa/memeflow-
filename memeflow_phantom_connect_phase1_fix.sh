#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Phantom Connect Phase 1 — FIX =="

if [[ -f "memeflow-app/live-bootstrap.mjs" ]]; then
  cd memeflow-app
elif [[ -f "live-bootstrap.mjs" ]]; then
  :
else
  echo "ERROR: live-bootstrap.mjs not found. Run this from the MEMEFLOW repository root." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".phantom-connect-phase1-fix-backup-$STAMP"
mkdir -p "$BACKUP"
for f in live-bootstrap.mjs live-wallet-execution.js account-wallet-settings.js package.json .env.example; do
  [[ -f "$f" ]] && cp -p "$f" "$BACKUP/$f"
done
echo "Backup: $PWD/$BACKUP"

# Recreate the browser client with the current Phantom Browser SDK API.
cat > phantom-connect-client.mjs <<'EOF_CLIENT'
import {BrowserSDK,AddressType,NetworkId} from '@phantom/browser-sdk';
import {VersionedTransaction} from '@solana/web3.js';

const $=id=>document.getElementById(id);
let sdk=null,config=null;
const state={address:null,provider:null,busy:false,autoConfirm:false};

async function api(path,opt={}){
  const r=await fetch(path,{
    credentials:'same-origin',cache:'no-store',...opt,
    headers:{accept:'application/json',...(opt.body?{'content-type':'application/json'}:{}),...(opt.headers||{})}
  });
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||b.error||`HTTP ${r.status}`);
  return b;
}
function solanaAddress(rows=[]){
  const row=rows.find(x=>String(x?.addressType||x?.type||'').toLowerCase().includes('solana'))||rows[0];
  return row?.address||null;
}
function isMobile(){return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')}
function short(a){return a?`${a.slice(0,5)}…${a.slice(-5)}`:'Not connected'}
function message(text='',bad=false){
  const n=$('mfPhantomConnectMsg');
  if(!n)return;
  n.hidden=!text;n.textContent=text;n.classList.toggle('bad',bad);
}
function syncLegacy(){
  const connected=Boolean(state.address);
  if($('mfWalletProvider'))$('mfWalletProvider').textContent=connected?`Phantom · ${state.provider||'wallet'}`:'Not connected';
  if($('mfWalletAddressValue'))$('mfWalletAddressValue').textContent=state.address||'Connect Phantom';
  if($('mfWalletConnect'))$('mfWalletConnect').textContent=connected?'Reconnect wallet':'Connect wallet';
  if($('mfWalletCopy'))$('mfWalletCopy').disabled=!connected;
  if($('mfWalletDisconnect'))$('mfWalletDisconnect').disabled=!connected;
}
function render(){
  syncLegacy();
  if($('mfPcAddress'))$('mfPcAddress').textContent=short(state.address);
  if($('mfPcProvider'))$('mfPcProvider').textContent=state.provider||'—';
  const badge=$('mfPcBadge');
  if(badge){
    badge.textContent=state.address?'CONNECTED':'NOT CONNECTED';
    badge.classList.toggle('ok',!!state.address);
  }
  const auto=$('mfPcAutoConfirm');
  if(auto){
    auto.hidden=state.provider!=='injected';
    auto.textContent=state.autoConfirm?'Disable browser Auto-Confirm':'Enable browser Auto-Confirm';
  }
  for(const id of ['mfPcInjected','mfPcGoogle','mfPcApple','mfPcPhantomLogin','mfPcDisconnect','mfPcApproveMode'])
    if($(id))$(id).disabled=state.busy;
}
async function setConnected(result,provider){
  const addresses=result?.addresses||await sdk.getAddresses?.().catch(()=>[]);
  state.address=solanaAddress(addresses||[]);
  state.provider=provider||result?.provider||'phantom';
  if(!state.address)throw new Error('Phantom returned no Solana address.');
  await refreshAutoConfirm();
  render();
  window.dispatchEvent(new CustomEvent('memeflow:wallet-connected',{
    detail:{address:state.address,provider:state.provider}
  }));
  return state.address;
}
async function connect(provider){
  if(!sdk)throw new Error('Phantom Connect is not ready.');
  state.busy=true;render();message();
  try{
    const result=await sdk.connect({provider});
    return await setConnected(result,provider);
  }finally{state.busy=false;render()}
}
function openInPhantom(){
  const target=encodeURIComponent(location.href);
  const ref=encodeURIComponent(location.origin);
  location.href=`https://phantom.app/ul/browse/${target}?ref=${ref}`;
}
async function connectBest(){
  if(!sdk)throw new Error('Phantom Connect is not ready.');
  let installed=false;
  try{installed=await sdk.isPhantomInstalled()}catch{}
  if(installed)return connect('injected');

  if(config?.appId){
    if(isMobile())return connect('deeplink');
    return connect('phantom');
  }

  if(isMobile()){
    openInPhantom();
    return null;
  }
  throw new Error('Phantom extension is not installed. Add PHANTOM_APP_ID to enable Phantom Login / embedded wallet.');
}
async function disconnect(){
  state.busy=true;render();message();
  try{await sdk?.disconnect?.()}finally{
    state.address=null;state.provider=null;state.autoConfirm=false;
    state.busy=false;render();
  }
}
async function signAndSend(transactionBase64){
  if(!sdk||!state.address)throw new Error('Connect Phantom first.');
  const bytes=Uint8Array.from(atob(transactionBase64),c=>c.charCodeAt(0));
  const tx=VersionedTransaction.deserialize(bytes);
  const result=await sdk.solana.signAndSendTransaction(tx);
  const signature=result?.hash||result?.signature||result?.txid||null;
  if(typeof signature!=='string'||signature.length<40)
    throw new Error('Phantom returned no Solana transaction signature.');
  return signature;
}
async function refreshAutoConfirm(){
  if(!sdk||state.provider!=='injected'){
    state.autoConfirm=false;return;
  }
  try{
    const r=await sdk.getAutoConfirmStatus();
    state.autoConfirm=Boolean(r?.enabled);
  }catch{state.autoConfirm=false}
}
async function toggleAutoConfirm(){
  if(state.provider!=='injected')return;
  state.busy=true;render();message();
  try{
    if(state.autoConfirm)await sdk.disableAutoConfirm();
    else await sdk.enableAutoConfirm({chains:[NetworkId.SOLANA_MAINNET]});
    await refreshAutoConfirm();
    message(state.autoConfirm
      ?'Browser Auto-Confirm enabled for Solana Mainnet. This requires the active Phantom browser/extension session and is not the final 24/7 offline AUTO mode.'
      :'Browser Auto-Confirm disabled.');
  }catch(e){message(e.message||'Unable to change Auto-Confirm.',true)}
  finally{state.busy=false;render()}
}
async function armApproveMode(){
  state.busy=true;render();message();
  try{
    if(!state.address){
      await connectBest();
      if(!state.address)return;
    }
    const current=await api('/api/settings');
    const next={...(current.settings||{}),tradingEnvironment:'live',operatingMode:'assist'};
    await api('/api/settings',{
      method:'PUT',
      body:JSON.stringify({settings:next,version:current.version})
    });
    message('LIVE approval mode armed. BUY/SELL will be signed by the connected Phantom wallet.');
  }catch(e){message(e.message||'Unable to arm LIVE approval mode.',true)}
  finally{state.busy=false;render()}
}
function installUi(){
  const host=$('mfAccountWalletGroup')?.querySelector('.mf-account-grid');
  if(!host||$('mfPhantomConnectPanel'))return;

  const embeddedButtons=config?.appId?`
    <button id="mfPcPhantomLogin" type="button">Phantom Login</button>
    <button id="mfPcGoogle" type="button">Google · embedded wallet</button>
    <button id="mfPcApple" type="button">Apple · embedded wallet</button>`:'';

  const box=document.createElement('div');
  box.id='mfPhantomConnectPanel';
  box.className='mf-pc-panel';
  box.innerHTML=`
    <div class="mf-pc-head">
      <span><b>Wallet connection</b><small>Phantom Connect · non-custodial</small></span>
      <i id="mfPcBadge">NOT CONNECTED</i>
    </div>
    <div class="mf-pc-meta">
      <span><small>Provider</small><b id="mfPcProvider">—</b></span>
      <span><small>Address</small><b id="mfPcAddress">Not connected</b></span>
    </div>
    <div class="mf-pc-actions">
      <button id="mfPcInjected" type="button">Use Phantom wallet</button>
      <button id="mfPcOpenMobile" type="button">Open in Phantom app</button>
      ${embeddedButtons}
      <button id="mfPcDisconnect" type="button">Disconnect</button>
    </div>
    <div class="mf-pc-modes">
      <button id="mfPcApproveMode" class="selected" type="button">
        <b>Approve each trade</b>
        <small>Real BUY/SELL through your connected Phantom wallet</small>
      </button>
      <button id="mfPcAuto24" type="button" disabled>
        <b>AUTO LIVE · 24/7</b>
        <small>Smart Vault module required · intentionally locked</small>
      </button>
    </div>
    <button id="mfPcAutoConfirm" class="mf-pc-autoconfirm" type="button" hidden>
      Enable browser Auto-Confirm
    </button>
    <div class="mf-pc-note">
      <b>Non-custodial.</b> MEMEFLOW never receives your Phantom seed phrase or private key.
      The final 24/7 mode stays locked until the on-chain Smart Vault is installed and tested.
    </div>
    <div id="mfPhantomConnectMsg" class="mf-pc-msg" hidden></div>`;
  host.appendChild(box);

  $('mfPcInjected')?.addEventListener('click',()=>connectBest().catch(e=>message(e.message,true)));
  $('mfPcOpenMobile')?.addEventListener('click',openInPhantom);
  $('mfPcPhantomLogin')?.addEventListener('click',()=>connect('phantom').catch(e=>message(e.message,true)));
  $('mfPcGoogle')?.addEventListener('click',()=>connect('google').catch(e=>message(e.message,true)));
  $('mfPcApple')?.addEventListener('click',()=>connect('apple').catch(e=>message(e.message,true)));
  $('mfPcDisconnect')?.addEventListener('click',()=>disconnect().catch(e=>message(e.message,true)));
  $('mfPcApproveMode')?.addEventListener('click',armApproveMode);
  $('mfPcAutoConfirm')?.addEventListener('click',toggleAutoConfirm);
  render();
}
async function init(){
  config=await api('/api/phantom/config').catch(()=>({
    appId:'',auto24x7Ready:false
  }));

  const options=config.appId
    ?{
      providers:['google','apple','phantom','injected','deeplink'],
      addressTypes:[AddressType.solana],
      appId:config.appId,
      authOptions:{redirectUrl:location.origin+'/settings.html'},
      autoConnect:true
    }
    :{
      providers:['injected'],
      addressTypes:[AddressType.solana]
    };

  sdk=new BrowserSDK(options);

  sdk.on?.('connect',data=>{
    state.address=solanaAddress(data?.addresses||[]);
    state.provider=String(data?.provider||'phantom');
    refreshAutoConfirm().finally(()=>render());
  });
  sdk.on?.('disconnect',()=>{
    state.address=null;state.provider=null;state.autoConfirm=false;render();
  });

  if(config.appId){
    try{
      await sdk.autoConnect();
      if(sdk.isConnected?.()){
        const addresses=await sdk.getAddresses();
        state.address=solanaAddress(addresses||[]);
      }
    }catch{}
  }

  await refreshAutoConfirm();
  installUi();
  render();
}

window.MEMEFLOW_PHANTOM={
  connect,connectBest,openInPhantom,disconnect,
  address:()=>state.address,
  provider:()=>state.provider,
  signAndSend,
  auto24x7Ready:()=>Boolean(config?.auto24x7Ready)
};

if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',init,{once:true});
else
  init();
EOF_CLIENT

cat > phantom-connect.css <<'EOF_CSS'
.mf-pc-panel{grid-column:1/-1;border:1px solid var(--line,#28333e);border-radius:13px;padding:11px;margin-top:4px;background:rgba(255,255,255,.012)}
.mf-pc-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
.mf-pc-head b{display:block;font-size:12px}
.mf-pc-head small,.mf-pc-panel small{display:block;margin-top:3px;color:var(--muted,#84919f);font-size:9px;line-height:1.35}
.mf-pc-head i{font-style:normal;font-size:8px;letter-spacing:.08em;color:var(--muted,#84919f)}
.mf-pc-head i.ok{color:var(--green,#51e7a8)}
.mf-pc-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:9px}
.mf-pc-meta>span{border:1px solid var(--line,#28333e);border-radius:9px;padding:8px;min-width:0}
.mf-pc-meta b{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-pc-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}
.mf-pc-actions button,.mf-pc-autoconfirm{min-height:35px;border:1px solid var(--line,#28333e);border-radius:9px;background:transparent;color:var(--text,#eef4f8)}
.mf-pc-modes{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
.mf-pc-modes button{text-align:left;min-height:62px;padding:9px;border:1px solid var(--line,#28333e);border-radius:10px;background:transparent;color:var(--text,#eef4f8)}
.mf-pc-modes button.selected{border-color:rgba(91,202,232,.5);background:rgba(91,202,232,.06)}
.mf-pc-modes button:disabled{opacity:.52}
.mf-pc-autoconfirm{width:100%;margin-top:7px}
.mf-pc-note,.mf-pc-msg{margin-top:7px;border:1px solid var(--line,#28333e);border-radius:9px;padding:8px;font-size:9px;line-height:1.5;color:var(--muted,#84919f)}
.mf-pc-note b{color:var(--text,#eef4f8)}
.mf-pc-msg.bad{color:var(--red,#ff6679)}
@media(max-width:520px){
  .mf-pc-meta,.mf-pc-actions,.mf-pc-modes{grid-template-columns:1fr}
}
EOF_CSS

cat > patch-phantom-phase1-fix.mjs <<'EOF_PATCH'
import fs from 'node:fs';

function insertBeforeLineContaining(text,needle,insert,label){
  if(text.includes(insert.trim().slice(0,40)))return text;
  const i=text.indexOf(needle);
  if(i<0)throw new Error(`Anchor not found: ${label}`);
  const lineStart=text.lastIndexOf('\n',i)+1;
  return text.slice(0,lineStart)+insert+text.slice(lineStart);
}
function insertAfter(text,needle,insert,label){
  if(text.includes(insert.trim()))return text;
  const i=text.indexOf(needle);
  if(i<0)throw new Error(`Anchor not found: ${label}`);
  const at=i+needle.length;
  return text.slice(0,at)+insert+text.slice(at);
}

// live-bootstrap: robustly insert immediately before whatever line contains
// the existing /api/live/status branch. No formatting assumption.
{
  const file='live-bootstrap.mjs';
  let s=fs.readFileSync(file,'utf8');
  if(!s.includes("pathname==='/api/phantom/config'")){
    const route=`    if(req.method==='GET'&&pathname==='/api/phantom/config'){
      return json(res,200,{
        appId:String(process.env.PHANTOM_APP_ID||''),
        network:'mainnet-beta',
        nonCustodial:true,
        auto24x7Ready:false,
        smartVaultProgramId:String(process.env.MEMEFLOW_SMART_VAULT_PROGRAM_ID||'')
      });
    }

`;
    s=insertBeforeLineContaining(
      s,
      "pathname==='/api/live/status'",
      route,
      'live-bootstrap /api/live/status'
    );
  }
  fs.writeFileSync(file,s);
}

// Existing LIVE bridge: Phantom Connect wins when present; old injected
// Phantom/Solflare path remains as fallback.
{
  const file='live-wallet-execution.js';
  let s=fs.readFileSync(file,'utf8');

  if(!s.includes('const pcAddress=window.MEMEFLOW_PHANTOM?.address?.()')){
    const needle='  async function connectedWallet({interactive=false}={}) {';
    s=insertAfter(
      s,needle,
      `\n    const pcAddress=window.MEMEFLOW_PHANTOM?.address?.();\n    if(pcAddress)return {provider:null,address:String(pcAddress)};`,
      'connectedWallet'
    );
  }

  if(!s.includes('window.MEMEFLOW_PHANTOM?.signAndSend')){
    const needle='  async function signAndSend(transactionBase64) {';
    s=insertAfter(
      s,needle,
      `\n    if(window.MEMEFLOW_PHANTOM?.address?.()&&window.MEMEFLOW_PHANTOM?.signAndSend){\n      return await window.MEMEFLOW_PHANTOM.signAndSend(transactionBase64);\n    }`,
      'signAndSend'
    );
  }
  fs.writeFileSync(file,s);
}

// System Settings existing button routes through Phantom Connect when loaded.
{
  const file='account-wallet-settings.js';
  let s=fs.readFileSync(file,'utf8');

  if(!s.includes('window.MEMEFLOW_PHANTOM?.connectBest')){
    const needle='  async function connectWallet() {';
    s=insertAfter(
      s,needle,
      `\n    if (window.MEMEFLOW_PHANTOM?.connectBest) {\n      try { await window.MEMEFLOW_PHANTOM.connectBest(); return; }\n      catch (error) { message(error.message || 'Wallet connection failed.', true); return; }\n    }`,
      'connectWallet'
    );
  }

  if(!s.includes('MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER')){
    s+=`

/* MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER */
(() => {
  if (window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER__) return;
  window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER__=true;
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='/phantom-connect.css?v=phase1-fix-20260827';
  document.head.appendChild(css);
  const js=document.createElement('script');
  js.src='/phantom-connect-client.bundle.js?v=phase1-fix-20260827';
  js.defer=true;
  document.head.appendChild(js);
})();
/* /MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER */
`;
  }
  fs.writeFileSync(file,s);
}

// Environment example.
{
  const file='.env.example';
  let s=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  if(!s.includes('# Phantom Connect')){
    s+=`
# Phantom Connect — public application identifier from Phantom Portal
PHANTOM_APP_ID=

# Reserved for the audited on-chain AUTO LIVE Smart Vault.
MEMEFLOW_SMART_VAULT_PROGRAM_ID=
`;
  }
  fs.writeFileSync(file,s);
}

// Reproducible browser build.
{
  const file='package.json';
  const p=JSON.parse(fs.readFileSync(file,'utf8'));
  p.scripts||={};
  p.scripts['build:phantom-connect']='esbuild phantom-connect-client.mjs --bundle --minify --platform=browser --format=iife --target=es2020 --outfile=phantom-connect-client.bundle.js';
  fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');
}
EOF_PATCH

echo "Ensuring dependencies are installed..."
npm install --no-audit --no-fund @phantom/browser-sdk@latest @solana/web3.js@latest esbuild@latest

echo "Applying robust patch..."
node patch-phantom-phase1-fix.mjs

echo "Building Phantom Connect bundle..."
npm run build:phantom-connect

echo "Validation..."
node --check live-bootstrap.mjs
node --check live-wallet-execution.js
node --check account-wallet-settings.js
node --check phantom-connect-client.bundle.js
test -s phantom-connect-client.bundle.js

grep -q "pathname==='/api/phantom/config'" live-bootstrap.mjs
grep -q "MEMEFLOW_PHANTOM?.signAndSend" live-wallet-execution.js
grep -q "MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER" account-wallet-settings.js

echo
echo "== PHANTOM CONNECT PHASE 1 INSTALLED =="
echo "The previous anchor error is fixed."
echo
echo "Current behavior:"
echo "  - Existing Phantom extension/in-app browser works immediately."
echo "  - Mobile Phantom deep-link path is installed."
echo "  - Existing real LIVE Pump.fun BUY/SELL signing uses Phantom Connect."
echo "  - Approve-each-trade mode is available."
echo "  - Phantom extension Auto-Confirm is optional."
echo "  - Google/Apple/Phantom Login embedded-wallet options appear after PHANTOM_APP_ID is configured."
echo "  - 24/7 offline AUTO remains intentionally locked until Smart Vault is installed."
echo
echo "Next: restart Replit, then open System Settings -> Wallet."
echo "After that we will configure PHANTOM_APP_ID in Phantom Portal."
