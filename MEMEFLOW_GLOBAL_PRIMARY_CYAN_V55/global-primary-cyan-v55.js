(() => {
  'use strict';
  if (window.__MEMEFLOW_GLOBAL_PRIMARY_CYAN_V55__) return;
  window.__MEMEFLOW_GLOBAL_PRIMARY_CYAN_V55__ = true;

  const FALLBACK_CYAN = '#61DFFF';
  const MARK = 'mfV55Primary';
  const CLASS = 'mf-global-primary-cyan-v55';
  const STYLE_ID = 'mf-global-primary-cyan-v55-style';

  function norm(s){
    return String(s || '').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function labelOf(el){
    return norm(
      el?.getAttribute?.('aria-label') ||
      el?.value ||
      el?.textContent ||
      ''
    );
  }

  function isDisabled(el){
    return !!(
      el?.disabled === true ||
      el?.matches?.(':disabled') ||
      el?.getAttribute?.('aria-disabled') === 'true'
    );
  }

  function excluded(el){
    if (!el || isDisabled(el)) return true;

    const label = labelOf(el);
    const cls = norm(el.className);

    if (!label) return true;

    if (el.closest?.(
      '.mobile-nav,.bottom-nav,.sidebar,nav,[role="navigation"],' +
      '.tabs,[role="tablist"],.segmented,.chips,.chip-group'
    )) return true;

    if (
      /\b(disconnect|delete|remove|danger|destructive|logout|sign out|cancel|close)\b/.test(label) ||
      /\b(danger|destructive|disconnect|delete|remove|cancel|close)\b/.test(cls)
    ) return true;

    if (
      /\b(chip|badge|pill|status|toggle|switch|tab|filter)\b/.test(cls) ||
      el?.getAttribute?.('role') === 'tab'
    ) return true;

    return false;
  }

  function parseRgb(color){
    if (!color || color === 'transparent') return null;
    const m = String(color).match(
      /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i
    );
    if (!m) return null;
    return {
      r:Number(m[1]),
      g:Number(m[2]),
      b:Number(m[3]),
      a:m[4] == null ? 1 : Number(m[4])
    };
  }

  function luminance({r,g,b}){
    const conv = v => {
      v /= 255;
      return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055,2.4);
    };
    return .2126*conv(r)+.7152*conv(g)+.0722*conv(b);
  }

  function isLightFill(el){
    const cs = getComputedStyle(el);
    const bg = parseRgb(cs.backgroundColor);
    if (!bg || bg.a < .45) return false;
    return (
      bg.r >= 190 &&
      bg.g >= 190 &&
      bg.b >= 190 &&
      luminance(bg) >= .55
    );
  }

  function isKnownPrimaryLabel(el){
    const label = labelOf(el);
    return /^(connect wallet|analyze|analyze token|upgrade to pro|save settings|continue|confirm|submit|start|start trading|buy|verify ownership)$/i.test(label);
  }

  function discoverCyan(){
    /* Prefer the actual MEMEFLOW OpenAI Analyze/Ask button color if that sheet exists.
       This makes V55 track the real OpenAI primary color instead of relying only on a hard-coded hex. */
    const roots = [...document.querySelectorAll('#sheet-ai,.mobile-sheet,[class*="sheet"],[class*="modal"]')];
    for (const root of roots){
      const rt = norm(root.textContent);
      if (!rt.includes('memeflow openai')) continue;

      const buttons = [...root.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]')];
      const source = buttons.find(b => /^(analyze|ask)$/i.test(labelOf(b)));
      if (!source) continue;

      const cs = getComputedStyle(source);
      const bg = parseRgb(cs.backgroundColor);
      if (bg && bg.a > .5 && bg.b > 180 && bg.g > 150) {
        return `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`;
      }
    }
    return FALLBACK_CYAN;
  }

  let CYAN = FALLBACK_CYAN;

  function installStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${CLASS}{
        color:#061018!important;
        text-shadow:none!important;
        box-shadow:none!important;
      }
      .${CLASS}:focus-visible{
        outline:2px solid rgba(97,223,255,.42)!important;
        outline-offset:2px!important;
      }
    `;
    document.head.appendChild(style);
  }

  function storeOriginal(el){
    if (el.dataset.mfV55Stored === '1') return;
    el.dataset.mfV55Stored = '1';
    el.dataset.mfV55Bg = el.style.getPropertyValue('background') || '';
    el.dataset.mfV55BgPriority = el.style.getPropertyPriority('background') || '';
    el.dataset.mfV55Bgc = el.style.getPropertyValue('background-color') || '';
    el.dataset.mfV55BgcPriority = el.style.getPropertyPriority('background-color') || '';
    el.dataset.mfV55Border = el.style.getPropertyValue('border-color') || '';
    el.dataset.mfV55BorderPriority = el.style.getPropertyPriority('border-color') || '';
    el.dataset.mfV55Color = el.style.getPropertyValue('color') || '';
    el.dataset.mfV55ColorPriority = el.style.getPropertyPriority('color') || '';
  }

  function restoreProp(el, prop, valueKey, priorityKey){
    const value = el.dataset[valueKey] || '';
    const priority = el.dataset[priorityKey] || '';
    if (value) el.style.setProperty(prop,value,priority);
    else el.style.removeProperty(prop);
  }

  function restore(el){
    if (el.dataset.mfV55Stored !== '1') return;
    restoreProp(el,'background','mfV55Bg','mfV55BgPriority');
    restoreProp(el,'background-color','mfV55Bgc','mfV55BgcPriority');
    restoreProp(el,'border-color','mfV55Border','mfV55BorderPriority');
    restoreProp(el,'color','mfV55Color','mfV55ColorPriority');
    el.classList.remove(CLASS);
    delete el.dataset[MARK];
  }

  function paint(el){
    storeOriginal(el);
    el.dataset[MARK] = '1';
    el.classList.add(CLASS);

    /*
      Core V55 fix:
      use INLINE !important properties.
      This outranks the existing high-specificity button rules that beat V54's single CSS class.
    */
    el.style.setProperty('background', CYAN, 'important');
    el.style.setProperty('background-color', CYAN, 'important');
    el.style.setProperty('border-color', CYAN, 'important');
    el.style.setProperty('color', '#061018', 'important');
  }

  function buttonCandidates(root=document){
    return root.querySelectorAll?.(
      'button,a.button,a.btn,[role="button"],input[type="button"],input[type="submit"]'
    ) || [];
  }

  function shouldBecomePrimary(el){
    if (excluded(el)) return false;

    /* If V55 already claimed it, keep it claimed unless it becomes disabled/excluded. */
    if (el.dataset[MARK] === '1') return true;

    return isLightFill(el) || isKnownPrimaryLabel(el);
  }

  function apply(root=document){
    installStyle();

    /* Refresh the source color if OpenAI is available; fallback remains identical. */
    const next = discoverCyan();
    if (next) CYAN = next;

    for (const el of buttonCandidates(root)){
      if (shouldBecomePrimary(el)) paint(el);
      else if (el.dataset[MARK] === '1') restore(el);
    }
  }

  function boot(){
    apply();

    let queued=false;
    const schedule=()=>{
      if (queued) return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        apply();
      });
    };

    const mo=new MutationObserver(schedule);
    mo.observe(document.documentElement,{
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','disabled','aria-disabled']
    });

    window.addEventListener('pageshow',schedule,{passive:true});
    window.addEventListener('resize',schedule,{passive:true});
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  } else {
    boot();
  }
})();