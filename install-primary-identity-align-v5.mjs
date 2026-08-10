import fs from 'node:fs';
import path from 'node:path';

const START='<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V5_START -->';
const END='<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V5_END -->';
const MARKERS=[
  ['<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_START -->','<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_END -->'],
  ['<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V2_START -->','<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V2_END -->'],
  ['<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V3_START -->','<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V3_END -->'],
  ['<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V4_START -->','<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V4_END -->'],
  [START,END]
];

function stripBlock(html,start,end){
  for(;;){
    const a=html.indexOf(start); if(a<0) return html;
    const b=html.indexOf(end,a+start.length); if(b<0) return html;
    html=html.slice(0,a)+html.slice(b+end.length);
  }
}

const PATCH=String.raw`${START}
<style id="mf-primary-identity-align-v5-style">
/* V5: AI SCORE is never moved/styled. Avatar follows visible score digits.
   #primaryMeta sits BELOW #primaryName with the SAME LEFT EDGE. */
#primary-candidate .mf-v5-identity{
  display:flex!important;
  align-items:flex-start!important;
  gap:10px!important;
  min-width:0!important;
  flex:1 1 auto!important;
  margin:0!important;
  padding:0!important;
}
#primary-candidate .mf-v5-avatar-box{
  box-sizing:border-box!important;
  width:var(--mf-v5-avatar-h)!important;
  height:var(--mf-v5-avatar-h)!important;
  min-width:var(--mf-v5-avatar-h)!important;
  min-height:var(--mf-v5-avatar-h)!important;
  max-width:var(--mf-v5-avatar-h)!important;
  max-height:var(--mf-v5-avatar-h)!important;
  flex:0 0 var(--mf-v5-avatar-h)!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  transform:translateY(var(--mf-v5-avatar-dy,0px))!important;
  background-size:cover!important;
  background-position:center!important;
}
#primary-candidate .mf-v5-avatar-box>img,
#primary-candidate img.mf-v5-avatar-image{
  display:block!important;
  width:100%!important;
  height:100%!important;
  min-width:100%!important;
  min-height:100%!important;
  max-width:none!important;
  max-height:none!important;
  object-fit:cover!important;
  margin:0!important;
  padding:0!important;
}
#primary-candidate .mf-v5-title-stack{
  display:flex!important;
  flex-direction:column!important;
  align-items:flex-start!important;
  justify-content:center!important;
  gap:3px!important;
  min-width:0!important;
  height:var(--mf-v5-score-line-h)!important;
  flex:1 1 auto!important;
  margin:0!important;
  padding:0!important;
  transform:translateY(var(--mf-v5-title-dy,0px))!important;
}
#primary-candidate .mf-v5-title-stack #primaryName{
  display:block!important;
  min-width:0!important;
  max-width:100%!important;
  margin:0!important;
  padding:0!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  line-height:1.05!important;
}
#primary-candidate .mf-v5-title-stack #primaryMeta{
  display:block!important;
  min-width:0!important;
  max-width:100%!important;
  margin:0!important;
  padding:0!important;
  font-size:9px!important;
  line-height:1!important;
  letter-spacing:.07em!important;
  text-transform:uppercase!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  color:var(--muted)!important;
}
#primary-candidate .mf-v5-old-empty{display:none!important}
@media(max-width:430px){
  #primary-candidate .mf-v5-identity{gap:9px!important}
  #primary-candidate .mf-v5-title-stack #primaryMeta{font-size:8px!important}
}
</style>
<script id="mf-primary-identity-align-v5-script">
(()=>{
'use strict';
if(window.__MF_PRIMARY_IDENTITY_ALIGN_V5__){try{window.__MF_PRIMARY_IDENTITY_ALIGN_V5__.run()}catch(_){ }return}
const state={runs:0,aligned:false,avatarType:null,lastError:null,glyphHeight:null};
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const visible=el=>{if(!el||!el.isConnected)return false;const c=getComputedStyle(el),r=el.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity||1)!==0&&r.width>0&&r.height>0};
const rect=el=>el.getBoundingClientRect();
function hasBg(el){if(!visible(el))return false;const b=getComputedStyle(el).backgroundImage||'';return b&&b!=='none'&&/url\(/i.test(b)}
function containsKey(el){return !!(el&&(el.id==='primaryName'||el.id==='primaryMeta'||el.id==='primaryScore'||el.querySelector?.('#primaryName,#primaryMeta,#primaryScore')))}
function visuals(card){const all=[...card.querySelectorAll('*')];return [...all.filter(e=>e.tagName==='IMG'&&visible(e)),...all.filter(e=>e.tagName!=='IMG'&&hasBg(e))]}
function chooseAvatar(card,head,name,score){
 const nr=rect(name),sr=rect(score),cr=rect(card);let best=null,bv=Infinity;
 for(const el of visuals(card)){
  const r=rect(el);if(r.width<20||r.height<20||r.width>190||r.height>190)continue;
  if(r.top<cr.top-4||r.bottom>cr.bottom+4)continue;
  if(el===score||el.contains?.(score)||score.contains?.(el)||containsKey(el))continue;
  const ratio=Math.max(r.width,r.height)/Math.max(1,Math.min(r.width,r.height));
  const v=(head.contains(el)?-250:0)+Math.abs((r.top+r.height/2)-(sr.top+sr.height/2))*2+Math.abs(r.right-nr.left)*.25+Math.max(0,ratio-1)*100+(r.left>nr.left?180:0);
  if(v<bv){best=el;bv=v}
 }
 return best;
}
function chooseBox(visual,card,name,meta,score){
 let box=visual,node=visual?.parentElement;
 for(let d=0;node&&node!==card&&d<3;d++,node=node.parentElement){
  if(node.contains(name)||node.contains(meta)||node.contains(score))break;
  const r=rect(node),ratio=Math.max(r.width,r.height)/Math.max(1,Math.min(r.width,r.height));
  if(r.width>=20&&r.height>=20&&r.width<=190&&r.height<=190&&ratio<=1.55&&node.children.length<=4)box=node;else break;
 }
 return box;
}
function glyphBox(score){
 const text=String(score.textContent||'').trim(); if(!/^\d{1,3}(?:\.\d+)?$/.test(text))return null;
 const cs=getComputedStyle(score),sr=rect(score),fs=parseFloat(cs.fontSize)||sr.height;
 const cv=document.createElement('canvas'),ctx=cv.getContext('2d');
 if(!ctx)return {top:sr.top,height:sr.height,bottom:sr.bottom,scoreRect:sr};
 ctx.font=(cs.fontStyle||'normal')+' '+(cs.fontWeight||'400')+' '+fs+'px '+(cs.fontFamily||'sans-serif');
 const m=ctx.measureText(text);let a=Number(m.actualBoundingBoxAscent)||fs*.76,d=Number(m.actualBoundingBoxDescent)||fs*.04;
 let fa=Number(m.fontBoundingBoxAscent)||fs*.8,fd=Number(m.fontBoundingBoxDescent)||fs*.2;
 let lh=parseFloat(cs.lineHeight);if(!Number.isFinite(lh))lh=sr.height;lh=Math.max(lh,sr.height);
 const baseline=sr.top+Math.max(0,lh-(fa+fd))/2+fa;
 let top=baseline-a,bottom=baseline+d,h=bottom-top;
 if(!Number.isFinite(h)||h<fs*.45||h>sr.height*1.05){h=Math.min(sr.height,fs*.82);top=sr.top+(sr.height-h)/2;bottom=top+h}
 top-=.5;bottom+=.5;h=bottom-top;
 return {top,bottom,height:h,scoreRect:sr};
}
function oldLeft(name,meta,head,scoreBlock){
 for(const start of [name,meta]){let n=start.parentElement;while(n&&n!==head){if(n.parentElement===head&&n!==scoreBlock)return n;n=n.parentElement}}
 return null;
}
function cleanup(card){
 const cls=['mf-primary-avatar-score-height-target','mf-primary-avatar-score-height-wrap','mf-primary-avatar-score-align-box','mf-primary-avatar-v2','mf-primary-identity-v2','mf-primary-title-line-v2','mf-primary-empty-old-v2','mf-v3-identity','mf-v3-avatar-box','mf-v3-avatar-image','mf-v3-title-line','mf-v3-old-empty','mf-v4-identity','mf-v4-avatar-box','mf-v4-avatar-image','mf-v4-title-line','mf-v4-old-empty','mf-v5-identity','mf-v5-avatar-box','mf-v5-avatar-image','mf-v5-title-stack','mf-v5-old-empty'];
 card.querySelectorAll('.'+cls.join(',.')).forEach(el=>{cls.forEach(c=>el.classList.remove(c));['--mf-primary-avatar-height','--mf-primary-avatar-offset','--mf-v3-score-h','--mf-v3-avatar-dy','--mf-v3-title-dy','--mf-v4-avatar-h','--mf-v4-avatar-dy','--mf-v4-score-line-h','--mf-v4-title-dy','--mf-v5-avatar-h','--mf-v5-avatar-dy','--mf-v5-score-line-h','--mf-v5-title-dy'].forEach(p=>el.style.removeProperty(p))});
}
function run(){
 state.runs++;
 try{
  const card=$('#primary-candidate'),score=$('#primaryScore',card||document),name=$('#primaryName',card||document),meta=$('#primaryMeta',card||document);
  if(!card||!score||!name||!meta||!visible(score))return false;
  const glyph=glyphBox(score);if(!glyph){card.dataset.mfPrimaryAlign='v5-waiting-numeric-score';return false}
  const head=name.closest('.token-head')||score.closest('.token-head');if(!head)return false;
  const scoreBlock=score.parentElement;if(!scoreBlock||!head.contains(scoreBlock))return false;
  const visual=chooseAvatar(card,head,name,score);if(!visual){card.dataset.mfPrimaryAlign='v5-waiting-avatar';return false}
  const avatarBox=chooseBox(visual,card,name,meta,score)||visual;
  const originalLeft=oldLeft(name,meta,head,scoreBlock);
  cleanup(card);
  let identity=$('.mf-v5-identity',head);if(!identity){identity=document.createElement('div');identity.className='mf-v5-identity';head.insertBefore(identity,scoreBlock)}
  let stack=$('.mf-v5-title-stack',identity);if(!stack){stack=document.createElement('div');stack.className='mf-v5-title-stack';identity.appendChild(stack)}
  if(avatarBox.parentElement!==identity)identity.insertBefore(avatarBox,stack);
  if(name.parentElement!==stack)stack.appendChild(name);
  if(meta.parentElement!==stack)stack.appendChild(meta);
  avatarBox.classList.add('mf-v5-avatar-box');if(visual.tagName==='IMG')visual.classList.add('mf-v5-avatar-image');
  if(originalLeft&&originalLeft!==identity&&originalLeft!==scoreBlock&&!originalLeft.contains(scoreBlock)){const txt=(originalLeft.textContent||'').trim(),live=originalLeft.querySelector('img,svg,button,a,input,[style*="background-image"]');if(!txt&&!live)originalLeft.classList.add('mf-v5-old-empty')}
  const avatarH=Math.max(38,Math.min(112,Math.round(glyph.height*10)/10));
  const lineH=Math.max(38,Math.min(130,Math.round(glyph.scoreRect.height*10)/10));
  identity.style.setProperty('--mf-v5-avatar-h',avatarH+'px');avatarBox.style.setProperty('--mf-v5-avatar-h',avatarH+'px');stack.style.setProperty('--mf-v5-score-line-h',lineH+'px');
  avatarBox.style.setProperty('--mf-v5-avatar-dy','0px');stack.style.setProperty('--mf-v5-title-dy','0px');
  requestAnimationFrame(()=>{
   if(!avatarBox.isConnected||!stack.isConnected||!score.isConnected)return;
   const g=glyphBox(score)||glyph,a=rect(avatarBox),t=rect(stack),s=rect(score);
   let ady=Math.max(-80,Math.min(80,Math.round((g.top-a.top)*10)/10));
   let tdy=Math.max(-80,Math.min(80,Math.round((s.top-t.top)*10)/10));
   avatarBox.style.setProperty('--mf-v5-avatar-dy',ady+'px');stack.style.setProperty('--mf-v5-title-dy',tdy+'px');
   state.aligned=true;state.avatarType=visual.tagName==='IMG'?'img':'background-image';state.glyphHeight=Math.round(g.height*10)/10;state.lastError=null;card.dataset.mfPrimaryAlign='v5-aligned';
  });
  return true;
 }catch(e){state.lastError=String(e?.message||e);return false}
}
let raf=0;const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(run)};
const start=()=>{new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});schedule();[80,180,350,700,1200,2200].forEach(ms=>setTimeout(schedule,ms));setInterval(run,1500);window.addEventListener('resize',schedule,{passive:true});document.addEventListener('memeflow:statechange',schedule);document.addEventListener('memeflow:candidatechange',schedule)};
window.__MF_PRIMARY_IDENTITY_ALIGN_V5__={run,state};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
</script>
${END}`;

const SKIP=new Set(['.git','node_modules','.cache','.next','dist','build','coverage','.old-replit-components']);
function walk(dir,out=[]){let es=[];try{es=fs.readdirSync(dir,{withFileTypes:true})}catch{return out}for(const e of es){if(SKIP.has(e.name))continue;if(/backup|before-|\.bak$/i.test(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else if(e.isFile()&&/\.html?$/i.test(e.name))out.push(p)}return out}
function files(){const explicit=process.argv.slice(2).filter(Boolean);if(explicit.length)return explicit.map(p=>path.resolve(p)).filter(p=>fs.existsSync(p));return walk(process.cwd()).filter(p=>{try{const s=fs.readFileSync(p,'utf8');return s.includes('id="primary-candidate"')&&s.includes('id="primaryScore"')&&s.includes('id="primaryName"')&&s.includes('id="primaryMeta"')}catch{return false}})}
const targets=files();if(!targets.length){console.error('ERROR: Primary Candidate HTML not found. Run from project root.');process.exit(1)}
let count=0;
for(const target of targets){
 let html=fs.readFileSync(target,'utf8');for(const [a,b] of MARKERS)html=stripBlock(html,a,b);
 const ids=['mf-primary-avatar-score-height-style','mf-primary-avatar-score-height-script','mf-primary-identity-align-v2-style','mf-primary-identity-align-v2-script','mf-primary-identity-align-v3-style','mf-primary-identity-align-v3-script','mf-primary-identity-align-v4-style','mf-primary-identity-align-v4-script','mf-primary-identity-align-v5-style','mf-primary-identity-align-v5-script'];
 for(const id of ids){html=html.replace(new RegExp('<style[^>]+id=["\\\']'+id+'["\\\'][^>]*>[\\s\\S]*?<\\/style>','gi'),'');html=html.replace(new RegExp('<script[^>]+id=["\\\']'+id+'["\\\'][^>]*>[\\s\\S]*?<\\/script>','gi'),'')}
 const at=html.lastIndexOf('</body>');if(at<0){console.warn('SKIP no </body>: '+target);continue}
 const backup=target+'.before-primary-identity-v5.bak';if(!fs.existsSync(backup))fs.copyFileSync(target,backup);
 html=html.slice(0,at)+'\n'+PATCH+'\n'+html.slice(at);fs.writeFileSync(target,html,'utf8');count++;console.log('PATCHED: '+path.relative(process.cwd(),target));
}
console.log('\nMEMEFLOW Primary Identity Align V5 installed.');
console.log('Patched HTML files: '+count);
console.log('Old V1/V2/V3/V4 identity patches removed.');
console.log('AI SCORE is not moved or styled.');
console.log('#primaryMeta is BELOW #primaryName with the same left edge.');
console.log('Avatar top/bottom follows visible AI Score digits.');
