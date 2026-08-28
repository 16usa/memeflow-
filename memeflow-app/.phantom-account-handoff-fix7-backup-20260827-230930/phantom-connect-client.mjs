import {
  BrowserSDK,
  AddressType,
  NetworkId
} from '@phantom/browser-sdk';

const $=id=>document.getElementById(id);

let config={
  appId:'',
  auto24x7Ready:false
};

let sdk=null;
let shimInstalled=false;

const state={
  address:null,
  provider:null,
  busy:false,
  autoConfirm:false,
  lastError:null
};

async function api(path,opt={}){
  const response=await fetch(path,{
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
  try{data=await response.json()}catch{}

  if(!response.ok){
    throw new Error(
      data.message||
      data.error||
      `HTTP ${response.status}`
    );
  }

  return data;
}

function isMobile(){
  return /Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent||''
  );
}

function realInjected(){
  const p=
    window.phantom?.solana?.isPhantom
      ?window.phantom.solana
      :window.solana?.isPhantom
        ?window.solana
        :null;

  if(
    p&&
    p.__MEMEFLOW_PHANTOM_SHIM__
  ){
    return null;
  }

  return p;
}

function normalizeAddress(value){
  if(!value)return null;

  if(typeof value==='string'){
    return value;
  }

  if(
    typeof value?.address==='string'
  ){
    return value.address;
  }

  if(
    typeof value?.toBase58==='function'
  ){
    return value.toBase58();
  }

  if(
    typeof value?.toString==='function'
  ){
    const text=value.toString();

    if(
      text&&
      text!=='[object Object]'
    ){
      return text;
    }
  }

  return null;
}

function addressFromConnectResult(result){
  const rows=
    result?.addresses||
    result?.accounts||
    [];

  if(Array.isArray(rows)){
    const preferred=
      rows.find(
        row=>
          String(
            row?.addressType||
            row?.type||
            ''
          )
            .toLowerCase()
            .includes('solana')
      )||
      rows[0];

    const fromRow=
      normalizeAddress(
        preferred
      );

    if(fromRow)return fromRow;
  }

  const candidates=[
    result?.publicKey,
    result?.address,
    result?.account,
    result
  ];

  for(const candidate of candidates){
    const address=
      normalizeAddress(
        candidate
      );

    if(address)return address;
  }

  return null;
}

async function getSdkAddress(){
  if(!sdk)return null;

  try{
    const rows=
      await sdk.getAddresses();

    const address=
      addressFromConnectResult({
        addresses:rows
      });

    if(address)return address;
  }catch{}

  try{
    const key=
      await sdk.solana
        ?.getPublicKey?.();

    const address=
      normalizeAddress(
        key
      );

    if(address)return address;
  }catch{}

  return null;
}

function shortAddress(address){
  return address
    ?`${address.slice(0,5)}…${address.slice(-5)}`
    :'Not connected';
}

function setMessage(text='',bad=false){
  state.lastError=
    bad?text:null;

  const node=
    $('mfPhantomConnectMsg');

  if(!node)return;

  node.hidden=
    !text;

  node.textContent=
    text;

  node.classList.toggle(
    'bad',
    bad
  );
}

function publicKeyShim(){
  if(!state.address)return null;

  return {
    toString:()=>state.address,
    toBase58:()=>state.address
  };
}

function syncExistingWalletUi(){
  const connected=
    Boolean(state.address);

  if($('mfWalletProvider')){
    $('mfWalletProvider').textContent=
      connected
        ?`Phantom · ${state.provider||'wallet'}`
        :'Not connected';
  }

  if($('mfWalletAddressValue')){
    $('mfWalletAddressValue').textContent=
      state.address||
      'Connect Phantom';
  }

  if($('mfWalletCopy')){
    $('mfWalletCopy').disabled=
      !connected;
  }

  if($('mfWalletDisconnect')){
    $('mfWalletDisconnect').disabled=
      !connected;
  }
}

function render(){
  syncExistingWalletUi();

  if($('mfPcAddress')){
    $('mfPcAddress').textContent=
      shortAddress(
        state.address
      );
  }

  if($('mfPcProvider')){
    $('mfPcProvider').textContent=
      state.provider||'—';
  }

  const badge=
    $('mfPcBadge');

  if(badge){
    badge.textContent=
      state.address
        ?'CONNECTED'
        :'NOT CONNECTED';

    badge.classList.toggle(
      'ok',
      Boolean(state.address)
    );
  }

  const setup=
    $('mfPcSetup');

  if(setup){
    setup.textContent=
      config.appId
        ?'PHANTOM CONNECT READY'
        :'PHANTOM APP ID NEEDED';

    setup.classList.toggle(
      'ok',
      Boolean(config.appId)
    );
  }

  const auto=
    $('mfPcAutoConfirm');

  if(auto){
    auto.hidden=
      state.provider!=='injected';

    auto.textContent=
      state.autoConfirm
        ?'Disable browser Auto-Confirm'
        :'Enable browser Auto-Confirm';
  }

  for(const id of [
    'mfPcUsePhantom',
    'mfPcOpenMobile',
    'mfPcPhantomLogin',
    'mfPcGoogle',
    'mfPcApple',
    'mfPcDisconnect',
    'mfPcApproveMode'
  ]){
    if($(id)){
      $(id).disabled=
        state.busy;
    }
  }
}

async function createSessionHandoff(){
  const result=await api(
    '/api/session/handoff',
    {method:'POST',body:'{}'}
  );
  if(!result?.token)throw new Error('MEMEFLOW could not create a Phantom session handoff.');
  return result.token;
}

async function redeemSessionHandoffIfPresent(){
  const match=String(location.hash||'').match(/(?:^#|&)mf_handoff=([^&]+)/);
  if(!match)return false;

  const token=decodeURIComponent(match[1]);
  const clean=location.pathname+location.search;

  try{
    await api(
      '/api/session/handoff/redeem',
      {method:'POST',body:JSON.stringify({token})}
    );
    history.replaceState(null,'',clean);
    // Reload once so settings/billing/owner state are all fetched under the
    // transferred HttpOnly MEMEFLOW session cookie.
    location.replace(clean);
    return true;
  }catch(error){
    history.replaceState(null,'',clean);
    setMessage(error.message||'MEMEFLOW session handoff failed.',true);
    return false;
  }
}

async function openInPhantom(){
  let handoffToken='';
  try{
    handoffToken=await createSessionHandoff();
  }catch(error){
    setMessage(error.message||'Could not transfer MEMEFLOW session to Phantom.',true);
    throw error;
  }

  const base=location.origin+location.pathname+location.search;
  const target=
    encodeURIComponent(
      base+'#mf_handoff='+encodeURIComponent(handoffToken)
    );

  const ref=
    encodeURIComponent(
      location.origin
    );

  location.href=
    `https://phantom.app/ul/browse/${target}?ref=${ref}`;
}

async function setConnected(address,provider){
  if(!address){
    throw new Error(
      'Phantom returned no Solana address.'
    );
  }

  state.address=
    String(address);

  state.provider=
    provider;

  installEmbeddedCompatibilityShim();

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

/*
 * FIX 4:
 * Use BrowserSDK even for provider:"injected".
 * Phantom's current Browser SDK returns result.addresses[].address, while
 * the older raw provider commonly returns result.publicKey.
 * We support both shapes and then ask sdk.getAddresses()/getPublicKey()
 * before declaring connection failure.
 */
async function connectInjected(){
  state.busy=true;
  render();
  setMessage();

  try{
    let result=null;
    let address=null;

    if(sdk){
      try{
        result=
          await sdk.connect({
            provider:'injected'
          });

        address=
          addressFromConnectResult(
            result
          )||
          await getSdkAddress();
      }catch(error){
        const raw=
          realInjected();

        if(!raw){
          throw error;
        }
      }
    }

    if(!address){
      const raw=
        realInjected();

      if(raw){
        const rawResult=
          await raw.connect();

        address=
          addressFromConnectResult(
            rawResult
          )||
          normalizeAddress(
            raw.publicKey
          );
      }
    }

    return await setConnected(
      address,
      'injected'
    );
  }finally{
    state.busy=false;
    render();
  }
}

async function connectSdk(provider){
  if(!config.appId){
    throw new Error(
      'PHANTOM_APP_ID is required for Phantom Login, deeplink authentication and embedded wallets.'
    );
  }

  if(!sdk){
    throw new Error(
      'Phantom Connect SDK is not ready.'
    );
  }

  state.busy=true;
  render();
  setMessage();

  try{
    const result=
      await sdk.connect({
        provider
      });

    const address=
      addressFromConnectResult(
        result
      )||
      await getSdkAddress();

    return await setConnected(
      address,
      provider
    );
  }finally{
    state.busy=false;
    render();
  }
}

async function connectBest(){
  /*
   * Existing Phantom in-app browser / extension.
   */
  if(realInjected()){
    return connectInjected();
  }

  /*
   * BrowserSDK itself may discover injected Phantom even when the raw
   * window provider was not ready during initial page load.
   */
  if(sdk){
    try{
      const installed=
        await sdk
          .isPhantomInstalled?.();

      if(installed){
        return connectInjected();
      }
    }catch{}
  }

  /*
   * Full Phantom Connect deeplink requires an App ID.
   */
  if(
    config.appId&&
    sdk
  ){
    if(isMobile()){
      return connectSdk(
        'deeplink'
      );
    }

    return connectSdk(
      'phantom'
    );
  }

  /*
   * Before App ID is configured, Safari can still open the dapp in
   * Phantom's own mobile browser. The injected provider will exist there.
   */
  if(isMobile()){
    await openInPhantom();
    return null;
  }

  throw new Error(
    'Phantom was not detected. Configure PHANTOM_APP_ID to enable the full Phantom Connect flow.'
  );
}

async function sdkSignAndSend(transaction){
  if(!sdk){
    throw new Error(
      'Phantom Connect SDK is unavailable.'
    );
  }

  const result=
    await sdk.solana
      .signAndSendTransaction(
        transaction
      );

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

async function signAndSend(transaction){
  /*
   * For true raw injected Phantom, prefer the native provider.
   */
  const raw=
    realInjected();

  if(
    state.provider==='injected'&&
    raw?.signAndSendTransaction
  ){
    return raw.signAndSendTransaction(
      transaction
    );
  }

  const signature=
    await sdkSignAndSend(
      transaction
    );

  return {
    signature
  };
}

/*
 * Existing LIVE V1 uses window.phantom.solana.
 * For Google/Apple/Phantom-login embedded wallets, install a tiny Phantom-
 * compatible adapter only if a real injected Phantom provider does not exist.
 */
function installEmbeddedCompatibilityShim(){
  if(
    realInjected()||
    shimInstalled||
    !state.address
  ){
    return;
  }

  const shim={
    __MEMEFLOW_PHANTOM_SHIM__:true,
    isPhantom:true,

    get publicKey(){
      return publicKeyShim();
    },

    async connect(){
      if(!state.address){
        await connectBest();
      }

      return {
        publicKey:
          publicKeyShim()
      };
    },

    async disconnect(){
      await disconnect();
    },

    async signAndSendTransaction(transaction){
      return signAndSend(
        transaction
      );
    }
  };

  try{
    if(!window.phantom){
      Object.defineProperty(
        window,
        'phantom',
        {
          configurable:true,
          value:{
            solana:shim
          }
        }
      );

      shimInstalled=true;
      return;
    }

    if(!window.phantom.solana){
      window.phantom.solana=
        shim;

      shimInstalled=true;
    }
  }catch{}
}

async function disconnect(){
  state.busy=true;
  render();
  setMessage();

  try{
    const raw=
      realInjected();

    if(
      state.provider==='injected'&&
      raw
    ){
      await raw
        .disconnect?.();
    }else{
      await sdk
        ?.disconnect?.();
    }
  }finally{
    state.address=null;
    state.provider=null;
    state.autoConfirm=false;
    state.busy=false;
    render();
  }
}

async function refreshAutoConfirm(){
  if(
    state.provider!=='injected'||
    !sdk?.getAutoConfirmStatus
  ){
    state.autoConfirm=false;
    return;
  }

  try{
    const status=
      await sdk.getAutoConfirmStatus();

    state.autoConfirm=
      Boolean(
        status?.enabled
      );
  }catch{
    state.autoConfirm=false;
  }
}

async function toggleAutoConfirm(){
  if(
    state.provider!=='injected'
  ){
    return;
  }

  if(
    !sdk?.enableAutoConfirm
  ){
    setMessage(
      'Phantom Auto-Confirm is not available in this browser session.',
      true
    );

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
        ?'Browser Auto-Confirm enabled. This is session-based and is not the final offline AUTO LIVE mode.'
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
      await api(
        '/api/settings'
      );

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
      'LIVE approval mode armed. Real BUY/SELL transactions use the connected Phantom wallet.'
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

function takeOverLegacyButtons(){
  const connect=
    $('mfWalletConnect');

  if(
    connect&&
    !connect.dataset.phantomFix4
  ){
    connect.dataset.phantomFix4=
      '1';

    connect.addEventListener(
      'click',
      event=>{
        event.preventDefault();
        event.stopImmediatePropagation();

        connectBest()
          .catch(
            error=>
              setMessage(
                error.message,
                true
              )
          );
      },
      true
    );
  }

  const disconnectButton=
    $('mfWalletDisconnect');

  if(
    disconnectButton&&
    !disconnectButton.dataset.phantomFix4
  ){
    disconnectButton.dataset.phantomFix4=
      '1';

    disconnectButton.addEventListener(
      'click',
      event=>{
        if(!state.address)return;

        event.preventDefault();
        event.stopImmediatePropagation();

        disconnect()
          .catch(
            error=>
              setMessage(
                error.message,
                true
              )
          );
      },
      true
    );
  }

  const copy=
    $('mfWalletCopy');

  if(
    copy&&
    !copy.dataset.phantomFix4
  ){
    copy.dataset.phantomFix4=
      '1';

    copy.addEventListener(
      'click',
      event=>{
        if(!state.address)return;

        event.preventDefault();
        event.stopImmediatePropagation();

        navigator.clipboard
          ?.writeText(
            state.address
          )
          .catch(()=>{});
      },
      true
    );
  }
}

function installUi(){
  if(
    $('mfPhantomConnectPanel')
  ){
    takeOverLegacyButtons();
    render();
    return true;
  }

  const host=
    $('mfAccountWalletGroup')
      ?.querySelector(
        '.mf-account-grid'
      );

  if(!host){
    return false;
  }

  const embedded=
    config.appId
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
    document.createElement(
      'div'
    );

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

    <div class="mf-pc-status">
      <span id="mfPcSetup">PHANTOM APP ID NEEDED</span>
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
      <button id="mfPcUsePhantom" type="button">
        Use Phantom wallet
      </button>

      <button id="mfPcOpenMobile" type="button">
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
          Available now · each real BUY/SELL uses your wallet approval
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
      True offline AUTO LIVE remains locked until the separate on-chain
      Smart Vault is installed and tested.
    </div>

    <div
      id="mfPhantomConnectMsg"
      class="mf-pc-msg"
      hidden
    ></div>
  `;

  host.appendChild(
    panel
  );

  $('mfPcUsePhantom')
    ?.addEventListener(
      'click',
      ()=>connectBest()
        .catch(
          error=>
            setMessage(
              error.message,
              true
            )
        )
    );

  $('mfPcOpenMobile')
    ?.addEventListener(
      'click',
      openInPhantom
    );

  $('mfPcPhantomLogin')
    ?.addEventListener(
      'click',
      ()=>connectSdk(
        'phantom'
      ).catch(
        error=>
          setMessage(
            error.message,
            true
          )
      )
    );

  $('mfPcGoogle')
    ?.addEventListener(
      'click',
      ()=>connectSdk(
        'google'
      ).catch(
        error=>
          setMessage(
            error.message,
            true
          )
      )
    );

  $('mfPcApple')
    ?.addEventListener(
      'click',
      ()=>connectSdk(
        'apple'
      ).catch(
        error=>
          setMessage(
            error.message,
            true
          )
      )
    );

  $('mfPcDisconnect')
    ?.addEventListener(
      'click',
      ()=>disconnect()
        .catch(
          error=>
            setMessage(
              error.message,
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

  takeOverLegacyButtons();
  render();

  return true;
}

async function configureSdk(){
  /*
   * Injected Phantom requires NO App ID and is officially supported by
   * BrowserSDK. Embedded/deeplink providers are added only when App ID exists.
   */
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
        ],
        autoConnect:true
      };

  sdk=
    new BrowserSDK(
      options
    );

  sdk.on?.(
    'connect',
    async data=>{
      const address=
        addressFromConnectResult(
          data
        )||
        await getSdkAddress();

      if(address){
        state.address=
          address;

        state.provider=
          data?.provider||
          state.provider||
          'injected';

        installEmbeddedCompatibilityShim();

        await refreshAutoConfirm();

        render();
      }
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

  try{
    await sdk.autoConnect();

    const address=
      await getSdkAddress();

    if(address){
      state.address=
        address;

      state.provider=
        realInjected()
          ?'injected'
          :'session';

      installEmbeddedCompatibilityShim();
    }
  }catch{}
}

async function boot(){
  const handoffRedeemed=await redeemSessionHandoffIfPresent();
  if(handoffRedeemed)return;

  try{
    config=
      await api(
        '/api/phantom/config'
      );
  }catch{
    config={
      appId:'',
      auto24x7Ready:false
    };
  }

  let attempts=0;

  while(
    !installUi()&&
    attempts<100
  ){
    attempts+=1;

    await new Promise(
      resolve=>
        setTimeout(
          resolve,
          100
        )
    );
  }

  if(
    !$('mfPhantomConnectPanel')
  ){
    console.error(
      'MEMEFLOW Phantom Connect: Wallet host not found.'
    );
    return;
  }

  try{
    await configureSdk();
  }catch(error){
    setMessage(
      error.message||
      'Phantom SDK initialization failed.',
      true
    );
  }

  const raw=
    realInjected();

  if(
    raw?.publicKey
  ){
    const address=
      normalizeAddress(
        raw.publicKey
      );

    if(address){
      state.address=
        address;

      state.provider=
        'injected';
    }
  }

  installEmbeddedCompatibilityShim();
  takeOverLegacyButtons();
  render();

  window.MEMEFLOW_PHANTOM={
    connectBest,
    connectInjected,
    connectSdk,
    openInPhantom,
    disconnect,
    address:()=>state.address,
    provider:()=>state.provider,
    auto24x7Ready:
      ()=>Boolean(
        config?.auto24x7Ready
      )
  };

  window.dispatchEvent(
    new CustomEvent(
      'memeflow:phantom-connect-ready'
    )
  );
}

if(
  document.readyState===
  'loading'
){
  document.addEventListener(
    'DOMContentLoaded',
    boot,
    {once:true}
  );
}else{
  boot();
}
