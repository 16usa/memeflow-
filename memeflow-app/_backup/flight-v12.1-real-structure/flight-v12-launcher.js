(()=>{
  'use strict';

  const VERSION='12.0';

  if(location.pathname.includes('flight-v12')){
    return;
  }

  const q=(selector,root=document)=>
    root.querySelector(selector);

  function norm(value){
    return String(value||'')
      .replace(/\s+/g,' ')
      .trim()
      .toUpperCase();
  }

  function removeLegacyNag(){
    const phrases=[
      'OPEN MEMEFLOW AS AN APP',
      'IPHONE FULL SCREEN',
      'SAFARI CANNOT HIDE ITS TOP AND BOTTOM BROWSER BARS'
    ];

    const matches=[
      ...document.querySelectorAll(
        'dialog,[role="dialog"],section,div'
      )
    ]
    .filter(el=>{
      const value=norm(
        el.innerText ||
        el.textContent
      );

      return phrases.some(
        phrase=>value.includes(phrase)
      );
    })
    .sort((a,b)=>{
      const ar=a.getBoundingClientRect();
      const br=b.getBoundingClientRect();
      return ar.width*ar.height-br.width*br.height;
    });

    matches[0]?.remove();
  }

  function utility(){
    return q(
      '.launch-panel .utility-actions,'+
      '.control-panel .utility-actions'
    );
  }

  function findFullscreen(){
    const row=utility();
    if(!row)return null;

    const controls=[
      ...row.querySelectorAll(
        'button,a,[role="button"]'
      )
    ];

    if(!controls.length)return null;

    const owned=
      controls.find(
        el=>
          el.dataset.v12FlightLauncher===
          'true'
      );

    if(owned)return owned;

    const labeled=
      controls.find(el=>{
        const label=norm(
          (el.getAttribute('aria-label')||'')+
          ' '+
          (el.getAttribute('title')||'')
        );

        return (
          label.includes('FULL SCREEN') ||
          label.includes('FULLSCREEN') ||
          label.includes('EXPAND') ||
          label.includes('FLIGHT VIEW')
        );
      });

    if(labeled)return labeled;

    /*
      Current utility row is Settings / Wallet / Sound / Fullscreen.
      Wait until all four are present before using the last one.
    */
    if(controls.length>=4){
      return controls[controls.length-1];
    }

    return null;
  }

  function isStandalone(){
    return (
      window.matchMedia?.(
        '(display-mode: standalone)'
      )?.matches ||
      window.matchMedia?.(
        '(display-mode: fullscreen)'
      )?.matches ||
      navigator.standalone===true
    );
  }

  function copyAppearance(from,to){
    for(const attr of [...from.attributes]){
      const name=attr.name.toLowerCase();

      if(
        name==='type' ||
        name==='role' ||
        name==='href' ||
        name==='target' ||
        name==='rel' ||
        name==='aria-label' ||
        name==='title' ||
        name.startsWith('data-mf-') ||
        name.startsWith('data-v12')
      ){
        continue;
      }

      try{
        to.setAttribute(
          attr.name,
          attr.value
        );
      }catch(_){}
    }
  }

  function install(){
    removeLegacyNag();

    const old=findFullscreen();
    if(!old)return false;

    if(old.dataset.v12FlightLauncher==='true'){
      return true;
    }

    /*
      Replace the old button with an anchor after the Game has bound its
      old handlers. This removes direct button listeners and old delegated
      "button fullscreen" code no longer sees this control.
    */
    const link=document.createElement('a');

    copyAppearance(old,link);

    link.innerHTML=old.innerHTML;
    link.href='/flight-v12.html';
    link.target=isStandalone()?'_self':'_blank';
    link.rel='noopener';
    link.dataset.v12FlightLauncher='true';

    /*
      Deliberately avoid the word FULLSCREEN in the label so retired
      V10 delegated listeners do not recognize it.
    */
    link.setAttribute(
      'aria-label',
      'Open Flight View'
    );

    link.setAttribute(
      'title',
      'Open Flight View'
    );

    link.style.textDecoration='none';

    old.replaceWith(link);

    console.info(
      '[MEMEFLOW FLIGHT V12 LAUNCHER]',
      VERSION,
      'READY'
    );

    return true;
  }

  function boot(){
    removeLegacyNag();

    let attempts=0;

    const timer=setInterval(()=>{
      attempts+=1;

      if(install() || attempts>=60){
        clearInterval(timer);
      }
    },120);

    const observer=new MutationObserver(()=>{
      removeLegacyNag();

      if(
        !q(
          '[data-v12-flight-launcher="true"]'
        )
      ){
        install();
      }
    });

    observer.observe(
      document.documentElement,
      {
        childList:true,
        subtree:true
      }
    );
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',
      ()=>{
        /*
          Let all current Game modules finish binding the original utility
          buttons, then replace the old Fullscreen control once.
        */
        setTimeout(boot,220);
      },
      {once:true}
    );
  }else{
    setTimeout(boot,220);
  }
})();
