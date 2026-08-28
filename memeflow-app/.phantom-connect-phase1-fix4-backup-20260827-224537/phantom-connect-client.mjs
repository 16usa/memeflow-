import {BrowserSDK,AddressType,NetworkId} from '@phantom/browser-sdk';

const $=id=>document.getElementById(id);

let config={
  appId:'',
  auto24x7Ready:false
};

let sdk=null;

const state={
  address:null,
  provider:null,
  busy:false,
  autoConfirm:false,
  sdkError:null
};

async function api(path,opt={}){
  const response=await fetch(
    path,
    {
      credentials:'same-origin',
      cache:'no-store',
      ...opt,
      headers:{
        accept:'application/json',
        ...(opt.body
          ?{'content-type':'application/json'}
          :{}),
        ...(opt.headers||{})
      }
    }
  );

  let data={};

  try{
    data=await response.json();
  }catch{}

  if(!response.ok){
    throw new Error(
      data.message||
      data.error||
      `HTTP ${response.status}`
    );
  }

  return data;
}

function injected(){
  return (
    window.phantom?.solana?.isPhantom
      ?window.phantom.solana
      :window.solana?.isPhantom
        ?window.solana
        :null
  );
}

function isMobile(){
  return /Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent||''
  );
}

function shortAddress(address){
  return address
    ?`${address.slice(0,5)}…${address.slice(-5)}`
    :'Not connected';
}

function setMessage(text='',bad=false){
  const node=$('mfPhantomConnectMsg');

  if(!node)return;

  node.hidden=!text;
  node.textContent=text;
  node.classList.toggle(
    'bad',
    bad
  );
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
      shortAddress(state.address);
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

  for(const id of [
    'mfPcUsePhantom',
    'mfPcOpenMobile',
    'mfPcPhantomLogin',
    'mfPcGoogle',
    'mfPcApple',
    'mfPcDisconnect',
    'mfPcApproveMode'
  ]){
    const node=$(id);

    if(node){
      node.disabled=
        state.busy;
    }
  }
}

function addressFromSdk(rows=[]){
  const row=
    rows.find(
      item=>
        String(
          item?.addressType||
          item?.type||
          ''
        )
          .toLowerCase()
          .includes(
            'solana'
          )
    )||
    rows[0];

  return row?.address||null;
}

function openInPhantom(){
  const target=
    encodeURIComponent(
      location.href
    );

  const ref=
    encodeURIComponent(
      location.origin
    );

  location.href=
    `https://phantom.app/ul/browse/${target}?ref=${ref}`;
}

async function connectInjected(){
  const provider=
    injected();

  if(!provider){
    if(isMobile()){
      openInPhantom();
      return null;
    }

    throw new Error(
      'Phantom extension was not detected.'
    );
  }

  const result=
    await provider.connect();

  const address=
    result?.publicKey?.toString?.()||
    provider.publicKey?.toString?.();

  if(!address){
    throw new Error(
      'Phantom returned no Solana address.'
    );
  }

  state.address=
    String(address);

  state.provider=
    'injected';

  await refreshAutoConfirm();

  render();

  return state.address;
}

async function connectSdk(provider){
  if(!sdk){
    throw new Error(
      state.sdkError||
      'PHANTOM_APP_ID is required for Phantom Login / embedded wallet.'
    );
  }

  const result=
    await sdk.connect({
      provider
    });

  const rows=
    result?.addresses||
    await sdk
      .getAddresses?.()
      .catch(
        ()=>[]
      );

  const address=
    addressFromSdk(
      rows||[]
    );

  if(!address){
    throw new Error(
      'Phantom Connect returned no Solana address.'
    );
  }

  state.address=
    address;

  state.provider=
    provider;

  render();

  return address;
}

async function connectBest(){
  state.busy=true;
  render();
  setMessage();

  try{
    const real=
      injected();

    if(real){
      return await connectInjected();
    }

    if(config.appId&&sdk){
      if(isMobile()){
        try{
          return await connectSdk(
            'deeplink'
          );
        }catch{
          openInPhantom();
          return null;
        }
      }

      return await connectSdk(
        'phantom'
      );
    }

    if(isMobile()){
      openInPhantom();
      return null;
    }

    throw new Error(
      'Phantom is not installed. Configure PHANTOM_APP_ID to enable Phantom Connect login.'
    );
  }finally{
    state.busy=false;
    render();
  }
}

async function disconnect(){
  state.busy=true;
  render();
  setMessage();

  try{
    if(
      state.provider==='injected'&&
      injected()
    ){
      await injected()
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
    state.provider!=='injected'
  ){
    state.autoConfirm=false;
    return;
  }

  if(
    sdk?.getAutoConfirmStatus
  ){
    try{
      const status=
        await sdk.getAutoConfirmStatus();

      state.autoConfirm=
        Boolean(
          status?.enabled
        );

      return;
    }catch{}
  }

  state.autoConfirm=false;
}

async function toggleAutoConfirm(){
  if(
    state.provider!=='injected'
  ){
    return;
  }

  if(
    !sdk||
    !sdk.enableAutoConfirm
  ){
    setMessage(
      'Phantom Browser SDK Auto-Confirm requires PHANTOM_APP_ID. Normal transaction approval still works.',
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
        ?'Browser Auto-Confirm enabled. This requires the active browser/extension session; it is not the final offline 24/7 AUTO mode.'
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

/*
 * Take over the existing MEMEFLOW Connect wallet button without changing
 * account-wallet-settings.js. Capture phase runs before its old click handler.
 */
function takeOverLegacyButtons(){
  const connect=
    $('mfWalletConnect');

  if(
    connect&&
    !connect.dataset.phantomConnectTakeover
  ){
    connect.dataset.phantomConnectTakeover=
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
    !disconnectButton.dataset.phantomConnectTakeover
  ){
    disconnectButton.dataset.phantomConnectTakeover=
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
    !copy.dataset.phantomConnectTakeover
  ){
    copy.dataset.phantomConnectTakeover=
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
          .catch(
            ()=>{}
          );
      },
      true
    );
  }
}

function installUi(){
  if(
    $('mfPhantomConnectPanel')
  ){
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

      <i id="mfPcBadge">
        NOT CONNECTED
      </i>
    </div>

    <div class="mf-pc-status">
      <span id="mfPcSetup">
        PHANTOM APP ID NEEDED
      </span>
    </div>

    <div class="mf-pc-meta">
      <span>
        <small>Provider</small>
        <b id="mfPcProvider">—</b>
      </span>

      <span>
        <small>Address</small>
        <b id="mfPcAddress">
          Not connected
        </b>
      </span>
    </div>

    <div class="mf-pc-actions">
      <button
        id="mfPcUsePhantom"
        type="button"
      >
        Use Phantom wallet
      </button>

      <button
        id="mfPcOpenMobile"
        type="button"
      >
        Open in Phantom app
      </button>

      ${embedded}

      <button
        id="mfPcDisconnect"
        type="button"
      >
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
  if(!config.appId){
    return;
  }

  try{
    sdk=
      new BrowserSDK({
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
      });

    sdk.on?.(
      'connect',
      async data=>{
        state.address=
          addressFromSdk(
            data?.addresses||
            []
          );

        state.provider=
          String(
            data?.provider||
            'phantom'
          );

        render();
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

      if(
        sdk.isConnected?.()
      ){
        const rows=
          await sdk.getAddresses();

        state.address=
          addressFromSdk(
            rows||[]
          );
      }
    }catch{}
  }catch(error){
    state.sdkError=
      error?.message||
      'Phantom Connect SDK initialization failed.';

    setMessage(
      state.sdkError,
      true
    );
  }
}

async function boot(){
  /*
   * CRITICAL FIX 3:
   * Render the wallet panel BEFORE initializing the Phantom SDK.
   * Therefore Safari/no-extension/no-App-ID can never make the panel disappear.
   */
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
      'MEMEFLOW Phantom Connect: wallet host was not found.'
    );

    return;
  }

  await configureSdk();

  /*
   * If we are already inside Phantom's mobile browser, restore the
   * injected connection without requiring a second page load.
   */
  const provider=
    injected();

  if(
    provider?.publicKey
  ){
    state.address=
      String(
        provider.publicKey
          .toString()
      );

    state.provider=
      'injected';

    await refreshAutoConfirm();
  }

  takeOverLegacyButtons();
  render();

  window.dispatchEvent(
    new CustomEvent(
      'memeflow:phantom-connect-ready'
    )
  );
}

window.MEMEFLOW_PHANTOM={
  connectBest,
  connectInjected,
  connectSdk,
  openInPhantom,
  disconnect,
  address:
    ()=>state.address,
  provider:
    ()=>state.provider,
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
    boot,
    {once:true}
  );
}else{
  boot();
}
