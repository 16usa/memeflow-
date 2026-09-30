from pathlib import Path

CANDIDATES = [
    Path('memeflow-app/trading.js'),
    Path('trading.js'),
    Path('app/trading.js'),
    Path('src/trading.js'),
]

MARKER = 'MEMEFLOW_HIDE_CHART_INDICATOR_ROW_V1'

trading = None
for path in CANDIDATES:
    if path.exists():
        trading = path
        break

if trading is None:
    raise SystemExit('ERROR: trading.js not found in expected locations')

text = trading.read_text()
if MARKER in text:
    print(f'Patch already present in {trading}')
    raise SystemExit(0)

snippet = r'''

/* MEMEFLOW_HIDE_CHART_INDICATOR_ROW_V1 */
(function(){
  const MF_INDICATOR_LABELS = [
    'MA','EMA','BOLL','SAR','VOL','MACD','KDJ','RSI','STOCHRSI','TRIX','OBV','WR'
  ];

  function mfNorm(v){
    return String(v || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function mfIndicatorHitCount(text){
    const t = mfNorm(text);
    let hits = 0;
    for(const label of MF_INDICATOR_LABELS){
      if(t.includes(label)) hits += 1;
    }
    return hits;
  }

  function mfShouldHideRow(el){
    if(!el || !el.innerText) return false;
    if(el.querySelector && el.querySelector('canvas, svg')) return false;
    const text = mfNorm(el.innerText);
    if(!text) return false;
    const hits = mfIndicatorHitCount(text);
    if(hits < 6) return false;
    const len = text.length;
    if(len > 180) return false;
    return true;
  }

  function mfHideRow(el){
    if(!el || el.dataset.mfIndicatorsHidden === '1') return;
    el.dataset.mfIndicatorsHidden = '1';
    el.style.display = 'none';
    el.style.height = '0';
    el.style.minHeight = '0';
    el.style.margin = '0';
    el.style.padding = '0';
    el.style.border = '0';
    el.style.overflow = 'hidden';
  }

  function mfScan(root){
    const scope = root && root.querySelectorAll ? root : document;
    const nodes = scope.querySelectorAll('div, section, nav, ul, ol');
    for(const el of nodes){
      if(mfShouldHideRow(el)) mfHideRow(el);
    }
  }

  function mfRun(){
    try{ mfScan(document); }catch(_err){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', mfRun, { once:true });
  }else{
    mfRun();
  }

  try{
    const observer = new MutationObserver(() => mfRun());
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }catch(_err){}

  setInterval(mfRun, 1200);
})();
'''

trading.write_text(text + snippet)
print(f'Patched {trading}')
