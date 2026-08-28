#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Phantom Connect Phase 1 — FIX 2 =="

if [[ -f "memeflow-app/live-bootstrap.mjs" ]]; then
  cd memeflow-app
elif [[ -f "live-bootstrap.mjs" ]]; then
  :
else
  echo "ERROR: live-bootstrap.mjs not found. Run from the MEMEFLOW repository root." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".phantom-connect-phase1-fix2-backup-$STAMP"
mkdir -p "$BACKUP"

for f in live-bootstrap.mjs account-wallet-settings.js package.json .env.example; do
  [[ -f "$f" ]] && cp -p "$f" "$BACKUP/$f"
done

echo "Backup: $PWD/$BACKUP"
echo "NOTE: this fix does NOT patch live-wallet-execution.js, so the previous connectedWallet anchor problem cannot occur."

cat > phantom-connect-client.mjs <<'EOF_CLIENT'
import {BrowserSDK,AddressType,NetworkId} from '@phantom/browser-sdk';

const $=id=>document.getElementById(id);

let sdk=null;
let config=null;
let realInjected=null;

const state={
  address:null,
  provider:null,
  busy:false,
  autoConfirm:false
};

async function api(path,opt={}){
  const r=await fetch(path,{
    credentials:'same-origin',
    cache:'no-store',
    ...opt,
    headers:{
      accept:'application/json',
      ...(opt.body?{'content-type':'application/json'}:{}),
      ...(opt.headers||{})
    }
  });

  let data={};
  try{data=await r.json()}catch{}

  if(!r.ok){
    throw new Error(data.message||data.error||`HTTP ${r.status}`);
  }

  return data;
}

function addressFrom(rows=[]){
  const sol=rows.find(x=>
    String(x?.addressType||x?.type||'')
      .toLowerCase()
      .includes('solana')
  )||rows[0];

  return sol?.address||null;
}

function shortAddress(address){
  return address
    ?`${address.slice(0,5)}…${address.slice(-5)}`
    :'Not connected';
}

function isMobile(){
  return /Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent||''
  );
}

function setMessage(text='',bad=false){
  const node=$('mfPhantomConnectMsg');
  if(!node)return;

  node.hidden=!text;
  node.textContent=text;
  node.classList.toggle('bad',bad);
}

function publicKeyObject(){
  if(!state.address)return null;

  return {
    toString:()=>state.address,
    toBase58:()=>state.address
  };
}

function syncExistingWalletUi(){
  const connected=Boolean(state.address);

  const provider=$('mfWalletProvider');
  const address=$('mfWalletAddressValue');
  const copy=$('mfWalletCopy');
  const disconnect=$('mfWalletDisconnect');

  if(provider){
    provider.textContent=connected
      ?`Phantom · ${state.provider||'wallet'}`
      :'Not connected';
  }

  if(address){
    address.textContent=state.address||'Connect Phantom';
  }

  if(copy)copy.disabled=!connected;
  if(disconnect)disconnect.disabled=!connected;
}

function render(){
  syncExistingWalletUi();

  if($('mfPcAddress')){
    $('mfPcAddress').textContent=
      shortAddress(state.address);
  }

  if($('mfPcProvider')){
    $('mfPcProvider').textContent=
      state.provider||'—';
  }

  const badge=$('mfPcBadge');

  if(badge){
    badge.textContent=
      state.address?'CONNECTED':'NOT CONNECTED';

    badge.classList.toggle(
      'ok',
      Boolean(state.address)
    );
  }

  const auto=$('mfPcAutoConfirm');

  if(auto){
    auto.hidden=
      state.provider!=='injected';

    auto.textContent=
      state.autoConfirm
        ?'Disable browser Auto-Confirm'
        :'Enable browser Auto-Confirm';
  }

  for(const id of [
    'mfPcInjected',
    'mfPcMobile',
    'mfPcPhantomLogin',
    'mfPcGoogle',
    'mfPcApple',
    'mfPcDisconnect',
    'mfPcApproveMode'
  ]){
    if($(id))$(id).disabled=state.busy;
  }
}

async function updateConnection(result,provider){
  const rows=
    result?.addresses||
    await sdk.getAddresses?.().catch(()=>[]);

  state.address=
    addressFrom(rows||[]);

  state.provider=
    provider||
    result?.provider||
    'phantom';

  if(!state.address){
    throw new Error(
      'Phantom returned no Solana address.'
    );
  }

  await refreshAutoConfirm();

  render();

  window.dispatchEvent(
    new CustomEvent(
      'memeflow:wallet-connected',
      {
        detail:{
          address:state.address,
          provider:state.provider
        }
      }
    )
  );

  return state.address;
}

async function connect(provider){
  if(!sdk){
    throw new Error(
      'Phantom Connect is not ready.'
    );
  }

  state.busy=true;
  render();
  setMessage();

  try{
    const result=
      await sdk.connect({provider});

    return await updateConnection(
      result,
      provider
    );
  }finally{
    state.busy=false;
    render();
  }
}

function openInPhantom(){
  const target=
    encodeURIComponent(location.href);

  const ref=
    encodeURIComponent(location.origin);

  location.href=
    `https://phantom.app/ul/browse/${target}?ref=${ref}`;
}

async function connectBest(){
  if(!sdk){
    throw new Error(
      'Phantom Connect is not ready.'
    );
  }

  let installed=false;

  try{
    installed=
      await sdk.isPhantomInstalled();
  }catch{}

  if(installed){
    return connect('injected');
  }

  if(config?.appId){
    if(isMobile()){
      return connect('deeplink');
    }

    return connect('phantom');
  }

  if(isMobile()){
    openInPhantom();
    return null;
  }

  throw new Error(
    'Phantom extension was not detected. '+
    'Add PHANTOM_APP_ID to enable Phantom Login and embedded wallets.'
  );
}

async function disconnect(){
  state.busy=true;
  render();
  setMessage();

  try{
    await sdk?.disconnect?.();
  }finally{
    state.address=null;
    state.provider=null;
    state.autoConfirm=false;
    state.busy=false;
    render();
  }
}

async function sdkSignAndSend(transaction){
  if(!sdk||!state.address){
    throw new Error(
      'Connect Phantom first.'
    );
  }

  const result=
    await sdk.solana
      .signAndSendTransaction(transaction);

  const signature=
    result?.hash||
    result?.signature||
    result?.txid||
    null;

  if(
    typeof signature!=='string'||
    signature.length<40
  ){
    throw new Error(
      'Phantom returned no Solana transaction signature.'
    );
  }

  return signature;
}

async function refreshAutoConfirm(){
  if(
    !sdk||
    state.provider!=='injected'
  ){
    state.autoConfirm=false;
    return;
  }

  try{
    const status=
      await sdk.getAutoConfirmStatus();

    state.autoConfirm=
      Boolean(status?.enabled);
  }catch{
    state.autoConfirm=false;
  }
}

async function toggleAutoConfirm(){
  if(state.provider!=='injected'){
    return;
  }

  state.busy=true;
  render();
  setMessage();

  try{
    if(state.autoConfirm){
      await sdk.disableAutoConfirm();
    }else{
      await sdk.enableAutoConfirm({
        chains:[
          NetworkId.SOLANA_MAINNET
        ]
      });
    }

    await refreshAutoConfirm();

    setMessage(
      state.autoConfirm
        ?'Browser Auto-Confirm is enabled for Solana Mainnet. It only works while the Phantom browser/extension session is available; this is not the final offline 24/7 AUTO mode.'
        :'Browser Auto-Confirm disabled.'
    );
  }catch(error){
    setMessage(
      error.message||
      'Unable to change Auto-Confirm.',
      true
    );
  }finally{
    state.busy=false;
    render();
  }
}

async function armApproveMode(){
  state.busy=true;
  render();
  setMessage();

  try{
    if(!state.address){
      await connectBest();

      if(!state.address){
        return;
      }
    }

    const current=
      await api('/api/settings');

    const next={
      ...(current.settings||{}),
      tradingEnvironment:'live',
      operatingMode:'assist'
    };

    await api(
      '/api/settings',
      {
        method:'PUT',
        body:JSON.stringify({
          settings:next,
          version:current.version
        })
      }
    );

    setMessage(
      'LIVE approval mode armed. '+
      'Real BUY/SELL transactions use the connected Phantom wallet.'
    );
  }catch(error){
    setMessage(
      error.message||
      'Unable to arm LIVE approval mode.',
      true
    );
  }finally{
    state.busy=false;
    render();
  }
}

/*
 * Compatibility shim:
 *
 * Existing MEMEFLOW LIVE V1 already knows how to work with a Phantom-style
 * injected provider. When there is no real injected Phantom provider
 * (for example Google/Apple embedded Phantom Connect), expose a small
 * standards-compatible window.phantom.solana adapter.
 *
 * This avoids touching live-wallet-execution.js at all.
 */
function installCompatibilityShim(){
  const existing=
    window.phantom?.solana;

  if(existing?.isPhantom){
    realInjected=existing;
    return;
  }

  const shim={
    isPhantom:true,

    get publicKey(){
      return publicKeyObject();
    },

    async connect(){
      if(!state.address){
        await connectBest();
      }

      return {
        publicKey:
          publicKeyObject()
      };
    },

    async disconnect(){
      await disconnect();
    },

    async signAndSendTransaction(transaction){
      const signature=
        await sdkSignAndSend(transaction);

      return {signature};
    }
  };

  try{
    if(!window.phantom){
      Object.defineProperty(
        window,
        'phantom',
        {
          value:{solana:shim},
          configurable:true
        }
      );
    }else if(!window.phantom.solana){
      window.phantom.solana=shim;
    }
  }catch{
    /*
     * If the browser prevents defining window.phantom, the new Phantom
     * panel still works; injected Phantom continues to use its real provider.
     */
  }
}

function installUi(){
  const host=
    $('mfAccountWalletGroup')
      ?.querySelector(
        '.mf-account-grid'
      );

  if(
    !host||
    $('mfPhantomConnectPanel')
  ){
    return;
  }

  const embedded=
    config?.appId
      ?`
        <button id="mfPcPhantomLogin" type="button">
          Phantom Login
        </button>
        <button id="mfPcGoogle" type="button">
          Google · embedded wallet
        </button>
        <button id="mfPcApple" type="button">
          Apple · embedded wallet
        </button>
      `
      :'';

  const panel=
    document.createElement('div');

  panel.id=
    'mfPhantomConnectPanel';

  panel.className=
    'mf-pc-panel';

  panel.innerHTML=`
    <div class="mf-pc-head">
      <span>
        <b>Wallet connection</b>
        <small>Phantom Connect · non-custodial</small>
      </span>
      <i id="mfPcBadge">NOT CONNECTED</i>
    </div>

    <div class="mf-pc-meta">
      <span>
        <small>Provider</small>
        <b id="mfPcProvider">—</b>
      </span>

      <span>
        <small>Address</small>
        <b id="mfPcAddress">Not connected</b>
      </span>
    </div>

    <div class="mf-pc-actions">
      <button id="mfPcInjected" type="button">
        Use Phantom wallet
      </button>

      <button id="mfPcMobile" type="button">
        Open in Phantom app
      </button>

      ${embedded}

      <button id="mfPcDisconnect" type="button">
        Disconnect
      </button>
    </div>

    <div class="mf-pc-modes">
      <button
        id="mfPcApproveMode"
        class="selected"
        type="button"
      >
        <b>Approve each trade</b>
        <small>
          Real BUY/SELL through your connected Phantom wallet
        </small>
      </button>

      <button
        id="mfPcAuto24"
        type="button"
        disabled
      >
        <b>AUTO LIVE · 24/7</b>
        <small>
          Smart Vault module required · intentionally locked
        </small>
      </button>
    </div>

    <button
      id="mfPcAutoConfirm"
      class="mf-pc-autoconfirm"
      type="button"
      hidden
    >
      Enable browser Auto-Confirm
    </button>

    <div class="mf-pc-note">
      <b>Non-custodial.</b>
      MEMEFLOW never receives your Phantom seed phrase or private key.
      True offline 24/7 AUTO remains locked until the separate
      on-chain Smart Vault is installed and tested.
    </div>

    <div
      id="mfPhantomConnectMsg"
      class="mf-pc-msg"
      hidden
    ></div>
  `;

  host.appendChild(panel);

  $('mfPcInjected')
    ?.addEventListener(
      'click',
      ()=>connectBest()
        .catch(
          e=>setMessage(
            e.message,
            true
          )
        )
    );

  $('mfPcMobile')
    ?.addEventListener(
      'click',
      openInPhantom
    );

  $('mfPcPhantomLogin')
    ?.addEventListener(
      'click',
      ()=>connect('phantom')
        .catch(
          e=>setMessage(
            e.message,
            true
          )
        )
    );

  $('mfPcGoogle')
    ?.addEventListener(
      'click',
      ()=>connect('google')
        .catch(
          e=>setMessage(
            e.message,
            true
          )
        )
    );

  $('mfPcApple')
    ?.addEventListener(
      'click',
      ()=>connect('apple')
        .catch(
          e=>setMessage(
            e.message,
            true
          )
        )
    );

  $('mfPcDisconnect')
    ?.addEventListener(
      'click',
      ()=>disconnect()
        .catch(
          e=>setMessage(
            e.message,
            true
          )
        )
    );

  $('mfPcApproveMode')
    ?.addEventListener(
      'click',
      armApproveMode
    );

  $('mfPcAutoConfirm')
    ?.addEventListener(
      'click',
      toggleAutoConfirm
    );

  render();
}

async function init(){
  config=
    await api('/api/phantom/config')
      .catch(
        ()=>({
          appId:'',
          auto24x7Ready:false
        })
      );

  const options=
    config.appId
      ?{
        providers:[
          'google',
          'apple',
          'phantom',
          'injected',
          'deeplink'
        ],
        addressTypes:[
          AddressType.solana
        ],
        appId:
          config.appId,
        authOptions:{
          redirectUrl:
            location.origin+
            '/settings.html'
        },
        autoConnect:true
      }
      :{
        providers:[
          'injected'
        ],
        addressTypes:[
          AddressType.solana
        ]
      };

  sdk=
    new BrowserSDK(options);

  sdk.on?.(
    'connect',
    data=>{
      state.address=
        addressFrom(
          data?.addresses||[]
        );

      state.provider=
        String(
          data?.provider||
          'phantom'
        );

      refreshAutoConfirm()
        .finally(
          ()=>render()
        );
    }
  );

  sdk.on?.(
    'disconnect',
    ()=>{
      state.address=null;
      state.provider=null;
      state.autoConfirm=false;
      render();
    }
  );

  if(config.appId){
    try{
      await sdk.autoConnect();

      if(sdk.isConnected?.()){
        const addresses=
          await sdk.getAddresses();

        state.address=
          addressFrom(
            addresses||[]
          );
      }
    }catch{}
  }

  installCompatibilityShim();
  await refreshAutoConfirm();
  installUi();
  render();
}

window.MEMEFLOW_PHANTOM={
  connect,
  connectBest,
  openInPhantom,
  disconnect,
  address:()=>state.address,
  provider:()=>state.provider,
  signAndSend:sdkSignAndSend,
  auto24x7Ready:
    ()=>Boolean(
      config?.auto24x7Ready
    )
};

if(
  document.readyState===
  'loading'
){
  document.addEventListener(
    'DOMContentLoaded',
    init,
    {once:true}
  );
}else{
  init();
}
EOF_CLIENT

cat > phantom-connect.css <<'EOF_CSS'
.mf-pc-panel{
  grid-column:1/-1;
  border:1px solid var(--line,#28333e);
  border-radius:13px;
  padding:11px;
  margin-top:4px;
  background:rgba(255,255,255,.012)
}

.mf-pc-head{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:8px
}

.mf-pc-head b{
  display:block;
  font-size:12px
}

.mf-pc-head small,
.mf-pc-panel small{
  display:block;
  margin-top:3px;
  color:var(--muted,#84919f);
  font-size:9px;
  line-height:1.35
}

.mf-pc-head i{
  font-style:normal;
  font-size:8px;
  letter-spacing:.08em;
  color:var(--muted,#84919f)
}

.mf-pc-head i.ok{
  color:var(--green,#51e7a8)
}

.mf-pc-meta{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px;
  margin-top:9px
}

.mf-pc-meta>span{
  border:1px solid var(--line,#28333e);
  border-radius:9px;
  padding:8px;
  min-width:0
}

.mf-pc-meta b{
  display:block;
  font-size:10px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis
}

.mf-pc-actions{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px;
  margin-top:7px
}

.mf-pc-actions button,
.mf-pc-autoconfirm{
  min-height:35px;
  border:1px solid var(--line,#28333e);
  border-radius:9px;
  background:transparent;
  color:var(--text,#eef4f8)
}

.mf-pc-modes{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px;
  margin-top:8px
}

.mf-pc-modes button{
  text-align:left;
  min-height:62px;
  padding:9px;
  border:1px solid var(--line,#28333e);
  border-radius:10px;
  background:transparent;
  color:var(--text,#eef4f8)
}

.mf-pc-modes button.selected{
  border-color:rgba(91,202,232,.5);
  background:rgba(91,202,232,.06)
}

.mf-pc-modes button:disabled{
  opacity:.52
}

.mf-pc-autoconfirm{
  width:100%;
  margin-top:7px
}

.mf-pc-note,
.mf-pc-msg{
  margin-top:7px;
  border:1px solid var(--line,#28333e);
  border-radius:9px;
  padding:8px;
  font-size:9px;
  line-height:1.5;
  color:var(--muted,#84919f)
}

.mf-pc-note b{
  color:var(--text,#eef4f8)
}

.mf-pc-msg.bad{
  color:var(--red,#ff6679)
}

@media(max-width:520px){
  .mf-pc-meta,
  .mf-pc-actions,
  .mf-pc-modes{
    grid-template-columns:1fr
  }
}
EOF_CSS

cat > patch-phantom-fix2.mjs <<'EOF_PATCH'
import fs from 'node:fs';

function addConfigRoute(){
  const file=
    'live-bootstrap.mjs';

  let text=
    fs.readFileSync(
      file,
      'utf8'
    );

  if(
    text.includes(
      "pathname==='/api/phantom/config'"
    )
  ){
    return;
  }

  const needle=
    "pathname==='/api/live/status'";

  const pos=
    text.indexOf(needle);

  if(pos<0){
    throw new Error(
      'Cannot find existing /api/live/status route in live-bootstrap.mjs'
    );
  }

  const lineStart=
    text.lastIndexOf(
      '\n',
      pos
    )+1;

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

  text=
    text.slice(
      0,
      lineStart
    )+
    route+
    text.slice(
      lineStart
    );

  fs.writeFileSync(
    file,
    text
  );
}

function addLoader(){
  const file=
    'account-wallet-settings.js';

  let text=
    fs.readFileSync(
      file,
      'utf8'
    );

  if(
    text.includes(
      'MEMEFLOW_PHANTOM_CONNECT_PHASE1_FIX2_LOADER'
    )
  ){
    return;
  }

  text+=`

/* MEMEFLOW_PHANTOM_CONNECT_PHASE1_FIX2_LOADER */
(() => {
  if (
    window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_FIX2_LOADER__
  ) return;

  window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_FIX2_LOADER__=true;

  const css=
    document.createElement('link');

  css.rel='stylesheet';
  css.href=
    '/phantom-connect.css?v=phase1-fix2-20260827';

  document.head.appendChild(css);

  const js=
    document.createElement('script');

  js.src=
    '/phantom-connect-client.bundle.js?v=phase1-fix2-20260827';

  js.defer=true;

  document.head.appendChild(js);
})();
/* /MEMEFLOW_PHANTOM_CONNECT_PHASE1_FIX2_LOADER */
`;

  fs.writeFileSync(
    file,
    text
  );
}

function addEnv(){
  const file='.env.example';

  let text=
    fs.existsSync(file)
      ?fs.readFileSync(
        file,
        'utf8'
      )
      :'';

  if(
    !text.includes(
      '# Phantom Connect'
    )
  ){
    text+=`
# Phantom Connect — public application identifier from Phantom Portal
PHANTOM_APP_ID=

# Reserved for the audited on-chain AUTO LIVE Smart Vault.
MEMEFLOW_SMART_VAULT_PROGRAM_ID=
`;
  }

  fs.writeFileSync(
    file,
    text
  );
}

function addBuildScript(){
  const file=
    'package.json';

  const pkg=
    JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    );

  pkg.scripts||={};

  pkg.scripts[
    'build:phantom-connect'
  ]=
    'esbuild phantom-connect-client.mjs --bundle --minify --platform=browser --format=iife --target=es2020 --outfile=phantom-connect-client.bundle.js';

  fs.writeFileSync(
    file,
    JSON.stringify(
      pkg,
      null,
      2
    )+'\n'
  );
}

addConfigRoute();
addLoader();
addEnv();
addBuildScript();

console.log(
  'Patch files updated successfully.'
);
EOF_PATCH

echo "Ensuring Phantom SDK dependencies..."
npm install --no-audit --no-fund \
  @phantom/browser-sdk@latest \
  @solana/web3.js@latest \
  esbuild@latest

echo "Applying FIX 2..."
node patch-phantom-fix2.mjs

echo "Building Phantom Connect browser bundle..."
npm run build:phantom-connect

echo "Syntax + installation validation..."
node --check live-bootstrap.mjs
node --check account-wallet-settings.js
node --check phantom-connect-client.bundle.js

test -s phantom-connect-client.bundle.js

grep -q \
  "pathname==='/api/phantom/config'" \
  live-bootstrap.mjs

grep -q \
  "MEMEFLOW_PHANTOM_CONNECT_PHASE1_FIX2_LOADER" \
  account-wallet-settings.js

echo
echo "== PHANTOM CONNECT PHASE 1 FIX 2 INSTALLED =="
echo
echo "This version deliberately does NOT edit live-wallet-execution.js."
echo "It uses a Phantom-compatible browser shim instead."
echo
echo "After restart:"
echo "  System Settings -> Wallet"
echo
echo "Expected new block:"
echo "  Wallet connection"
echo "  Phantom Connect · non-custodial"
echo "  Approve each trade"
echo "  AUTO LIVE · 24/7 (locked for Smart Vault)"
echo
echo "Without PHANTOM_APP_ID:"
echo "  - Phantom extension/in-app browser works"
echo "  - Open in Phantom app works"
echo
echo "After PHANTOM_APP_ID is added:"
echo "  - Phantom Login"
echo "  - Google embedded wallet"
echo "  - Apple embedded wallet"
echo "  - mobile deeplink SDK flow"
echo
echo "Restart Replit now: STOP -> RUN."
