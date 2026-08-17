(()=>{
  'use strict';

  const quick=document.querySelector('.quick-bets');
  const source=document.getElementById('betInput');
  const balance=document.getElementById('balanceTop');

  if(!quick || !source || !balance){
    return;
  }

  function usdBalance(){
    const exact=Number(
      balance.dataset.usdBalance
    );

    if(
      Number.isFinite(exact) &&
      exact>=0
    ){
      return exact;
    }

    /*
      USD fallback only.
      Main path uses data-usd-balance from game.js.
    */
    const text=String(
      balance.textContent||''
    );

    if(!text.includes('$')){
      return null;
    }

    const parsed=Number(
      text.replace(/[^0-9.-]/g,'')
    );

    return Number.isFinite(parsed)
      ?parsed
      :null;
  }

  function setStake(percent,button){
    const available=usdBalance();

    if(
      !Number.isFinite(available) ||
      available<=0
    ){
      return;
    }

    /*
      Never round above the available balance.
      Server/game logic continues receiving USD.
    */
    let usd=
      Math.floor(
        available*percent*100
      )/100;

    if(percent>=1){
      usd=
        Math.floor(
          available*100
        )/100;
    }

    usd=Math.max(0,usd);

    source.value=String(usd);

    source.dispatchEvent(
      new Event(
        'input',
        {bubbles:true}
      )
    );

    source.dispatchEvent(
      new Event(
        'change',
        {bubbles:true}
      )
    );

    quick
      .querySelectorAll(
        '[data-stake-pct]'
      )
      .forEach(node=>{
        node.classList.toggle(
          'active',
          node===button
        );
      });
  }

  /*
    Capture phase prevents the old fixed data-bet handler
    from interfering with percentage presets.
  */
  quick.addEventListener(
    'click',
    event=>{
      const button=
        event.target.closest(
          '[data-stake-pct]'
        );

      if(!button)return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const percent=Number(
        button.dataset.stakePct
      );

      if(
        !Number.isFinite(percent) ||
        percent<=0
      ){
        return;
      }

      setStake(
        Math.min(percent,1),
        button
      );
    },
    true
  );

})();