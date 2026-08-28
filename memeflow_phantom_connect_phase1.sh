#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Phantom Connect + final LIVE UX foundation =="

if [[ -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" ]]; then
  :
else
  echo "ERROR: run from the MEMEFLOW repository root or memeflow-app directory." >&2
  exit 1
fi

test -f live-bootstrap.mjs || {
  echo "ERROR: live-bootstrap.mjs is missing. Install the existing LIVE v1 patch first." >&2
  exit 1
}

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".phantom-connect-phase1-backup-$STAMP"
mkdir -p "$BACKUP"
for f in live-bootstrap.mjs live-wallet-execution.js account-wallet-settings.js package.json .env.example; do
  [[ -f "$f" ]] && cp -p "$f" "$BACKUP/$f"
done
echo "Backup: $PWD/$BACKUP"

cat > phantom-connect-client.mjs <<'EOF_CLIENT'
import {BrowserSDK,AddressType,NetworkId} from '@phantom/browser-sdk';
import {VersionedTransaction} from '@solana/web3.js';

const $=id=>document.getElementById(id);
let sdk=null;
let config=null;
let state={address:null,provider:null,busy:false,autoConfirm:false};

async function api(path,opt={}){
  const r=await fetch(path,{
    credentials:'same-origin',cache:'no-store',...opt,
    headers:{accept:'application/json',...(opt.body?{'content-type':'application/json'}:{}),...(opt.headers||{})}
  });
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||b.error||`HTTP ${r.status}`);
  return b;
}
function solanaAddress(addresses=[]){
  const row=addresses.find(x=>String(x.addressType||x.type||'').toLowerCase().includes('solana'))||addresses[0];
  return row?.address||null;
}
function mobile(){return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')}
function short(a){return a?`${a.slice(0,5)}…${a.slice(-5)}`:'Not connected'}
function msg(text='',bad=false){
  const n=$('mfPhantomConnectMsg');if(!n)return;
  n.hidden=!text;n.textContent=text;n.classList.toggle('bad',bad);
}
function render(){
  const addr=$('mfPcAddress'),provider=$('mfPcProvider'),badge=$('mfPcBadge');
  if(addr)addr.textContent=short(state.address);
  if(provider)provider.textContent=state.provider||'—';
  if(badge){
    badge.textContent=state.address?'CONNECTED':'NOT CONNECTED';
    badge.classList.toggle('ok',!!state.address);
  }
  const ac=$('mfPcAutoConfirm');
  if(ac){
    ac.hidden=state.provider!=='injected';
    ac.textContent=state.autoConfirm?'Disable browser Auto-Confirm':'Enable browser Auto-Confirm';
  }
  for(const id of ['mfPcInjected','mfPcGoogle','mfPcApple','mfPcDisconnect','mfPcApproveMode'])
    if($(id))$(id).disabled=state.busy;
}
async function init(){
  config=await api('/api/phantom/config').catch(()=>({appId:'',auto24x7Ready:false}));
  const providers=config.appId?['google','apple','injected']:['injected'];
  sdk=new BrowserSDK({
    providers,
    addressTypes:[AddressType.solana],
    ...(config.appId?{appId:config.appId,authOptions:{redirectUrl:location.origin+'/settings.html'}}:{}),
    autoConnect:!!config.appId
  });
  sdk.on?.('connect',data=>{
    state.address=solanaAddress(data?.addresses||[]);
    state.provider=String(data?.provider||'phantom');
    render();
  });
  sdk.on?.('disconnect',()=>{state.address=null;state.provider=null;state.autoConfirm=false;render()});
  if(config.appId){
    try{
      const result=await sdk.autoConnect?.();
      const addresses=result?.addresses||await sdk.getAddresses?.().catch(()=>[]);
      const a=solanaAddress(addresses||[]);
      if(a){state.address=a;state.provider=result?.provider||'embedded/session'}
    }catch{}
  }
  await refreshAutoConfirm();
  render();
  installUi();
}
async function connect(provider){
  if(!sdk)throw new Error('Phantom Connect is not ready.');
  state.busy=true;render();msg();
  try{
    const result=await sdk.connect({provider});
    state.address=solanaAddress(result?.addresses||[]);
    state.provider=provider;
    if(!state.address)throw new Error('Phantom returned no Solana address.');
    await refreshAutoConfirm();
    render();
    window.dispatchEvent(new CustomEvent('memeflow:wallet-connected',{detail:{address:state.address,provider}}));
    return state.address;
  }finally{state.busy=false;render()}
}
async function connectBest(){
  if(mobile() && !window.phantom?.solana?.isPhantom && !window.solana?.isPhantom){
    openInPhantom();
    return null;
  }
  return connect('injected');
}
function openInPhantom(){
  const target=encodeURIComponent(location.href);
  const ref=encodeURIComponent(location.origin);
  location.href=`https://phantom.app/ul/browse/${target}?ref=${ref}`;
}
async function disconnect(){
  state.busy=true;render();
  try{await sdk?.disconnect?.()}finally{
    state.address=null;state.provider=null;state.autoConfirm=false;state.busy=false;render();
  }
}
async function signAndSend(transactionBase64){
  if(!sdk||!state.address)throw new Error('Connect Phantom first.');
  const bytes=Uint8Array.from(atob(transactionBase64),c=>c.charCodeAt(0));
  const tx=VersionedTransaction.deserialize(bytes);
  const result=await sdk.solana.signAndSendTransaction(tx);
  const sig=result?.hash||result?.signature||result?.txid||result;
  if(typeof sig!=='string'||sig.length<40)throw new Error('Phantom returned no transaction signature.');
  return sig;
}
async function refreshAutoConfirm(){
  if(!sdk||state.provider!=='injected'){state.autoConfirm=false;return}
  try{
    const r=await sdk.getAutoConfirmStatus();
    state.autoConfirm=Boolean(r?.enabled??r===true);
  }catch{state.autoConfirm=false}
}
async function toggleAutoConfirm(){
  if(state.provider!=='injected')return;
  state.busy=true;render();msg();
  try{
    if(state.autoConfirm)await sdk.disableAutoConfirm();
    else await sdk.enableAutoConfirm({chains:[NetworkId.SOLANA_MAINNET]});
    await refreshAutoConfirm();
    msg(state.autoConfirm
      ?'Browser Auto-Confirm enabled. This only works while the Phantom extension/browser session is available; it is NOT 24/7 offline AUTO LIVE.'
      :'Browser Auto-Confirm disabled.');
  }catch(e){msg(e.message||'Unable to change Auto-Confirm.',true)}
  finally{state.busy=false;render()}
}
async function armApproveMode(){
  state.busy=true;render();msg();
  try{
    if(!state.address)await connectBest();
    if(!state.address)return;
    const current=await api('/api/settings');
    const next={...(current.settings||{}),tradingEnvironment:'live',operatingMode:'assist'};
    await api('/api/settings',{method:'PUT',body:JSON.stringify({settings:next,version:current.version})});
    msg('LIVE approval mode armed. Real transactions require your wallet approval unless browser Auto-Confirm is explicitly enabled.');
  }catch(e){msg(e.message||'Unable to arm LIVE approval mode.',true)}
  finally{state.busy=false;render()}
}
function installUi(){
  const host=$('mfAccountWalletGroup')?.querySelector('.mf-account-grid');
  if(!host||$('mfPhantomConnectPanel'))return;
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
      ${config.appId?'<button id="mfPcGoogle" type="button">Google · embedded wallet</button><button id="mfPcApple" type="button">Apple · embedded wallet</button>':''}
      <button id="mfPcDisconnect" type="button">Disconnect</button>
    </div>
    <div class="mf-pc-modes">
      <button id="mfPcApproveMode" class="selected" type="button">
        <b>Approve each trade</b>
        <small>Works now · Phantom signs each BUY/SELL</small>
      </button>
      <button id="mfPcAuto24" type="button" disabled>
        <b>AUTO LIVE · 24/7</b>
        <small>Non-custodial Smart Vault required · intentionally locked in this patch</small>
      </button>
    </div>
    <button id="mfPcAutoConfirm" class="mf-pc-autoconfirm" type="button" hidden>Enable browser Auto-Confirm</button>
    <div class="mf-pc-note">
      <b>Important:</b> Phantom Connect keeps private keys out of MEMEFLOW. True 24/7 AUTO while the phone/browser is asleep cannot be provided by a client-side Phantom session alone; that mode will be enabled only by the on-chain Smart Vault module.
    </div>
    <div id="mfPhantomConnectMsg" class="mf-pc-msg" hidden></div>`;
  host.appendChild(box);

  $('mfPcInjected')?.addEventListener('click',()=>connectBest().catch(e=>msg(e.message,true)));
  $('mfPcOpenMobile')?.addEventListener('click',openInPhantom);
  $('mfPcGoogle')?.addEventListener('click',()=>connect('google').catch(e=>msg(e.message,true)));
  $('mfPcApple')?.addEventListener('click',()=>connect('apple').catch(e=>msg(e.message,true)));
  $('mfPcDisconnect')?.addEventListener('click',()=>disconnect().catch(e=>msg(e.message,true)));
  $('mfPcApproveMode')?.addEventListener('click',armApproveMode);
  $('mfPcAutoConfirm')?.addEventListener('click',toggleAutoConfirm);
  render();
}

window.MEMEFLOW_PHANTOM={
  connect,connectBest,openInPhantom,disconnect,
  address:()=>state.address,
  provider:()=>state.provider,
  signAndSend,
  enableAutoConfirm:async()=>{if(!state.autoConfirm)await toggleAutoConfirm()},
  disableAutoConfirm:async()=>{if(state.autoConfirm)await toggleAutoConfirm()},
  auto24x7Ready:()=>Boolean(config?.auto24x7Ready)
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
EOF_CLIENT

cat > phantom-connect.css <<'EOF_CSS'
.mf-pc-panel{grid-column:1/-1;border:1px solid var(--line,#28333e);border-radius:13px;padding:11px;margin-top:4px;background:rgba(255,255,255,.012)}
.mf-pc-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.mf-pc-head b{display:block;font-size:12px}.mf-pc-head small,.mf-pc-panel small{display:block;margin-top:3px;color:var(--muted,#84919f);font-size:9px;line-height:1.35}.mf-pc-head i{font-style:normal;font-size:8px;letter-spacing:.08em;color:var(--muted,#84919f)}.mf-pc-head i.ok{color:var(--green,#51e7a8)}
.mf-pc-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:9px}.mf-pc-meta>span{border:1px solid var(--line,#28333e);border-radius:9px;padding:8px;min-width:0}.mf-pc-meta b{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-pc-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.mf-pc-actions button,.mf-pc-autoconfirm{min-height:35px;border:1px solid var(--line,#28333e);border-radius:9px;background:transparent;color:var(--text,#eef4f8)}
.mf-pc-modes{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.mf-pc-modes button{text-align:left;min-height:62px;padding:9px;border:1px solid var(--line,#28333e);border-radius:10px;background:transparent;color:var(--text,#eef4f8)}.mf-pc-modes button.selected{border-color:rgba(91,202,232,.5);background:rgba(91,202,232,.06)}.mf-pc-modes button:disabled{opacity:.52}
.mf-pc-autoconfirm{width:100%;margin-top:7px}.mf-pc-note,.mf-pc-msg{margin-top:7px;border:1px solid var(--line,#28333e);border-radius:9px;padding:8px;font-size:9px;line-height:1.5;color:var(--muted,#84919f)}.mf-pc-note b{color:var(--text,#eef4f8)}.mf-pc-msg.bad{color:var(--red,#ff6679)}
@media(max-width:520px){.mf-pc-meta,.mf-pc-actions,.mf-pc-modes{grid-template-columns:1fr}}
EOF_CSS

cat > patch-phantom-phase1.mjs <<'EOF_PATCH'
import fs from 'node:fs';

function replaceOnce(text,from,to,label){
  if(text.includes(to))return text;
  if(!text.includes(from))throw new Error(`Patch anchor not found: ${label}`);
  return text.replace(from,to);
}

// 1) Expose the public Phantom App ID. AUTO 24/7 stays hard-false until the
// separate on-chain Smart Vault module exists and is verified.
{
  const file='live-bootstrap.mjs';
  let s=fs.readFileSync(file,'utf8');
  const anchor="    if(req.method==='GET'&&pathname==='/api/live/status'){";
  const route=`    if(req.method==='GET'&&pathname==='/api/phantom/config'){
      return json(res,200,{
        appId:String(process.env.PHANTOM_APP_ID||''),
        network:'mainnet-beta',
        nonCustodial:true,
        auto24x7Ready:false,
        smartVaultProgramId:String(process.env.MEMEFLOW_SMART_VAULT_PROGRAM_ID||'')
      });
    }

${anchor}`;
  s=replaceOnce(s,anchor,route,'live-bootstrap phantom config route');
  fs.writeFileSync(file,s);
}

// 2) Prefer Phantom Connect when available, while retaining the original
// injected Phantom/Solflare fallback.
{
  const file='live-wallet-execution.js';
  let s=fs.readFileSync(file,'utf8');

  const a=`  async function connectedWallet({interactive=false}={}) {
    const p=provider();`;
  const b=`  async function connectedWallet({interactive=false}={}) {
    const pcAddress=window.MEMEFLOW_PHANTOM?.address?.();
    if(pcAddress)return {provider:null,address:String(pcAddress)};
    const p=provider();`;
  s=replaceOnce(s,a,b,'live wallet address bridge');

  const c=`  async function signAndSend(transactionBase64) {
    const {provider:p}=await connectedWallet({interactive:true});`;
  const d=`  async function signAndSend(transactionBase64) {
    if(window.MEMEFLOW_PHANTOM?.address?.()&&window.MEMEFLOW_PHANTOM?.signAndSend){
      return await window.MEMEFLOW_PHANTOM.signAndSend(transactionBase64);
    }
    const {provider:p}=await connectedWallet({interactive:true});`;
  s=replaceOnce(s,c,d,'live wallet signing bridge');
  fs.writeFileSync(file,s);
}

// 3) Existing "Connect wallet" button uses the new connector when loaded.
{
  const file='account-wallet-settings.js';
  let s=fs.readFileSync(file,'utf8');
  const a=`  async function connectWallet() {
    message();
    const p = provider();`;
  const b=`  async function connectWallet() {
    if (window.MEMEFLOW_PHANTOM?.connectBest) {
      try { await window.MEMEFLOW_PHANTOM.connectBest(); return; }
      catch (error) { message(error.message || 'Wallet connection failed.', true); return; }
    }
    message();
    const p = provider();`;
  s=replaceOnce(s,a,b,'settings connect button bridge');

  if(!s.includes('MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER')){
    s+=`

/* MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER */
(() => {
  if (window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER__) return;
  window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER__=true;
  const css=document.createElement('link');
  css.rel='stylesheet';css.href='/phantom-connect.css?v=phase1-20260827';
  document.head.appendChild(css);
  const js=document.createElement('script');
  js.src='/phantom-connect-client.bundle.js?v=phase1-20260827';js.defer=true;
  document.head.appendChild(js);
})();
/* /MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER */
`;
  }
  fs.writeFileSync(file,s);
}

// 4) Add public configuration placeholders only. PHANTOM_APP_ID is public;
// no seed phrase/private key belongs here.
{
  const file='.env.example';
  let s=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  if(!s.includes('# Phantom Connect')){
    s+=`
# Phantom Connect — public application identifier from Phantom Portal
PHANTOM_APP_ID=

# Reserved for the next audited/on-chain AUTO LIVE module.
# Do not set this to a random address; AUTO 24/7 remains disabled in Phase 1.
MEMEFLOW_SMART_VAULT_PROGRAM_ID=
`;
  }
  fs.writeFileSync(file,s);
}

// 5) Add reproducible bundle command.
{
  const file='package.json';
  const p=JSON.parse(fs.readFileSync(file,'utf8'));
  p.scripts||={};
  p.scripts['build:phantom-connect']='esbuild phantom-connect-client.mjs --bundle --minify --platform=browser --format=iife --target=es2020 --outfile=phantom-connect-client.bundle.js';
  fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');
}
EOF_PATCH

echo "Installing Phantom Connect SDK..."
npm install --no-audit --no-fund @phantom/browser-sdk@latest @solana/web3.js@latest esbuild@latest

echo "Applying project patch..."
node patch-phantom-phase1.mjs

echo "Building browser bundle..."
npm run build:phantom-connect

echo "Checks..."
node --check live-bootstrap.mjs
node --check live-wallet-execution.js
node --check account-wallet-settings.js
test -s phantom-connect-client.bundle.js
grep -q "MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER" account-wallet-settings.js
grep -q "/api/phantom/config" live-bootstrap.mjs

echo
echo "== INSTALLED =="
echo "Production wallet onboarding foundation is installed."
echo
echo "Works now:"
echo "  - Phantom extension / Phantom in-app browser"
echo "  - Mobile 'Open in Phantom app' deep-link"
echo "  - Phantom embedded wallet via Google/Apple after PHANTOM_APP_ID is set"
echo "  - Auto-connect/reconnect for Phantom Connect sessions"
echo "  - Existing LIVE Pump.fun transaction builder signs through Phantom Connect"
echo "  - Approve-each-trade mode"
echo "  - Optional Phantom extension Auto-Confirm while that browser session is available"
echo
echo "Intentionally NOT enabled:"
echo "  - AUTO LIVE 24/7 while phone/browser is asleep"
echo "    This requires the separate non-custodial on-chain Smart Vault module."
echo
echo "Next setup:"
echo "  1. Create MEMEFLOW app in Phantom Portal."
echo "  2. Add your stable HTTPS MEMEFLOW domain + /settings.html redirect."
echo "  3. Add Replit Secret: PHANTOM_APP_ID=<your public Phantom App ID>"
echo "  4. Restart Replit."
echo
echo "Never add a user's seed phrase or private key."
