import fs from 'node:fs';
import path from 'node:path';

const VERSION = 'MEMEFLOW_PRIMARY_IDENTITY_NATIVE_V11';
const STYLE_START = '<!-- MF_PRIMARY_IDENTITY_NATIVE_V11_STYLE_START -->';
const STYLE_END = '<!-- MF_PRIMARY_IDENTITY_NATIVE_V11_STYLE_END -->';
const RENDER_START = '/* MF_PRIMARY_IDENTITY_NATIVE_V11_RENDER_START */';
const RENDER_END = '/* MF_PRIMARY_IDENTITY_NATIVE_V11_RENDER_END */';

const NEW_HEAD = `<div class="token-head mf-primary-native-v11-head" data-mf-primary-layout="native-v11" style="display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:start!important;gap:14px!important;width:100%!important;min-width:0!important">
  <div id="primaryIdentity" class="mf-primary-native-v11-identity" style="display:grid!important;grid-template-columns:minmax(0,1fr);align-items:start!important;column-gap:12px!important;min-width:0!important;justify-self:start!important;margin:0!important;padding:0!important;position:static!important;transform:none!important">
    <div id="primaryAvatar" class="mf-primary-native-v11-avatar" hidden aria-hidden="true" style="display:grid;place-items:center;overflow:hidden;border-radius:16px;border:1px solid rgba(151,171,194,.28);background:#101720;box-sizing:border-box;margin:0;padding:0;position:relative;transform:none">
      <img id="primaryAvatarImage" alt="" hidden style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;margin:0;padding:0">
      <span id="primaryAvatarFallback" hidden style="position:absolute;inset:0;display:grid;place-items:center;line-height:1"></span>
    </div>
    <div class="mf-primary-native-v11-copy" style="display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;min-width:0!important;margin:0!important;padding:0!important">
      <div class="token-name" id="primaryName">—</div>
      <div class="score-caption" id="primaryMeta">No token selected</div>
    </div>
  </div>
  <div class="mf-primary-native-v11-score" style="justify-self:end!important;align-self:start!important;min-width:max-content!important;margin:0!important;padding:0!important;position:static!important;transform:none!important">
    <div class="big-score" id="primaryScore">—</div>
    <div class="score-caption">AI SCORE</div>
  </div>
</div>`;

const STYLE = `${STYLE_START}
<style id="mf-primary-identity-native-v11-style">
/* V11: layout only. The existing production-core render() owns all live values. */
#primary-candidate .mf-primary-native-v11-head #primaryName{
  display:block!important;
  margin:0!important;
  padding:0!important;
  min-width:0!important;
  max-width:100%!important;
  line-height:1.02!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  position:static!important;
  transform:none!important;
}
#primary-candidate .mf-primary-native-v11-head #primaryMeta{
  display:block!important;
  margin:7px 0 0!important;
  padding:0!important;
  min-width:0!important;
  max-width:100%!important;
  line-height:1!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  position:static!important;
  transform:none!important;
}
#primary-candidate .mf-primary-native-v11-avatar[hidden],
#primary-candidate .mf-primary-native-v11-avatar img[hidden],
#primary-candidate .mf-primary-native-v11-avatar span[hidden]{
  display:none!important;
}
#primary-candidate .mf-primary-native-v11-avatar img{
  width:100%!important;
  height:100%!important;
  object-fit:cover!important;
}
#primary-candidate .mf-primary-native-v11-avatar span{
  font-size:calc(var(--mf-primary-avatar-size,56px) * .58)!important;
}
@media(max-width:390px){
  #primary-candidate .mf-primary-native-v11-head{gap:10px!important}
  #primary-candidate .mf-primary-native-v11-identity{column-gap:10px!important}
}
</style>
${STYLE_END}`;

const RENDER_CODE = `${RENDER_START}
 {
  /* V11 is intentionally inside the authoritative production-core render().
     No second renderer, observer, interval, transform or candidatechange race. */
  const __mfIdentity=$('#primaryIdentity');
  const __mfAvatar=$('#primaryAvatar');
  const __mfAvatarImage=$('#primaryAvatarImage');
  const __mfAvatarFallback=$('#primaryAvatarFallback');
  const __mfScore=$('#primaryScore');

  if(__mfIdentity&&__mfAvatar&&__mfAvatarImage&&__mfAvatarFallback){
   if(!has){
    __mfAvatar.hidden=true;
    __mfAvatarImage.hidden=true;
    __mfAvatarFallback.hidden=true;
    __mfIdentity.style.gridTemplateColumns='minmax(0,1fr)';
   }else{
    /* Size only the avatar from the already-rendered score. Never move/style AI SCORE. */
    const __mfScoreRect=__mfScore?.getBoundingClientRect?.();
    const __mfScoreFont=__mfScore?parseFloat(getComputedStyle(__mfScore).fontSize)||0:0;
    let __mfAvatarSize=Math.round(Math.max(__mfScoreRect?.height||0,__mfScoreFont||0));
    __mfAvatarSize=Math.max(50,Math.min(78,__mfAvatarSize||56));

    __mfIdentity.style.setProperty('--mf-primary-avatar-size',__mfAvatarSize+'px');
    __mfIdentity.style.gridTemplateColumns=__mfAvatarSize+'px minmax(0,1fr)';
    __mfAvatar.style.width=__mfAvatarSize+'px';
    __mfAvatar.style.height=__mfAvatarSize+'px';
    __mfAvatar.style.minWidth=__mfAvatarSize+'px';
    __mfAvatar.style.minHeight=__mfAvatarSize+'px';
    __mfAvatar.hidden=false;

    const __mfRawImage=first(
      c.imageUrl,c.image,c.logoUrl,
      c.metadata?.image,c.metadata?.imageUrl,
      c.token?.imageUrl,c.token?.image,c.token?.logoUrl
    );
    const __mfFallbackText=String(first(
      c.emoji,c.icon,c.logoEmoji,
      String(c.name||c.symbol||'T').charAt(0),
      'T'
    ));
    __mfAvatarFallback.textContent=__mfFallbackText;

    let __mfImageUrl=String(__mfRawImage||'').trim();
    if(/^ipfs:\\/\\//i.test(__mfImageUrl))__mfImageUrl='https://ipfs.io/ipfs/'+__mfImageUrl.replace(/^ipfs:\\/\\//i,'');
    else if(/^ar:\\/\\//i.test(__mfImageUrl))__mfImageUrl='https://arweave.net/'+__mfImageUrl.replace(/^ar:\\/\\//i,'');
    if(!/^(https?:\\/\\/|data:image\\/|blob:)/i.test(__mfImageUrl))__mfImageUrl='';

    if(__mfImageUrl){
     __mfAvatarFallback.hidden=false;
     __mfAvatarImage.onload=()=>{__mfAvatarImage.hidden=false;__mfAvatarFallback.hidden=true};
     __mfAvatarImage.onerror=()=>{__mfAvatarImage.hidden=true;__mfAvatarFallback.hidden=false};
     if(__mfAvatarImage.dataset.mfSrc!==__mfImageUrl){
      __mfAvatarImage.dataset.mfSrc=__mfImageUrl;
      __mfAvatarImage.hidden=true;
      __mfAvatarImage.src=__mfImageUrl;
     }else if(__mfAvatarImage.complete&&__mfAvatarImage.naturalWidth>0){
      __mfAvatarImage.hidden=false;
      __mfAvatarFallback.hidden=true;
     }
    }else{
     __mfAvatarImage.hidden=true;
     __mfAvatarImage.removeAttribute('src');
     __mfAvatarImage.dataset.mfSrc='';
     __mfAvatarFallback.hidden=false;
    }
   }
  }
 }
${RENDER_END}`;

function stripRange(text,start,end){
  for(;;){
    const a=text.indexOf(start);
    if(a<0)break;
    const b=text.indexOf(end,a);
    if(b<0)break;
    text=text.slice(0,a)+text.slice(b+end.length);
  }
  return text;
}

function stripOldPatches(html){
  const pairs=[
    ['<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_START -->','<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_END -->'],
    ['<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_START -->','<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_END -->'],
    ['<!-- MF_PRIMARY_IDENTITY_STABLE_V7_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_STABLE_V7_STYLE_END -->'],
    ['<!-- MF_PRIMARY_IDENTITY_STABLE_V7_SCRIPT_START -->','<!-- MF_PRIMARY_IDENTITY_STABLE_V7_SCRIPT_END -->'],
    ['<!-- MF_PRIMARY_IDENTITY_STABLE_V8_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_STABLE_V8_STYLE_END -->'],
    ['<!-- MF_PRIMARY_IDENTITY_STABLE_V8_SCRIPT_START -->','<!-- MF_PRIMARY_IDENTITY_STABLE_V8_SCRIPT_END -->'],
    ['<!-- MF_PRIMARY_IDENTITY_STABLE_V9_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_STABLE_V9_STYLE_END -->'],
    ['<!-- MF_PRIMARY_IDENTITY_STABLE_V9_SCRIPT_START -->','<!-- MF_PRIMARY_IDENTITY_STABLE_V9_SCRIPT_END -->'],
    ['<!-- MF_PRIMARY_IDENTITY_STABLE_V10_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_STABLE_V10_STYLE_END -->'],
    ['<!-- MF_PRIMARY_IDENTITY_STABLE_V10_SCRIPT_START -->','<!-- MF_PRIMARY_IDENTITY_STABLE_V10_SCRIPT_END -->'],
    [STYLE_START,STYLE_END],
    [RENDER_START,RENDER_END]
  ];
  for(const [a,b] of pairs)html=stripRange(html,a,b);
  return html;
}

function replacePrimaryTokenHead(html){
  const nameIdx=html.indexOf('id="primaryName"');
  if(nameIdx<0)throw new Error('primaryName not found');
  const start=html.lastIndexOf('<div class="token-head',nameIdx);
  if(start<0)throw new Error('Primary .token-head not found');

  const tokenRe=/<div\b[^>]*>|<\/div\s*>/gi;
  tokenRe.lastIndex=start;
  let depth=0,end=-1,m;
  while((m=tokenRe.exec(html))){
    if(/^<div\b/i.test(m[0]))depth++;
    else depth--;
    if(depth===0){end=tokenRe.lastIndex;break}
  }
  if(end<0)throw new Error('Primary .token-head closing div not found');
  return html.slice(0,start)+NEW_HEAD+html.slice(end);
}

function injectIntoAuthoritativeRender(html){
  if(html.includes(RENDER_START))return html;

  const prod=html.indexOf('<script id="production-core-js">');
  if(prod<0)throw new Error('production-core-js not found');

  const metaStart=html.indexOf("set('#primaryMeta',",prod);
  if(metaStart<0)throw new Error("authoritative set('#primaryMeta'...) not found");

  const statementEnd=html.indexOf(';',metaStart);
  if(statementEnd<0)throw new Error('primaryMeta statement terminator not found');

  return html.slice(0,statementEnd+1)+'\n'+RENDER_CODE+'\n'+html.slice(statementEnd+1);
}

const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

if(!fs.existsSync(target)){
  console.error('ERROR: index.html not found:',target);
  process.exit(1);
}

let html=fs.readFileSync(target,'utf8');
if(!html.includes('id="primary-candidate"')){
  console.error('ERROR: Primary Candidate not found.');
  process.exit(1);
}

const backup=target+'.before-primary-identity-native-v11.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

try{
  html=stripOldPatches(html);
  html=replacePrimaryTokenHead(html);
  html=injectIntoAuthoritativeRender(html);

  const headClose=html.lastIndexOf('</head>');
  if(headClose<0)throw new Error('Missing </head>');
  html=html.slice(0,headClose)+'\\n'+STYLE+'\\n'+html.slice(headClose);

  fs.writeFileSync(target,html,'utf8');
}catch(e){
  console.error('ERROR:',e.message);
  process.exit(1);
}

console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Architecture: one authoritative production-core render() owns name, symbol, score and avatar.');
console.log('No V11 MutationObserver, setInterval, candidatechange listener or statechange listener.');
console.log('AI SCORE is not repositioned or restyled by V11.');
