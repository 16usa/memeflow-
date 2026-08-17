(()=>{
  'use strict';

  const VERSION='1.1';

  const USD_KEY='memeflow.game.displayCurrency';
  const SOL_PRICE_KEY='memeflow.game.solUsd';
  const SOL_TIME_KEY='memeflow.game.solUsdAt';

  const $=(selector)=>document.querySelector(selector);

  const state={
    mode:'USD',
    solUsd:0,
    solUpdatedAt:0
  };

  const originalText=
    new WeakMap();

  let observer=null;

  const safeGet=(key)=>{
    try{
      return localStorage.getItem(key);
    }catch{
      return null;
    }
  };

  const safeSet=(key,value)=>{
    try{
      localStorage.setItem(key,String(value));
    }catch{}
  };

  const storedMode=
    String(safeGet(USD_KEY)||'USD').toUpperCase();

  if(
    storedMode==='USD' ||
    storedMode==='SOL'
  ){
    state.mode=storedMode;
  }

  const cachedPrice=
    Number(safeGet(SOL_PRICE_KEY));

  const cachedAt=
    Number(safeGet(SOL_TIME_KEY));

  if(
    Number.isFinite(cachedPrice) &&
    cachedPrice>0
  ){
    state.solUsd=cachedPrice;
    state.solUpdatedAt=
      Number.isFinite(cachedAt)
        ?cachedAt
        :0;
  }

  function solDecimals(value){
    const n=Math.abs(Number(value)||0);

    if(n>=100)return 2;
    if(n>=10)return 3;
    if(n>=1)return 3;
    if(n>=.1)return 4;
    if(n>=.01)return 5;

    return 6;
  }

  function solTextFromUsd(usd){
    const rate=state.solUsd;

    if(!(rate>0)){
      return null;
    }

    const value=
      Number(usd)/rate;

    if(!Number.isFinite(value)){
      return null;
    }

    return (
      value.toFixed(
        solDecimals(value)
      )+
      ' SOL'
    );
  }

  function convertDollarText(text){
    if(
      state.mode!=='SOL' ||
      !(state.solUsd>0)
    ){
      return text;
    }

    return String(text).replace(
      /([+-]?)\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/g,
      (
        full,
        sign,
        raw
      )=>{
        const usd=
          Number(
            String(raw).replace(/,/g,'')
          );

        if(!Number.isFinite(usd)){
          return full;
        }

        const converted=
          solTextFromUsd(usd);

        if(!converted){
          return full;
        }

        return (
          sign+
          converted
        );
      }
    );
  }

  function excluded(node){
    const parent=
      node?.parentElement;

    if(!parent)return true;

    return Boolean(
      parent.closest(
        '.currency-cell,script,style,noscript'
      )
    );
  }

  function processTextNode(node){
    if(
      !node ||
      node.nodeType!==Node.TEXT_NODE ||
      excluded(node)
    ){
      return;
    }

    const current=
      String(node.nodeValue||'');

    if(state.mode==='USD'){

      if(current.includes('$')){
        originalText.set(
          node,
          current
        );
      }

      const source=
        originalText.get(node);

      if(
        source!==undefined &&
        current!==source
      ){
        node.nodeValue=source;
      }

      return;
    }

    /*
      Any fresh value written by game.js is USD source data.
    */
    if(current.includes('$')){
      originalText.set(
        node,
        current
      );
    }

    const source=
      originalText.get(node);

    if(source===undefined){
      return;
    }

    const rendered=
      convertDollarText(source);

    if(node.nodeValue!==rendered){
      node.nodeValue=rendered;
    }
  }

  function walkText(root){
    if(!root)return;

    if(root.nodeType===Node.TEXT_NODE){
      processTextNode(root);
      return;
    }

    const walker=
      document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT
      );

    let node;

    while(
      (node=walker.nextNode())
    ){
      processTextNode(node);
    }
  }

  function observe(){
    if(!observer){
      observer=
        new MutationObserver(
          mutations=>{

            observer.disconnect();

            for(const mutation of mutations){

              if(
                mutation.type==='characterData'
              ){
                processTextNode(
                  mutation.target
                );
              }

              for(
                const node
                of mutation.addedNodes||[]
              ){
                walkText(node);
              }
            }

            observe();
          }
        );
    }

    observer.observe(
      document.body,
      {
        subtree:true,
        childList:true,
        characterData:true
      }
    );
  }

  function renderAllText(){
    observer?.disconnect();

    walkText(
      document.body
    );

    observe();
  }

  function updateRate(){
    const node=
      $('#solUsdRate');

    if(!node)return;

    if(!(state.solUsd>0)){
      node.textContent=
        '1 SOL ≈ —';

      return;
    }

    node.textContent=
      '1 SOL ≈ $'+
      state.solUsd.toLocaleString(
        'en-US',
        {
          minimumFractionDigits:2,
          maximumFractionDigits:2
        }
      );
  }

  /* -------------------------------------------------------
     Stake input bridge

     #betInput stays USD internally.
     The visible mirror may show/edit SOL.
  ------------------------------------------------------- */

  const sourceBet=
    $('#betInput');

  const stakeWrap=
    sourceBet?.closest(
      '.stake-input'
    );

  const prefix=
    $('#stakeCurrencyPrefix');

  let displayBet=null;
  let lastSourceValue=null;

  function visibleStakeValue(){
    const usd=
      Number(sourceBet?.value);

    if(!Number.isFinite(usd)){
      return '';
    }

    if(
      state.mode==='SOL' &&
      state.solUsd>0
    ){
      const sol=
        usd/state.solUsd;

      return sol.toFixed(
        solDecimals(sol)
      );
    }

    return String(
      sourceBet.value
    );
  }

  function syncStakeFromSource(force=false){
    if(
      !sourceBet ||
      !displayBet
    ){
      return;
    }

    const sourceValue=
      String(sourceBet.value);

    if(
      !force &&
      document.activeElement===displayBet
    ){
      return;
    }

    if(
      !force &&
      sourceValue===lastSourceValue
    ){
      return;
    }

    lastSourceValue=
      sourceValue;

    displayBet.value=
      visibleStakeValue();
  }

  function setupStakeBridge(){
    if(
      !sourceBet ||
      !stakeWrap
    ){
      return;
    }

    sourceBet.classList.add(
      'currency-source-input'
    );

    displayBet=
      sourceBet.cloneNode(false);

    /*
      cloneNode copies the hidden source class too.
      The display input must remain visible and interactive.
    */
    displayBet.classList.remove(
      'currency-source-input'
    );

    displayBet.id=
      'betInputDisplay';

    displayBet.removeAttribute(
      'name'
    );

    displayBet.removeAttribute(
      'min'
    );

    displayBet.step=
      'any';

    displayBet.removeAttribute(
      'aria-describedby'
    );

    sourceBet.insertAdjacentElement(
      'afterend',
      displayBet
    );

    displayBet.addEventListener(
      'input',
      ()=>{

        const entered=
          Number(displayBet.value);

        if(!Number.isFinite(entered)){
          return;
        }

        const usd=
          state.mode==='SOL' &&
          state.solUsd>0
            ?entered*state.solUsd
            :entered;

        sourceBet.value=
          String(
            Math.max(
              0,
              Math.round(usd*100)/100
            )
          );

        lastSourceValue=
          String(sourceBet.value);

        sourceBet.dispatchEvent(
          new Event(
            'input',
            {bubbles:true}
          )
        );
      }
    );

    displayBet.addEventListener(
      'change',
      ()=>{
        sourceBet.dispatchEvent(
          new Event(
            'change',
            {bubbles:true}
          )
        );
      }
    );

    setInterval(
      ()=>syncStakeFromSource(false),
      180
    );

    syncStakeFromSource(true);
  }

  function updateModeUi(){
    document
      .querySelectorAll(
        '[data-currency]'
      )
      .forEach(button=>{

        const active=
          button.dataset.currency===
          state.mode;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active?'true':'false'
        );
      });

    if(prefix){
      prefix.textContent=
        state.mode==='SOL'
          ?'SOL'
          :'$';
    }

    document.documentElement
      .dataset.displayCurrency=
      state.mode;
  }

  function applyMode(mode){
    mode=
      String(mode||'USD')
        .toUpperCase();

    if(
      mode!=='USD' &&
      mode!=='SOL'
    ){
      return;
    }

    if(
      mode==='SOL' &&
      !(state.solUsd>0)
    ){
      return;
    }

    state.mode=mode;

    safeSet(
      USD_KEY,
      mode
    );

    updateModeUi();
    syncStakeFromSource(true);
    renderAllText();

    document.dispatchEvent(
      new CustomEvent(
        'memeflow:currencychange',
        {
          detail:{
            mode:state.mode,
            solUsd:state.solUsd
          }
        }
      )
    );
  }

  async function fetchSolPrice(){
    const controller=
      new AbortController();

    const timer=
      setTimeout(
        ()=>controller.abort(),
        6000
      );

    try{
      const response=
        await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_last_updated_at=true',
          {
            headers:{
              accept:'application/json'
            },
            signal:controller.signal,
            cache:'no-store'
          }
        );

      if(!response.ok){
        throw new Error(
          'SOL price HTTP '+response.status
        );
      }

      const json=
        await response.json();

      const price=
        Number(
          json?.solana?.usd
        );

      if(
        !Number.isFinite(price) ||
        price<=0
      ){
        throw new Error(
          'Invalid SOL price'
        );
      }

      state.solUsd=price;

      state.solUpdatedAt=
        Number(
          json?.solana?.last_updated_at
        )*1000 ||
        Date.now();

      safeSet(
        SOL_PRICE_KEY,
        state.solUsd
      );

      safeSet(
        SOL_TIME_KEY,
        state.solUpdatedAt
      );

      updateRate();

      if(state.mode==='SOL'){
        syncStakeFromSource(true);
        renderAllText();
      }

    }catch(error){
      console.warn(
        '[MEMEFLOW CURRENCY]',
        'SOL price unavailable',
        error
      );

      updateRate();

    }finally{
      clearTimeout(timer);
    }
  }

  function setupInfo(){
    const button=
      $('#currencyInfoBtn');

    const pop=
      $('#currencyInfoPop');

    if(
      !button ||
      !pop
    ){
      return;
    }

    button.addEventListener(
      'click',
      event=>{
        event.stopPropagation();

        const open=
          pop.hidden;

        pop.hidden=!open;

        button.setAttribute(
          'aria-expanded',
          open?'true':'false'
        );
      }
    );

    document.addEventListener(
      'click',
      event=>{
        if(
          pop.hidden ||
          event.target.closest(
            '#currencyCell'
          )
        ){
          return;
        }

        pop.hidden=true;

        button.setAttribute(
          'aria-expanded',
          'false'
        );
      }
    );
  }

  function setupToggle(){
    document
      .querySelectorAll(
        '[data-currency]'
      )
      .forEach(button=>{

        button.addEventListener(
          'click',
          async ()=>{

            const next=
              button.dataset.currency;

            if(
              next==='SOL' &&
              !(state.solUsd>0)
            ){
              await fetchSolPrice();
            }

            applyMode(next);
          }
        );
      });
  }

  function boot(){
    setupStakeBridge();
    setupToggle();
    setupInfo();

    updateRate();
    updateModeUi();

    /*
      Capture original USD text before applying saved mode.
    */
    const previousMode=
      state.mode;

    state.mode='USD';
    renderAllText();

    state.mode=
      previousMode;

    if(
      state.mode==='SOL' &&
      state.solUsd>0
    ){
      updateModeUi();
      syncStakeFromSource(true);
      renderAllText();
    }

    fetchSolPrice();

    setInterval(
      fetchSolPrice,
      60000
    );

    console.info(
      '[MEMEFLOW DISPLAY CURRENCY]',
      VERSION,
      'READY'
    );
  }

  if(
    document.readyState==='loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      {once:true}
    );
  }else{
    boot();
  }

})();