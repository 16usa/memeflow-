(() => {
  'use strict';
  const VERSION='MEMEFLOW_FINAL_MARKET_CHART_V1';
  if(window[VERSION]) return;
  window[VERSION]=true;
  const INTERVALS={'1s':1000,'1m':60000,'5m':300000,'15m':900000,'1h':3600000,all:0};
  const PREFIX='mf_final_ohlc_v1:';
  const state={interval:'1s',tokenKey:'',samples:[],lastPrice:null,lastSampleAt:0,timer:null,raf:0};

  const text=(sels,f='—')=>{for(const s of sels){const v=document.querySelector(s)?.textContent?.trim();if(v&&v!=='—')return v}return f};
  const parsePrice=raw=>{const m=String(raw||'').replace(/,/g,'').replace(/\$/g,'').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);const v=m?Number(m[0]):NaN;return Number.isFinite(v)&&v>0?v:null};
  const formatPrice=v=>!Number.isFinite(v)?'—':v>=1e6?'$'+(v/1e6).toFixed(2)+'M':v>=1e3?'$'+(v/1e3).toFixed(2)+'K':v>=1?'$'+v.toFixed(4):v>=.001?'$'+v.toFixed(6):'$'+v.toExponential(5);
  const tokenName=()=>text(['#decisionName','#chartSymbol','.token-name'],'Token');
  const tokenMeta=()=>text(['#decisionMeta','#chartPairMeta'],'Solana bonding curve');
  const tokenKey=()=>text(['[data-token-address-text]','.token-address','#decisionMeta','#chartSymbol'],tokenName()).replace(/\s+/g,'_').slice(0,140);
  const currentPrice=()=>parsePrice(text(['#chartCurrentPrice'],''));
  const selectedCandidate=()=>window.MEMEFLOW_CORE?.getSelected?.()||window.currentCandidate||window.selectedCandidate||null;

  const isImageUrl=value=>{
    if(typeof value!=='string') return false;
    const v=value.trim();
    return /^(https?:)?\/\//i.test(v) || /^data:image\//i.test(v) || /^blob:/i.test(v) || /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(v);
  };

  const deepImageUrl=(value,depth=0,seen=new Set())=>{
    if(depth>5||value==null) return '';
    if(isImageUrl(value)) return String(value).trim();
    if(typeof value!=='object'||seen.has(value)) return '';
    seen.add(value);

    const priorityKeys=[
      'image','imageUrl','imageURL','image_url','imageUri','imageURI','image_uri',
      'logo','logoUrl','logoURL','logo_url','logoUri','logoURI','logo_uri',
      'icon','iconUrl','iconURL','icon_url','iconUri','iconURI','icon_uri',
      'thumbnail','thumbnailUrl','avatar','avatarUrl','uri','metadataUri','metadata_uri'
    ];

    for(const key of priorityKeys){
      if(Object.prototype.hasOwnProperty.call(value,key)){
        const found=deepImageUrl(value[key],depth+1,seen);
        if(found) return found;
      }
    }

    for(const [key,item] of Object.entries(value)){
      if(/image|logo|icon|avatar|thumb|metadata/i.test(key)){
        const found=deepImageUrl(item,depth+1,seen);
        if(found) return found;
      }
    }
    return '';
  };

  const cssImageUrl=el=>{
    if(!el) return '';
    for(const attr of ['data-image','data-image-url','data-logo','data-logo-url','data-icon','data-icon-url']){
      const value=el.getAttribute?.(attr);
      if(isImageUrl(value)) return value.trim();
    }
    const bg=getComputedStyle(el).backgroundImage||'';
    const match=bg.match(/url\(["']?(.*?)["']?\)/i);
    return match&&isImageUrl(match[1])?match[1].trim():'';
  };

  const tokenImage=()=>{
    const candidate=selectedCandidate();
    const direct=deepImageUrl(candidate);
    if(direct) return direct;

    const activeCard=document.querySelector('.candidate.active,.primary-card,[data-selected="true"],[aria-selected="true"]');
    const activeObject=activeCard&&(
      activeCard.__data||activeCard._data||activeCard.candidate||activeCard.token||
      activeCard.dataset?.candidate&&(()=>{try{return JSON.parse(activeCard.dataset.candidate)}catch{return null}})()
    );
    const activeFound=deepImageUrl(activeObject);
    if(activeFound) return activeFound;

    for(const s of [
      '#decision-studio img[src]','.primary-card img[src]','.candidate.active img[src]',
      '[data-selected="true"] img[src]','[aria-selected="true"] img[src]',
      '.token-logo img[src]','.token-avatar img[src]','[data-token-image] img[src]',
      'img[data-token-logo][src]','[data-image-url] img[src]'
    ]){
      const img=document.querySelector(s);
      if(img?.currentSrc&&isImageUrl(img.currentSrc)) return img.currentSrc;
      if(img?.src&&isImageUrl(img.src)&&!img.src.startsWith('data:image/svg+xml')) return img.src;
    }

    for(const s of [
      '.candidate.active .token-logo','.candidate.active .token-avatar',
      '.primary-card .token-logo','.primary-card .token-avatar',
      '[data-selected="true"] [data-token-image]','[aria-selected="true"] [data-token-image]'
    ]){
      const found=cssImageUrl(document.querySelector(s));
      if(found) return found;
    }
    return '';
  };
  const load=k=>{try{const x=JSON.parse(localStorage.getItem(PREFIX+k)||'[]');return Array.isArray(x)?x.filter(a=>Number.isFinite(a?.t)&&Number.isFinite(a?.p)):[]}catch{return[]}};
  const save=()=>{try{localStorage.setItem(PREFIX+state.tokenKey,JSON.stringify(state.samples.slice(-12000)))}catch{}};

  function aggregate(step){
    if(!state.samples.length)return[];
    if(!step){const r=state.samples.at(-1).t-state.samples[0].t;step=Math.max(1000,Math.ceil(Math.max(r,1)/70))}
    const b=new Map();
    for(const s of state.samples){const k=Math.floor(s.t/step)*step;const c=b.get(k);if(!c)b.set(k,{t:k,open:s.p,high:s.p,low:s.p,close:s.p});else{c.high=Math.max(c.high,s.p);c.low=Math.min(c.low,s.p);c.close=s.p}}
    return [...b.values()].sort((a,b)=>a.t-b.t).slice(-600);
  }

  function compactCandles(candles,maxVisible){
    if(candles.length<=maxVisible) return candles;
    const groupSize=Math.ceil(candles.length/maxVisible);
    const compact=[];
    for(let i=0;i<candles.length;i+=groupSize){
      const group=candles.slice(i,i+groupSize);
      compact.push({
        t:group[0].t,
        open:group[0].open,
        high:Math.max(...group.map(c=>c.high)),
        low:Math.min(...group.map(c=>c.low)),
        close:group.at(-1).close
      });
    }
    return compact;
  }

  function mount(){
    const mod=document.getElementById('market-chart-module'); if(!mod)return null;
    const body=mod.querySelector('.market-chart-module-body')||mod.querySelector('.panel-body')||mod;
    let host=body.querySelector('#mf-final-chart-host');
    if(!host){host=document.createElement('div');host.id='mf-final-chart-host';
      [...body.children].forEach(c=>{c.style.setProperty('display','none','important');c.setAttribute('aria-hidden','true')});body.appendChild(host)}
    if(host.dataset.mfFinalChartMounted==='1')return host;host.dataset.mfFinalChartMounted='1';const root=host;root.innerHTML=`
<section class="card"><div class="token"><div class="avatar"></div><div class="copy"><h3 class="name">Token</h3><div class="meta">Solana</div></div><div class="quote"><b class="price">—</b><span class="change">LIVE</span></div></div>
<div class="toolbar"><div class="label"><small>MARKET CHART</small><b>Token</b></div><span class="source">Fresh Solana price stream</span><div class="intervals">${Object.keys(INTERVALS).map((k,i)=>`<button type="button" data-interval="${k}" class="${i?'':'active'}">${k==='all'?'All':k}</button>`).join('')}</div></div>
<div class="stage"><canvas></canvas><span class="badge">LIVE</span><span class="last">—</span><span class="age">—</span><div class="empty"><div><b>Waiting for verified price history</b><span>The first candle appears after a valid live price is received.</span></div></div></div>
<div class="footer"><span class="live"><i class="dot"></i><b>LIVE DATA</b></span><span class="pair">Token · Solana</span><span class="count">0 candles</span></div></section>`;
    root.querySelectorAll('[data-interval]').forEach(b=>b.addEventListener('click',()=>{state.interval=b.dataset.interval;root.querySelectorAll('[data-interval]').forEach(x=>x.classList.toggle('active',x===b));schedule(host)}));
    return host;
  }

  function switchToken(){const k=tokenKey();if(k===state.tokenKey)return;state.tokenKey=k;state.samples=load(k).slice(-12000);state.lastSampleAt=state.samples.at(-1)?.t||0;state.lastPrice=state.samples.at(-1)?.p||null}
  function sample(){switchToken();const p=currentPrice();if(!p)return;const n=Date.now();if(n-state.lastSampleAt<900&&p===state.lastPrice)return;state.samples.push({t:n,p});if(state.samples.length>12000)state.samples=state.samples.slice(-12000);state.lastSampleAt=n;state.lastPrice=p;save()}
  function header(host){const r=host,n=tokenName(),m=tokenMeta(),p=currentPrice();r.querySelector('.name').textContent=n;r.querySelector('.label b').textContent=n;r.querySelector('.meta').textContent=m;r.querySelector('.pair').textContent=n+' · Solana';r.querySelector('.price').textContent=formatPrice(p);r.querySelector('.last').textContent=formatPrice(p);
    const a=r.querySelector('.avatar'),initials=n.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'MF',imgurl=tokenImage();a.replaceChildren();if(imgurl){const i=document.createElement('img');i.referrerPolicy='no-referrer';i.loading='eager';i.decoding='async';i.alt=n;
      const sources=[imgurl];
      if(/^ipfs:\/\//i.test(imgurl)) sources.push('https://ipfs.io/ipfs/'+imgurl.replace(/^ipfs:\/\//i,''));
      let sourceIndex=0;
      i.onerror=()=>{sourceIndex+=1;if(sourceIndex<sources.length){i.src=sources[sourceIndex]}else{a.replaceChildren();a.textContent=initials}};
      i.src=sources[0];a.appendChild(i)}else a.textContent=initials;
    const c=r.querySelector('.change');if(state.samples.length>=2){const ch=((state.samples.at(-1).p-state.samples[0].p)/state.samples[0].p)*100;c.textContent=(ch>=0?'↑ ':'↓ ')+Math.abs(ch).toFixed(2)+'%';c.classList.toggle('down',ch<0)}else{c.textContent='LIVE';c.classList.remove('down')}}
  function schedule(h){cancelAnimationFrame(state.raf);state.raf=requestAnimationFrame(()=>draw(h))}
  function draw(host){const r=host,stage=r.querySelector('.stage'),canvas=r.querySelector('canvas'),rect=stage.getBoundingClientRect();if(!rect.width||!rect.height)return;const d=Math.max(1,Math.min(2,devicePixelRatio||1));canvas.width=Math.round(rect.width*d);canvas.height=Math.round(rect.height*d);const ctx=canvas.getContext('2d');ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,rect.width,rect.height);
    const rawCandles=aggregate(INTERVALS[state.interval]);const maxVisible=rect.width<=560?42:72;const candles=compactCandles(rawCandles,maxVisible);r.querySelector('.count').textContent=rawCandles.length+(rawCandles.length===1?' candle':' candles');r.querySelector('.empty').style.display=candles.length?'none':'grid';if(!candles.length)return;
    const l=14,t=16,rr=rect.width-86,b=rect.height-30,w=rr-l,h=b-t;ctx.strokeStyle='rgba(145,162,181,.11)';ctx.lineWidth=1;for(let i=0;i<=5;i++){const y=t+h*i/5;ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(rr,y);ctx.stroke()}for(let i=0;i<=6;i++){const x=l+w*i/6;ctx.beginPath();ctx.moveTo(x,t);ctx.lineTo(x,b);ctx.stroke()}
    let min=Math.min(...candles.map(c=>c.low)),max=Math.max(...candles.map(c=>c.high));if(min===max){
      const pad=Math.max(min*.015,1e-15);
      min=Math.max(min-pad,min*.001,1e-15);
      max+=pad;
    }else{
      const range=max-min;
      const pad=range*.08;
      const floor=Math.max(Math.min(...candles.map(c=>c.low))*.15,1e-15);
      min=Math.max(min-pad,floor);
      max+=pad;
    }const step=w/Math.max(candles.length,1),bw=Math.max(4,Math.min(12,step*.58)),yf=p=>t+((max-p)/(max-min))*h;const chartTextStyle=getComputedStyle(host),axisSize=chartTextStyle.getPropertyValue('--mf-size-11').trim()||'11px',axisColor=chartTextStyle.getPropertyValue('--mf-neutral-text-3').trim()||'#a3a3a3';ctx.font=axisSize+' '+chartTextStyle.fontFamily;ctx.fillStyle=axisColor;ctx.textBaseline='middle';for(let i=0;i<5;i++){const q=i/4,p=max-(max-min)*q;ctx.fillText(formatPrice(p).replace('$',''),rr+8,t+h*q)}
    candles.forEach((c,i)=>{const x=l+step*i+step/2,oy=yf(c.open),cy=yf(c.close),hy=yf(c.high),ly=yf(c.low),up=c.close>=c.open,col=up?'#51e7a8':'#ff6576';ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=1.25;ctx.beginPath();ctx.moveTo(x,hy);ctx.lineTo(x,ly);ctx.stroke();ctx.fillRect(x-bw/2,Math.min(oy,cy),bw,Math.max(2,Math.abs(cy-oy)))});
    const last=candles.at(-1),ly=yf(last.close);ctx.save();ctx.strokeStyle='rgba(81,231,168,.72)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(l,ly);ctx.lineTo(rr,ly);ctx.stroke();ctx.restore();r.querySelector('.last').textContent=formatPrice(last.close);r.querySelector('.age').textContent=Math.max(0,Math.floor((Date.now()-state.samples.at(-1).t)/1000))+' sec ago'}
  function tick(){const h=mount();if(!h)return;switchToken();sample();header(h);schedule(h)}
  function boot(){const h=mount();if(!h)return;tick();state.timer=setInterval(tick,1000);addEventListener('resize',()=>schedule(h),{passive:true});addEventListener('pagehide',()=>clearInterval(state.timer),{once:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();