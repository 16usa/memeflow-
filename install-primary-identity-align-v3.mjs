import fs from 'node:fs';
import path from 'node:path';

const V3_START = '<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V3_START -->';
const V3_END = '<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V3_END -->';
const OLD_MARKERS = [
  ['<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_START -->','<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_END -->'],
  ['<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V2_START -->','<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V2_END -->'],
  [V3_START,V3_END]
];

function stripBlock(html,start,end){
  for(;;){
    const a=html.indexOf(start); if(a<0) return html;
    const b=html.indexOf(end,a+start.length); if(b<0) return html;
    html=html.slice(0,a)+html.slice(b+end.length);
  }
}

const PATCH = String.raw`${V3_START}
<style id="mf-primary-identity-align-v3-style">
/*
 MEMEFLOW Primary Candidate Identity Align V3
 AI SCORE is a read-only geometric anchor. This patch NEVER styles or moves #primaryScore.
*/
#primary-candidate .mf-v3-identity {
  display:flex !important;
  align-items:flex-start !important;
  gap:10px !important;
  min-width:0 !important;
  flex:1 1 auto !important;
  margin:0 !important;
  padding:0 !important;
}
#primary-candidate .mf-v3-avatar-box {
  box-sizing:border-box !important;
  width:var(--mf-v3-score-h) !important;
  height:var(--mf-v3-score-h) !important;
  min-width:var(--mf-v3-score-h) !important;
  min-height:var(--mf-v3-score-h) !important;
  max-width:var(--mf-v3-score-h) !important;
  max-height:var(--mf-v3-score-h) !important;
  flex:0 0 var(--mf-v3-score-h) !important;
  margin:0 !important;
  padding:0 !important;
  overflow:hidden !important;
  transform:translateY(var(--mf-v3-avatar-dy,0px)) !important;
  background-size:cover !important;
  background-position:center !important;
}
#primary-candidate .mf-v3-avatar-box > img,
#primary-candidate img.mf-v3-avatar-image {
  display:block !important;
  width:100% !important;
  height:100% !important;
  min-width:100% !important;
  min-height:100% !important;
  max-width:none !important;
  max-height:none !important;
  object-fit:cover !important;
  margin:0 !important;
  padding:0 !important;
}
#primary-candidate .mf-v3-title-line {
  display:flex !important;
  align-items:baseline !important;
  gap:7px !important;
  min-width:0 !important;
  height:var(--mf-v3-score-h) !important;
  flex:1 1 auto !important;
  margin:0 !important;
  padding:0 !important;
  transform:translateY(var(--mf-v3-title-dy,0px)) !important;
  white-space:nowrap !important;
}
#primary-candidate .mf-v3-title-line #primaryName {
  flex:0 1 auto !important;
  min-width:0 !important;
  margin:0 !important;
  padding:0 !important;
  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  align-self:center !important;
}
#primary-candidate .mf-v3-title-line #primaryMeta {
  display:inline-block !important;
  flex:0 1 auto !important;
  min-width:0 !important;
  max-width:110px !important;
  margin:0 !important;
  padding:0 !important;
  font-size:9px !important;
  line-height:1 !important;
  letter-spacing:.07em !important;
  text-transform:uppercase !important;
  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  align-self:center !important;
  color:var(--muted) !important;
}
#primary-candidate .mf-v3-old-empty { display:none !important; }
@media(max-width:430px){
  #primary-candidate .mf-v3-identity{gap:9px !important}
  #primary-candidate .mf-v3-title-line{gap:6px !important}
  #primary-candidate .mf-v3-title-line #primaryMeta{max-width:82px !important;font-size:8px !important}
}
</style>
<script id="mf-primary-identity-align-v3-script">
(() => {
  'use strict';
  if (window.__MF_PRIMARY_IDENTITY_ALIGN_V3__) {
    try { window.__MF_PRIMARY_IDENTITY_ALIGN_V3__.run(); } catch (_) {}
    return;
  }

  const state = { runs:0, aligned:false, avatarType:null, lastError:null, scoreHeight:null, target:null };
  const $ = (s,r=document) => r?.querySelector?.(s) || null;
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const cs=getComputedStyle(el), r=el.getBoundingClientRect();
    return cs.display!=='none' && cs.visibility!=='hidden' && Number(cs.opacity||1)!==0 && r.width>0 && r.height>0;
  };
  const rect = el => el.getBoundingClientRect();
  const containsKey = el => !!(el && (el.querySelector?.('#primaryName,#primaryMeta,#primaryScore') || el.id==='primaryName' || el.id==='primaryMeta' || el.id==='primaryScore'));

  function hasBackgroundImage(el){
    if(!visible(el)) return false;
    const bg=getComputedStyle(el).backgroundImage || '';
    return bg && bg!=='none' && /url\(/i.test(bg);
  }

  function candidateScore(el, card, head, name, score){
    const r=rect(el), cr=rect(card), nr=rect(name), sr=rect(score);
    if(r.width<20 || r.height<20 || r.width>190 || r.height>190) return Infinity;
    if(r.top < cr.top-4 || r.bottom > cr.bottom+4) return Infinity;
    if(el===score || el.contains?.(score) || score.contains?.(el)) return Infinity;
    if(containsKey(el)) return Infinity;
    const ratio=Math.max(r.width,r.height)/Math.max(1,Math.min(r.width,r.height));
    const squarePenalty=Math.max(0,ratio-1.0)*100;
    const leftPenalty = r.left > nr.left ? 180 : 0;
    const headBonus = head.contains(el) ? -250 : 0;
    const vertical = Math.abs((r.top+r.height/2)-(sr.top+sr.height/2));
    const nameNear = Math.abs(r.right-nr.left);
    return headBonus + vertical*2 + nameNear*.25 + squarePenalty + leftPenalty;
  }

  function visualCandidates(card){
    const all=[...card.querySelectorAll('*')];
    const imgs=all.filter(el => el.tagName==='IMG' && visible(el));
    const bgs=all.filter(el => el.tagName!=='IMG' && hasBackgroundImage(el));
    return [...imgs,...bgs];
  }

  function chooseAvatar(card,head,name,score){
    let best=null,bestValue=Infinity;
    for(const el of visualCandidates(card)){
      const v=candidateScore(el,card,head,name,score);
      if(v<bestValue){best=el;bestValue=v;}
    }
    return best;
  }

  function chooseBox(visual,card,name,meta,score){
    if(!visual) return null;
    let box=visual;
    let node=visual.parentElement;
    for(let depth=0; node && node!==card && depth<3; depth++,node=node.parentElement){
      if(node.contains(name)||node.contains(meta)||node.contains(score)) break;
      const r=rect(node);
      const ratio=Math.max(r.width,r.height)/Math.max(1,Math.min(r.width,r.height));
      if(r.width>=20 && r.height>=20 && r.width<=190 && r.height<=190 && ratio<=1.55 && node.children.length<=4){
        box=node;
      } else break;
    }
    return box;
  }

  function clearOldClasses(card){
    card.querySelectorAll('.mf-primary-avatar-score-height-target,.mf-primary-avatar-score-height-wrap,.mf-primary-avatar-score-align-box,.mf-primary-avatar-v2,.mf-primary-identity-v2,.mf-primary-title-line-v2,.mf-primary-empty-old-v2').forEach(el=>{
      el.classList.remove('mf-primary-avatar-score-height-target','mf-primary-avatar-score-height-wrap','mf-primary-avatar-score-align-box','mf-primary-avatar-v2','mf-primary-identity-v2','mf-primary-title-line-v2','mf-primary-empty-old-v2');
      el.style.removeProperty('--mf-primary-avatar-height');
      el.style.removeProperty('--mf-primary-avatar-offset');
      el.style.removeProperty('--mf-primary-score-h');
      el.style.removeProperty('--mf-primary-avatar-y');
    });
  }

  function oldLeftContainer(name,meta,head,scoreBlock){
    let n=name.parentElement;
    while(n && n!==head){
      if(n.parentElement===head && n!==scoreBlock) return n;
      n=n.parentElement;
    }
    n=meta.parentElement;
    while(n && n!==head){
      if(n.parentElement===head && n!==scoreBlock) return n;
      n=n.parentElement;
    }
    return null;
  }

  function run(){
    state.runs++;
    try{
      const card=$('#primary-candidate');
      const score=$('#primaryScore',card||document);
      const name=$('#primaryName',card||document);
      const meta=$('#primaryMeta',card||document);
      if(!card||!score||!name||!meta||!visible(score)) return false;

      const head=name.closest('.token-head') || score.closest('.token-head');
      if(!head) return false;
      const scoreBlock=score.parentElement;
      if(!scoreBlock || !head.contains(scoreBlock)) return false;

      clearOldClasses(card);

      // IMPORTANT: discover avatar before moving name/meta. It may be an IMG or a CSS background-image box.
      const visual=chooseAvatar(card,head,name,score);
      if(!visual){
        state.aligned=false; state.avatarType='not-found'; state.target='waiting-for-runtime-avatar';
        card.dataset.mfPrimaryAlign='v3-waiting-avatar';
        return false;
      }
      const avatarBox=chooseBox(visual,card,name,meta,score) || visual;
      const originalLeft=oldLeftContainer(name,meta,head,scoreBlock);

      let identity=$('.mf-v3-identity',head);
      if(!identity){
        identity=document.createElement('div');
        identity.className='mf-v3-identity';
        head.insertBefore(identity,scoreBlock);
      }
      let titleLine=$('.mf-v3-title-line',identity);
      if(!titleLine){
        titleLine=document.createElement('div');
        titleLine.className='mf-v3-title-line';
        identity.appendChild(titleLine);
      }

      // Move the avatar BOX intact; preserve runtime image/background implementation.
      if(avatarBox.parentElement!==identity) identity.insertBefore(avatarBox,titleLine);
      if(name.parentElement!==titleLine) titleLine.appendChild(name);
      if(meta.parentElement!==titleLine) titleLine.appendChild(meta);

      avatarBox.classList.add('mf-v3-avatar-box');
      if(visual.tagName==='IMG') visual.classList.add('mf-v3-avatar-image');

      // Hide only the now-empty old left container. Score block is never touched.
      if(originalLeft && originalLeft!==identity && originalLeft!==scoreBlock && !originalLeft.contains(scoreBlock)){
        const txt=(originalLeft.textContent||'').trim();
        const live=originalLeft.querySelector('img,svg,button,a,input,[style*="background-image"]');
        if(!txt && !live) originalLeft.classList.add('mf-v3-old-empty');
      }

      const sr=rect(score);
      let h=Math.round(sr.height*10)/10;
      if(!Number.isFinite(h)||h<20) return false;
      h=Math.max(38,Math.min(130,h));
      identity.style.setProperty('--mf-v3-score-h',h+'px');
      avatarBox.style.setProperty('--mf-v3-score-h',h+'px');
      titleLine.style.setProperty('--mf-v3-score-h',h+'px');
      avatarBox.style.setProperty('--mf-v3-avatar-dy','0px');
      titleLine.style.setProperty('--mf-v3-title-dy','0px');

      requestAnimationFrame(()=>{
        if(!avatarBox.isConnected||!score.isConnected||!titleLine.isConnected) return;
        const s=rect(score), a=rect(avatarBox), t=rect(titleLine);
        let ady=Math.round((s.top-a.top)*10)/10;
        let tdy=Math.round((s.top-t.top)*10)/10;
        ady=Math.max(-80,Math.min(80,ady));
        tdy=Math.max(-80,Math.min(80,tdy));
        avatarBox.style.setProperty('--mf-v3-avatar-dy',ady+'px');
        titleLine.style.setProperty('--mf-v3-title-dy',tdy+'px');

        state.aligned=true;
        state.avatarType=visual.tagName==='IMG'?'img':'background-image';
        state.scoreHeight=Math.round(s.height*10)/10;
        state.target=visual.tagName.toLowerCase()+(visual.id?'#'+visual.id:'')+(visual.className&&typeof visual.className==='string'?'.'+visual.className.trim().split(/\s+/).join('.'):'');
        state.lastError=null;
        card.dataset.mfPrimaryAlign='v3-aligned';
      });
      return true;
    }catch(e){
      state.lastError=String(e?.message||e);
      return false;
    }
  }

  let raf=0;
  const schedule=()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(run); };
  const observer=new MutationObserver(schedule);
  const start=()=>{
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    schedule();
    [80,180,350,700,1200,2200].forEach(ms=>setTimeout(schedule,ms));
    // Runtime layers may inject/replace the token image well after the candidate text arrives.
    setInterval(run,1500);
    window.addEventListener('resize',schedule,{passive:true});
    document.addEventListener('memeflow:statechange',schedule);
    document.addEventListener('memeflow:candidatechange',schedule);
  };

  window.__MF_PRIMARY_IDENTITY_ALIGN_V3__={run,state};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
</script>
${V3_END}`;

const SKIP_DIRS = new Set(['.git','node_modules','.cache','.next','dist','build','coverage','.old-replit-components']);
function walk(dir,out=[]){
  let entries=[]; try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return out;}
  for(const ent of entries){
    if(SKIP_DIRS.has(ent.name)) continue;
    if(/backup|before-|\.bak$/i.test(ent.name)) continue;
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p,out);
    else if(ent.isFile() && /\.html?$/i.test(ent.name)) out.push(p);
  }
  return out;
}

function matchingFiles(){
  const explicit=process.argv.slice(2).filter(Boolean);
  if(explicit.length) return explicit.map(p=>path.resolve(p)).filter(p=>fs.existsSync(p));
  const root=process.cwd();
  return walk(root).filter(p=>{
    try{
      const st=fs.statSync(p); if(st.size>6*1024*1024) return false;
      const s=fs.readFileSync(p,'utf8');
      return s.includes('id="primary-candidate"') && s.includes('id="primaryScore"') && s.includes('id="primaryName"') && s.includes('id="primaryMeta"');
    }catch{return false;}
  });
}

const files=matchingFiles();
if(!files.length){
  console.error('ERROR: No HTML file containing #primary-candidate, #primaryScore, #primaryName and #primaryMeta was found.');
  console.error('Run from the Replit project root.');
  process.exit(1);
}

let patched=0;
for(const target of files){
  let html=fs.readFileSync(target,'utf8');
  for(const [s,e] of OLD_MARKERS) html=stripBlock(html,s,e);
  // Remove orphan style/script tags from older failed installs if their marker comments were lost.
  html=html.replace(/<style[^>]+id=["']mf-primary-avatar-score-height-style["'][^>]*>[\s\S]*?<\/style>/gi,'');
  html=html.replace(/<script[^>]+id=["']mf-primary-avatar-score-height-script["'][^>]*>[\s\S]*?<\/script>/gi,'');
  html=html.replace(/<style[^>]+id=["']mf-primary-identity-align-v2-style["'][^>]*>[\s\S]*?<\/style>/gi,'');
  html=html.replace(/<script[^>]+id=["']mf-primary-identity-align-v2-script["'][^>]*>[\s\S]*?<\/script>/gi,'');
  const bodyAt=html.lastIndexOf('</body>');
  if(bodyAt<0){console.warn('SKIP (no </body>): '+target);continue;}
  const backup=target+'.before-primary-identity-v3.bak';
  if(!fs.existsSync(backup)) fs.copyFileSync(target,backup);
  html=html.slice(0,bodyAt)+'\n'+PATCH+'\n'+html.slice(bodyAt);
  fs.writeFileSync(target,html,'utf8');
  patched++;
  console.log('PATCHED: '+path.relative(process.cwd(),target));
}

console.log('');
console.log('MEMEFLOW Primary Identity Align V3 installed.');
console.log('Patched HTML files: '+patched);
console.log('Old Primary avatar/V2 blocks removed from patched files.');
console.log('AI SCORE is never styled or moved by V3.');
console.log('V3 supports both <img> avatars and CSS background-image avatars.');
console.log('Restart Replit, then hard-refresh the browser.');
