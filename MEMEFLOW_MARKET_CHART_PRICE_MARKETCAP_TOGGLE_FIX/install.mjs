import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appDir = fs.existsSync(path.join(root, 'memeflow-app'))
  ? path.join(root, 'memeflow-app')
  : root;
const target = path.join(appDir, 'index.html');

if (!fs.existsSync(target)) {
  console.error(`INSTALL ABORTED: ${target} not found.`);
  process.exit(1);
}

const backup = `${target}.before-market-chart-complete-fix`;
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

let html = fs.readFileSync(target, 'utf8');

const oldSelect = ` function selectToken(detail={}){const next=detail.tokenAddress||detail.mint||'';document.getElementById('chartSymbol').textContent=detail.symbol||detail.name||document.getElementById('primaryName')?.textContent||'TOKEN';if(next===tokenAddress&&points.length)return;tokenAddress=next;points=[];load()}`;
const newSelect = ` function selectToken(detail={}){
  const next=String(detail.tokenAddress||detail.mint||'').trim();
  const symbol=detail.symbol||detail.name||'';

  if(!next){
    if(es){es.close();es=null}
    clearTimeout(reconnectTimer);
    tokenAddress='';
    points=[];
    events=[];

    const chartSymbol=document.getElementById('chartSymbol');
    if(chartSymbol)chartSymbol.textContent='—';

    pairMeta.textContent='Waiting for next candidate';
    empty.classList.remove('hidden');
    empty.innerHTML='<b>No active token</b><span>Waiting for the next live candidate.</span>';
    setStatus('stale','WAITING','No active candidate selected');
    render();
    window.dispatchEvent(new CustomEvent('memeflow:chartcleared'));
    return;
  }

  const chartSymbol=document.getElementById('chartSymbol');
  if(chartSymbol)chartSymbol.textContent=symbol||'TOKEN';

  if(next===tokenAddress&&points.length)return;

  tokenAddress=next;
  points=[];
  events=[];
  empty.classList.add('hidden');
  load();
}`;

if (html.includes(oldSelect)) {
  html = html.replace(oldSelect, newSelect);
} else if (!html.includes("window.dispatchEvent(new CustomEvent('memeflow:chartcleared'))")) {
  console.error('INSTALL ABORTED: native selectToken() signature not found.');
  process.exit(1);
}

const oldInitial = `setInterval(updateAge,1000);config().then(load);window.MEMEFLOW_CHART={setToken:selectToken,addTrade:e=>{events.push(e);render()},refresh:load,getState:()=>({chainId,tokenAddress,interval,points:[...points]})};`;
const newInitial = `setInterval(updateAge,1000);
 config().then(()=>{
  const selected=window.MEMEFLOW_CORE?.getSelected?.();
  const selectedMint=String(selected?.mint||selected?.tokenMint||selected?.tokenAddress||selected?.address||'').trim();
  if(selectedMint){
   selectToken({
    name:selected?.name,
    symbol:selected?.symbol||selected?.name,
    tokenAddress:selectedMint,
    mint:selectedMint
   });
  }else{
   selectToken({});
  }
 });
 window.MEMEFLOW_CHART={
  setToken:selectToken,
  clear:()=>selectToken({}),
  addTrade:e=>{events.push(e);render()},
  refresh:()=>tokenAddress?load():selectToken({}),
  getState:()=>({chainId,tokenAddress,interval,points:[...points]})
 };`;

if (html.includes(oldInitial)) {
  html = html.replace(oldInitial, newInitial);
}

const marker = 'MEMEFLOW_MARKET_CHART_COMPLETE_FIX';
if (!html.includes(marker)) {
  const css = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'chart-fix.css'), 'utf8');
  const js = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'chart-fix.js'), 'utf8');

  html = html.replace('</head>', `<style id="${marker}">\n${css}\n</style>\n</head>`);
  html = html.replace('</body>', `<script id="${marker}-JS">\n${js}\n</script>\n</body>`);
}

fs.writeFileSync(target, html, 'utf8');

console.log('Installed MEMEFLOW complete Market Chart fix.');
console.log(`Changed: ${target}`);
console.log(`Backup:  ${backup}`);
console.log('Includes hard reset, robust candle filtering, sane scaling and mobile rendering.');