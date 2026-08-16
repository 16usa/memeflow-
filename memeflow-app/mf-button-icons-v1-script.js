/* MF_BUTTON_ICONS_V1_SCRIPT_START */
(()=>{
  'use strict';

  const NS='http://www.w3.org/2000/svg';
  const MARK='data-mf-button-icon-v1';

  const paths={
    home:'<path d="M3 10.7 12 3l9 7.7"/><path d="M5.5 9.6V21h13V9.6"/><path d="M9.2 21v-6.8h5.6V21"/>',
    target:'<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3"/>',
    briefcase:'<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 7V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V7"/><path d="M3 12.5h18"/><path d="M10 12.5v2h4v-2"/>',
    more:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    wallet:'<path d="M4 6.5h13.5A2.5 2.5 0 0 1 20 9v9a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12"/><path d="M2.5 7.5h15"/><path d="M15.5 11.5H22v5h-6.5a2.5 2.5 0 0 1 0-5Z"/><circle cx="18" cy="14" r=".7" fill="currentColor" stroke="none"/>',
    shield:'<path d="M12 2.5 20 5.8v5.7c0 4.8-3.2 8.1-8 10-4.8-1.9-8-5.2-8-10V5.8L12 2.5Z"/>',
    'shield-check':'<path d="M12 2.5 20 5.8v5.7c0 4.8-3.2 8.1-8 10-4.8-1.9-8-5.2-8-10V5.8L12 2.5Z"/><path d="m8.3 12.2 2.3 2.3 5-5"/>',
    scan:'<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/><circle cx="12" cy="12" r="3.2"/><path d="M12 8.8v6.4M8.8 12h6.4"/>',
    eye:'<path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/>',
    copy:'<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    disconnect:'<path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="M14 8l4 4-4 4"/><path d="M8 12h10"/>',
    sliders:'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h7M15 18h5"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="13" cy="18" r="2"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
    check:'<path d="m5 12 4.2 4.2L19 6.5"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    unlock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M9 10V7a4 4 0 0 1 7.2-2.4"/>',
    history:'<path d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7L3 9"/><path d="M3 4.5V9h4.5"/><path d="M12 7.5V12l3 2"/>',
    compare:'<path d="M8 4 4 8l4 4"/><path d="M4 8h10"/><path d="m16 12 4 4-4 4"/><path d="M20 16H10"/>',
    chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    save:'<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3"/><path d="M8 21v-7h8v7"/>',
    refresh:'<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.5 7.2A7.5 7.5 0 0 1 20 11M4 13a7.5 7.5 0 0 0 13.5 3.8"/>',
    undo:'<path d="M9 7 4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6"/>',
    calculator:'<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6h8M8 11h1M12 11h1M16 11h1M8 15h1M12 15h1M16 15h1M8 19h1M12 19h1M16 19h1"/>',
    star:'<path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.4l6.2-.9L12 2.8Z"/>',
    rocket:'<path d="M14.5 4.2c2.6-2.2 5.3-1.8 5.3-1.8s.4 2.7-1.8 5.3l-5.6 5.6-4.1-4.1 6.2-5Z"/><path d="m8.3 9.2-3.5.8L2.7 12l4.2 1.2M12.4 13.3l-.8 3.5-2 2.1-1.2-4.2"/><circle cx="16.2" cy="6" r="1.4"/><path d="M6.5 16.5 4 19M9 17l-2.5 3"/>',
    brain:'<path d="M9.5 4.2A3.2 3.2 0 0 0 4 6.5a3 3 0 0 0 .6 1.8A3.6 3.6 0 0 0 5.5 15a3.2 3.2 0 0 0 4 4.8M14.5 4.2A3.2 3.2 0 0 1 20 6.5a3 3 0 0 1-.6 1.8 3.6 3.6 0 0 1-.9 6.7 3.2 3.2 0 0 1-4 4.8"/><path d="M9.5 4.2v15.6M14.5 4.2v15.6M7 8.5c1.6 0 2.5.7 2.5 2M17 8.5c-1.6 0-2.5.7-2.5 2M7 15c1.6 0 2.5-.7 2.5-2M17 15c-1.6 0-2.5-.7-2.5-2"/>',
    sparkles:'<path d="m12 3 1.3 3.4L17 7.8l-3.7 1.4L12 12.6l-1.3-3.4L7 7.8l3.7-1.4L12 3Z"/><path d="m5 13 .9 2.2L8 16l-2.1.8L5 19l-.9-2.2L2 16l2.1-.8L5 13ZM19 12l.7 1.8 1.8.7-1.8.7L19 17l-.7-1.8-1.8-.7 1.8-.7L19 12Z"/>',
    card:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9h18"/><path d="M7 15h4"/>',
    power:'<path d="M12 2.8v8"/><path d="M6.3 5.7a8 8 0 1 0 11.4 0"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3.1 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    alert:'<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4.5M12 17h.01"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>',
    close:'<path d="M6 6l12 12M18 6 6 18"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
  };

  function svg(icon){
    const p=paths[icon]||paths.chevron;
    return `<span class="mf-btn-icon mf-icon-${icon}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${p}</svg></span>`;
  }

  function textOf(el){
    return [
      el.id||'',
      el.getAttribute('aria-label')||'',
      el.getAttribute('title')||'',
      el.getAttribute('data-sheet')||'',
      el.getAttribute('data-tab')||'',
      el.getAttribute('name')||'',
      (el.textContent||'')
    ].join(' ').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function hasGraphic(el){
    if(el.querySelector('svg,img,.icon,.nav-icon,.wallet-icon,.mf-btn-icon'))return true;
    const t=(el.textContent||'').trim();
    return !!t && t.length<=4 && /^[^A-Za-zА-Яа-я0-9]+$/.test(t);
  }

  function choose(el){
    const t=textOf(el);

    // Navigation
    if(/\bhome\b/.test(t)) return 'home';
    if(/candidate/.test(t)) return 'target';
    if(/\bpositions?\b/.test(t)) return 'briefcase';
    if(/\bmore\b/.test(t)) return 'more';

    // Wallet / account
    if(/disconnect/.test(t)) return 'disconnect';
    if(/copy address|copy/.test(t)) return 'copy';
    if(/verify ownership|verify wallet|verify/.test(t)) return 'shield-check';
    if(/wallet|connect wallet/.test(t)) return 'wallet';

    // Analysis / AI
    if(/manual.*scan|analy[sz]e token|scan token|\bscan\b/.test(t)) return 'scan';
    if(/ai analysis|decision inspector|view decision|explain|why.*decision/.test(t)) return 'brain';
    if(/evidence|view evidence/.test(t)) return 'eye';
    if(/validate execution|pre-trade|execution review|review candidate|review trade/.test(t)) return 'shield-check';
    if(/decision replay|replay|history|timeline/.test(t)) return 'history';
    if(/compare/.test(t)) return 'compare';
    if(/chart|market chart/.test(t)) return 'chart';

    // Billing
    if(/upgrade|pro\b|subscribe/.test(t)) return 'sparkles';
    if(/billing|payment|checkout|manage billing/.test(t)) return 'card';

    // Settings / controls
    if(/save settings|\bsave\b/.test(t)) return 'save';
    if(/reload|refresh/.test(t)) return 'refresh';
    if(/restore|defaults|reset/.test(t)) return 'undo';
    if(/calculate impact|calculate/.test(t)) return 'calculator';
    if(/execution settings|settings|strategy|risk|slippage|profile/.test(t)) return 'sliders';
    if(/kill switch|stop engine|emergency stop|power/.test(t)) return 'power';

    // Common actions
    if(/add to watchlist|watchlist|favorite/.test(t)) return 'star';
    if(/execute trade|buy now|place order|submit trade/.test(t)) return 'rocket';
    if(/search|find/.test(t)) return 'search';
    if(/lock/.test(t)) return 'lock';
    if(/unlock/.test(t)) return 'unlock';
    if(/delete|remove|trash/.test(t)) return 'trash';
    if(/close|cancel|dismiss/.test(t)) return 'close';
    if(/add|create|new\b/.test(t)) return 'plus';
    if(/start|continue|next|open|view|details|manage/.test(t)) return 'chevron';
    if(/confirm|approve|done|pass|ready/.test(t)) return 'check';

    // Tiny time/filter controls keep a very small clock icon.
    if(/^\s*(1s|1m|5m|15m|1h|4h|1d|all)\s*$/.test((el.textContent||'').trim().toLowerCase())) return 'clock';

    // Generic button still gets a restrained directional icon.
    return 'chevron';
  }

  function shouldSkip(el){
    if(!el || el.nodeType!==1)return true;
    if(el.hasAttribute(MARK))return true;
    if(el.classList.contains('close-sheet') && hasGraphic(el))return true;

    // Existing icon/graphic is already thematic; do not double it.
    if(hasGraphic(el)){
      el.classList.add('mf-existing-graphic');
      el.setAttribute(MARK,'existing');
      return true;
    }
    return false;
  }

  function decorate(el){
    if(shouldSkip(el))return;
    const icon=choose(el);
    el.insertAdjacentHTML('afterbegin',svg(icon));
    el.classList.add('mf-has-icon');
    el.setAttribute(MARK,icon);
  }

  function scan(root=document){
    root.querySelectorAll?.('button, a.btn, [role="button"]').forEach(decorate);
  }

  function boot(){
    scan(document);

    const observer=new MutationObserver(records=>{
      for(const r of records){
        for(const n of r.addedNodes){
          if(n.nodeType!==1)continue;
          if(n.matches?.('button,a.btn,[role="button"]'))decorate(n);
          scan(n);
        }
      }
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.MEMEFLOW_BUTTON_ICONS_V1={
      refresh:()=>scan(document),
      stop:()=>observer.disconnect()
    };
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
 /* MF_BUTTON_ICONS_V1_SCRIPT_END */
