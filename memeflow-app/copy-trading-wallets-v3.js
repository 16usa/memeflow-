/* MEMEFLOW_COPY_TRADING_MULTI_WALLET_UI_V3 */
(() => {
  'use strict';

  const MAX=10;
  const BASE58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE58_MAP=new Map([...BASE58].map((c,i)=>[c,i]));

  const clean=v=>String(v??'').trim();

  function uniqueWallets(value){
    const raw=Array.isArray(value)
      ? value
      : clean(value).split(/[\s,]+/);

    const out=[];
    const seen=new Set();

    for(const item of raw){
      const wallet=clean(item);
      if(!wallet||seen.has(wallet))continue;
      seen.add(wallet);
      out.push(wallet);
    }
    return out;
  }

  function decodedBase58Length(text){
    if(!text)return 0;
    let bytes=[0];

    for(const char of text){
      const digit=BASE58_MAP.get(char);
      if(digit===undefined)return -1;

      let carry=digit;
      for(let i=0;i<bytes.length;i++){
        const x=bytes[i]*58+carry;
        bytes[i]=x&255;
        carry=x>>8;
      }
      while(carry>0){
        bytes.push(carry&255);
        carry>>=8;
      }
    }

    let leading=0;
    while(leading<text.length&&text[leading]==='1')leading++;

    const payload=(bytes.length===1&&bytes[0]===0)?0:bytes.length;
    return leading+payload;
  }

  function validSolanaWallet(wallet){
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)
      && decodedBase58Length(wallet)===32;
  }

  function settingsPath(input){
    try{
      const value=typeof input==='string'
        ? input
        : input instanceof URL
          ? input.href
          : input?.url;
      return new URL(value,location.href).pathname;
    }catch{
      return '';
    }
  }

  function jsonResponse(payload,status=400){
    return new Response(JSON.stringify(payload),{
      status,
      headers:{'content-type':'application/json; charset=utf-8'}
    });
  }

  function transformSettingsForUi(payload){
    if(!payload||typeof payload!=='object'||!payload.settings)return payload;

    const settings={...payload.settings};
    const wallets=uniqueWallets(
      Array.isArray(settings.copyTradingWallets)
        ? settings.copyTradingWallets
        : settings.copyTradingWallet
    ).slice(0,MAX);

    settings.copyTradingWallets=wallets;

    // The existing System Settings form still reads the legacy field. Feed it
    // a newline list; the visual adapter below turns that list into 1..10 rows.
    settings.copyTradingWallet=wallets.join('\n');

    return {...payload,settings};
  }

  const nativeFetch=window.fetch.bind(window);

  window.fetch=async function memeflowMultiWalletFetch(input,init={}){
    const pathname=settingsPath(input);
    const method=String(
      init?.method ||
      (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();

    let nextInit=init;

    if(pathname==='/api/settings'&&method==='PUT'&&typeof init?.body==='string'){
      try{
        const payload=JSON.parse(init.body);
        const settings={...(payload.settings||{})};

        // The legacy field is the live value produced by the existing form.
        // copyTradingWallets may still contain the previous saved array until
        // this PUT is serialized, so the visible field is authoritative here.
        const wallets=uniqueWallets(settings.copyTradingWallet);

        if(wallets.length>MAX){
          return jsonResponse({
            error:'INVALID_SETTINGS',
            errors:[`Copy Trading supports up to ${MAX} tracked Solana wallets.`]
          });
        }

        const invalid=wallets
          .map((wallet,index)=>({wallet,index}))
          .filter(row=>!validSolanaWallet(row.wallet));

        if(invalid.length){
          return jsonResponse({
            error:'INVALID_SETTINGS',
            errors:invalid.map(
              row=>`Tracked Solana wallet ${row.index+1} is not a valid Solana public address.`
            )
          });
        }

        settings.copyTradingWallets=wallets;
        settings.copyTradingWallet=wallets[0]||'';

        nextInit={
          ...init,
          body:JSON.stringify({...payload,settings})
        };
      }catch{
        // Let the existing API handle malformed requests.
      }
    }

    const response=await nativeFetch(input,nextInit);

    if(
      pathname!=='/api/settings' &&
      pathname!=='/api/settings/defaults'
    ){
      return response;
    }

    const contentType=response.headers.get('content-type')||'';
    if(!contentType.includes('application/json'))return response;

    try{
      const payload=await response.json();
      const transformed=transformSettingsForUi(payload);
      const headers=new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');

      return new Response(JSON.stringify(transformed),{
        status:response.status,
        statusText:response.statusText,
        headers
      });
    }catch{
      return response;
    }
  };

  function injectCss(){
    if(document.getElementById('mfCopyWalletsV3Style'))return;

    const style=document.createElement('style');
    style.id='mfCopyWalletsV3Style';
    style.textContent=`
      .mf-copy-wallets-field{grid-column:1/-1}
      .mf-copy-wallets-field>input[data-setting-key="copyTradingWallet"]{display:none!important}
      .mf-copy-wallets-editor{display:grid;gap:10px;width:100%}
      .mf-copy-wallets-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .mf-copy-wallets-count{font-size:12px;letter-spacing:.04em;opacity:.62;white-space:nowrap}
      .mf-copy-wallets-list{display:grid;gap:8px}
      .mf-copy-wallet-row{display:grid;grid-template-columns:minmax(0,1fr) 38px;gap:8px;align-items:center}
      .mf-copy-wallet-row input{
        width:100%;min-width:0;box-sizing:border-box;
        font:inherit;color:inherit
      }
      .mf-copy-wallet-remove,.mf-copy-wallet-add{
        appearance:none;border:1px solid rgba(125,158,176,.22);
        background:rgba(11,23,30,.62);color:inherit;border-radius:10px;
        min-height:38px;cursor:pointer
      }
      .mf-copy-wallet-remove{font-size:20px;line-height:1}
      .mf-copy-wallet-add{padding:0 12px;font-weight:650}
      .mf-copy-wallet-add:disabled,.mf-copy-wallet-remove:disabled{
        opacity:.35;cursor:not-allowed
      }
      .mf-copy-wallet-help{
        font-size:11px;line-height:1.45;opacity:.56
      }
      @media(max-width:640px){
        .mf-copy-wallets-toolbar{align-items:flex-start}
        .mf-copy-wallet-add{min-height:36px}
        .mf-copy-wallet-row{grid-template-columns:minmax(0,1fr) 36px}
      }
    `;
    document.head.appendChild(style);
  }

  function installEditor(){
    const hidden=document.querySelector(
      '[data-setting-key="copyTradingWallet"]'
    );

    if(!hidden||hidden.dataset.multiWalletV3==='true')return false;

    const field=hidden.closest('.mf293-field');
    if(!field)return false;

    hidden.dataset.multiWalletV3='true';
    hidden.type='hidden';
    field.classList.add('mf-copy-wallets-field');

    const label=field.querySelector('.mf293-field-label');
    if(label)label.textContent='Tracked Solana wallets';

    const editor=document.createElement('div');
    editor.className='mf-copy-wallets-editor';
    editor.innerHTML=`
      <div class="mf-copy-wallets-toolbar">
        <span class="mf-copy-wallets-count">0 / ${MAX}</span>
        <button class="mf-copy-wallet-add" type="button">+ Add wallet</button>
      </div>
      <div class="mf-copy-wallets-list"></div>
      <div class="mf-copy-wallet-help">
        Track up to ${MAX} Solana wallets at the same time. BUY size and proportional sell mirroring apply to every tracked wallet.
      </div>
    `;
    field.appendChild(editor);

    const list=editor.querySelector('.mf-copy-wallets-list');
    const add=editor.querySelector('.mf-copy-wallet-add');
    const count=editor.querySelector('.mf-copy-wallets-count');

    let syncing=false;

    function rows(){
      return [...list.querySelectorAll('.mf-copy-wallet-row')];
    }

    function updateControls(){
      const rowList=rows();
      const filled=rowList
        .map(row=>clean(row.querySelector('input')?.value))
        .filter(Boolean);

      count.textContent=`${filled.length} / ${MAX}`;
      add.disabled=rowList.length>=MAX;

      for(const row of rowList){
        const remove=row.querySelector('.mf-copy-wallet-remove');
        if(remove)remove.disabled=rowList.length<=1;
      }
    }

    function syncHidden(markDirty=true){
      if(syncing)return;

      const wallets=uniqueWallets(
        rows().map(row=>row.querySelector('input')?.value||'')
      ).slice(0,MAX);

      hidden.value=wallets.join('\n');
      editor.dataset.serialized=hidden.value;
      updateControls();

      if(markDirty){
        hidden.dispatchEvent(new Event('input',{bubbles:true}));
      }
    }

    function addRow(value='',focus=false){
      if(rows().length>=MAX)return;

      const row=document.createElement('div');
      row.className='mf-copy-wallet-row';

      const input=document.createElement('input');
      input.type='text';
      input.autocomplete='off';
      input.spellcheck=false;
      input.inputMode='text';
      input.value=value;
      input.placeholder=`Solana wallet ${rows().length+1}`;

      const remove=document.createElement('button');
      remove.type='button';
      remove.className='mf-copy-wallet-remove';
      remove.setAttribute('aria-label','Remove tracked wallet');
      remove.textContent='×';

      input.addEventListener('input',()=>syncHidden(true));
      input.addEventListener('change',()=>syncHidden(true));

      remove.addEventListener('click',()=>{
        row.remove();
        if(!rows().length)addRow('',false);
        rows().forEach((item,index)=>{
          const node=item.querySelector('input');
          if(node)node.placeholder=`Solana wallet ${index+1}`;
        });
        syncHidden(true);
      });

      row.append(input,remove);
      list.appendChild(row);
      updateControls();

      if(focus)input.focus();
    }

    function renderFromHidden(){
      if(editor.contains(document.activeElement))return;

      const serialized=clean(hidden.value);
      if(serialized===editor.dataset.serialized)return;

      syncing=true;
      list.textContent='';

      const wallets=uniqueWallets(serialized).slice(0,MAX);
      if(wallets.length){
        for(const wallet of wallets)addRow(wallet,false);
      }else{
        addRow('',false);
      }

      editor.dataset.serialized=wallets.join('\n');
      hidden.value=wallets.join('\n');
      syncing=false;
      updateControls();
    }

    add.addEventListener('click',()=>{
      if(rows().length>=MAX)return;
      addRow('',true);
      updateControls();
    });

    // mf293Populate changes input.value directly, which does not emit an input
    // event. The existing status text changes after Load/Save/Restore, so use it
    // as the exact point to refresh the visible wallet rows.
    const status=document.getElementById('mf293SettingsStatus');
    if(status){
      new MutationObserver(()=>{
        queueMicrotask(renderFromHidden);
      }).observe(status,{
        childList:true,
        subtree:true,
        characterData:true,
        attributes:true
      });
    }

    // Initial state, then one delayed pass for the first async settings GET.
    editor.dataset.serialized='__init__';
    renderFromHidden();
    setTimeout(renderFromHidden,250);

    return true;
  }

  injectCss();

  const observer=new MutationObserver(()=>{
    if(installEditor())observer.disconnect();
  });

  observer.observe(document.documentElement,{
    childList:true,
    subtree:true
  });

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',installEditor,{once:true});
  }else{
    installEditor();
  }
})();
