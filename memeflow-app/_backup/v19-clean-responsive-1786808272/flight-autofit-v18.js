(()=>{
  'use strict';

  const SELECTORS = [
    '.launch-panel',
    '.token-panel',
    '.stats-panel'
  ];

  let raf = 0;

  function makeInner(panel){
    if(!panel) return null;

    let inner = panel.querySelector(':scope > .mf-auto-fit-inner');
    if(inner) return inner;

    inner = document.createElement('div');
    inner.className = 'mf-auto-fit-inner';

    /*
      Move existing DOM nodes, never clone them.
      Existing IDs / listeners / state stay intact.
    */
    const nodes = [...panel.childNodes];

    for(const node of nodes){
      inner.appendChild(node);
    }

    panel.appendChild(inner);

    return inner;
  }


  function measureFit(panel){
    const inner = makeInner(panel);

    if(!panel || !inner) return;

    const box = panel.getBoundingClientRect();

    const availableW = Math.max(
      1,
      panel.clientWidth
    );

    const availableH = Math.max(
      1,
      panel.clientHeight
    );

    if(
      box.width < 2 ||
      box.height < 2 ||
      availableW < 2 ||
      availableH < 2
    ){
      return;
    }

    /*
      Reset to natural 1:1 layout first.
    */
    inner.style.transform = 'none';
    inner.style.transformOrigin = '0 0';
    inner.style.width = availableW + 'px';
    inner.style.height = 'auto';

    /*
      Iterative fit:
      when scale becomes smaller, the virtual layout width gets
      larger, so text wrapping changes. Re-measure several times.
    */
    let scale = 1;

    for(let pass=0; pass<4; pass++){

      const virtualW =
        availableW / Math.max(scale, .01);

      inner.style.width =
        virtualW + 'px';

      inner.style.transform =
        'none';

      const naturalW =
        Math.max(
          inner.scrollWidth,
          inner.offsetWidth,
          1
        );

      const naturalH =
        Math.max(
          inner.scrollHeight,
          inner.offsetHeight,
          1
        );

      const nextScale =
        Math.min(
          1,
          availableW / naturalW,
          availableH / naturalH
        );

      if(
        Math.abs(
          nextScale - scale
        ) < .003
      ){
        scale = nextScale;
        break;
      }

      scale = nextScale;
    }

    /*
      Tiny safety margin prevents iOS rounding from clipping
      1px borders / glyph descenders.
    */
    scale =
      Math.max(
        .42,
        Math.min(
          1,
          scale * .985
        )
      );

    inner.style.width =
      (availableW / scale) + 'px';

    inner.style.transform =
      `scale(${scale})`;

    panel.style.setProperty(
      '--mf-fit-scale',
      scale.toFixed(4)
    );

    panel.dataset.fitScale =
      scale.toFixed(3);
  }


  function fitHistory(){

    const panel =
      document.querySelector(
        '.history-panel'
      );

    if(!panel) return;

    const h =
      panel.clientHeight;

    const w =
      panel.clientWidth;

    if(!h || !w) return;

    /*
      History must remain scrollable.
      So instead of scaling the scroll container with transform,
      calculate density from its actual dimensions.
    */
    const density =
      Math.max(
        .58,
        Math.min(
          1,
          Math.min(
            h / 185,
            w / 280
          )
        )
      );

    panel.style.setProperty(
      '--mf-history-fit',
      density.toFixed(4)
    );
  }


  function fitPosition(){

    const hud =
      document.getElementById(
        'flightPositionHud'
      );

    if(!hud) return;

    const parent =
      document.querySelector(
        '.token-panel'
      );

    if(!parent) return;

    const scale =
      Number(
        parent.dataset.fitScale || 1
      );

    hud.style.setProperty(
      '--mf-position-fit',
      Math.max(
        .55,
        Math.min(1,scale)
      ).toFixed(4)
    );
  }


  function fitActions(){

    const dock =
      document.getElementById(
        'v12ActionDock'
      );

    if(!dock) return;

    const buttons = [
      document.getElementById('startBtn'),
      document.getElementById('cashoutBtn'),
      document.getElementById('mfAutoLoopBtn')
    ].filter(Boolean);

    for(const button of buttons){

      button.style.removeProperty(
        'transform'
      );

      button.style.removeProperty(
        'zoom'
      );

      button.style.maxWidth =
        '100%';

      button.style.maxHeight =
        '100%';
    }
  }


  function fitAll(){

    cancelAnimationFrame(raf);

    raf =
      requestAnimationFrame(()=>{

        for(
          const selector
          of SELECTORS
        ){
          measureFit(
            document.querySelector(
              selector
            )
          );
        }

        fitHistory();
        fitPosition();
        fitActions();
      });
  }


  function boot(){

    document.body.classList.add(
      'mf-v18-autofit'
    );

    fitAll();

    /*
      Recalculate whenever viewport / cards change.
    */
    const ro =
      new ResizeObserver(
        fitAll
      );

    for(
      const selector
      of [
        ...SELECTORS,
        '.history-panel',
        '#v12ActionDock'
      ]
    ){
      const node =
        document.querySelector(
          selector
        );

      if(node){
        ro.observe(node);
      }
    }


    /*
      Market state changes content constantly:
      token name, holder count, buttons, history etc.
    */
    const mo =
      new MutationObserver(
        ()=>{
          requestAnimationFrame(
            fitAll
          );
        }
      );

    const cockpit =
      document.querySelector(
        '.cockpit'
      );

    if(cockpit){
      mo.observe(
        cockpit,
        {
          subtree:true,
          childList:true,
          characterData:true,
          attributes:true,
          attributeFilter:[
            'hidden',
            'disabled',
            'class',
            'data-state'
          ]
        }
      );
    }


    /*
      AUTO button may be injected after boot.
    */
    const bodyMO =
      new MutationObserver(()=>{
        fitActions();
        fitAll();
      });

    bodyMO.observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );


    window.addEventListener(
      'resize',
      fitAll,
      {passive:true}
    );

    window.addEventListener(
      'orientationchange',
      ()=>{
        setTimeout(
          fitAll,
          150
        );

        setTimeout(
          fitAll,
          450
        );
      },
      {passive:true}
    );

    /*
      iOS PWA viewport can settle after first paint.
    */
    setTimeout(fitAll,50);
    setTimeout(fitAll,250);
    setTimeout(fitAll,700);

    console.info(
      '[MEMEFLOW V18]',
      'REAL AUTO FIT ACTIVE'
    );
  }


  if(
    document.readyState ===
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

})();
