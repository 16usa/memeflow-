import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PRIMARY_IDENTITY_RESTORE_ALIGN_V17';

const OLD_PAIRS=[
  ['/* MF_PRIMARY_IDENTITY_BASELINE_V16_RENDER_START */','/* MF_PRIMARY_IDENTITY_BASELINE_V16_RENDER_END */'],
  ['<!-- MF_PRIMARY_IDENTITY_BASELINE_V16_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_BASELINE_V16_STYLE_END -->'],
  ['/* MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_START */','/* MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_END */'],
  ['<!-- MF_PRIMARY_IDENTITY_LAYOUT_V15_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_LAYOUT_V15_STYLE_END -->'],
  ['/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_START */','/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_END */'],
  ['<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_END -->']
];

const RENDER_START='/* MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_RENDER_START */';
const RENDER_END='/* MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_RENDER_END */';
const STYLE_START='<!-- MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_STYLE_START -->';
const STYLE_END='<!-- MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_STYLE_END -->';

const RENDER=`${RENDER_START}
 {
  /* Restore the V15 composition:
     native logo | [big name / small symbol] | AI score.
     Only primaryMeta is vertically adjusted to the AI SCORE caption baseline. */
  const __mfName=$('#primaryName');
  const __mfMeta=$('#primaryMeta');
  const __mfScore=$('#primaryScore');
  const __mfHead=__mfName?.closest?.('.token-head')||null;

  const __mfClean=(value)=>{
    let s=String(value??'').trim();
    s=s.replace(/^[\\p{Extended_Pictographic}\\uFE0F\\u200D]+(?:[\\s._\\-|:•·]+)?/u,'').trim();
    return s;
  };
  const __mfEmojiOnly=(value)=>{
    const compact=String(value??'').trim().replace(/[\\s._\\-|:•·]/g,'');
    return !!compact && /^[\\p{Extended_Pictographic}\\uFE0F\\u200D]+$/u.test(compact);
  };

  if(__mfName){
    const __rawName=String(__mfName.textContent||'').trim();
    const __cleanName=__mfClean(__rawName);
    if(__cleanName)__mfName.textContent=__cleanName;
  }

  let __mfShowMeta=false;
  if(__mfMeta){
    const __rawMeta=String(__mfMeta.textContent||'').trim();
    const __cleanMeta=__mfClean(__rawMeta);
    __mfShowMeta=!!__cleanMeta &&
      !__mfEmojiOnly(__rawMeta) &&
      __cleanMeta.toLowerCase()!=='no token selected';

    __mfMeta.textContent=__cleanMeta;
    if(__mfShowMeta){
      __mfMeta.removeAttribute('hidden');
      __mfMeta.style.display='block';
    }else{
      __mfMeta.setAttribute('hidden','hidden');
      __mfMeta.style.display='none';
    }
  }

  if(__mfHead&&__mfName&&__mfScore){
    const __mfScoreBox=__mfScore.parentElement;
    const __mfLeft=__mfName.parentElement;

    /* Small symbol belongs to exactly the same text group as the big name. */
    if(__mfMeta&&__mfLeft&&__mfMeta.parentElement!==__mfLeft){
      __mfLeft.appendChild(__mfMeta);
    }

    if(__mfLeft)__mfLeft.classList.add('mf-primary-v17-left');
    if(__mfScoreBox)__mfScoreBox.classList.add('mf-primary-v17-score');
    __mfHead.classList.add('mf-primary-v17-head');

    const __mfScoreCaption=__mfScoreBox
      ? [...__mfScoreBox.children].find(el=>el!==__mfScore && /AI\\s*SCORE/i.test(String(el.textContent||'')))
        || [...__mfScoreBox.children].find(el=>el!==__mfScore)
        || null
      : null;

    const __mfAlignMeta=()=>{
      if(!__mfShowMeta||!__mfMeta||!__mfScoreCaption||!__mfName)return;

      /* Start from the normal V15 gap every render so there is no cumulative drift. */
      __mfMeta.style.marginTop='7px';

      const __metaRect=__mfMeta.getBoundingClientRect();
      const __captionRect=__mfScoreCaption.getBoundingClientRect();
      if(!__metaRect.height||!__captionRect.height)return;

      /* Align the bottom/baseline visually with the bottom of "AI SCORE".
         Move ONLY the small symbol. Logo, big name, score and caption stay fixed. */
      const __delta=Math.round(__captionRect.bottom-__metaRect.bottom);
      const __next=Math.max(7,Math.min(36,7+__delta));
      __mfMeta.style.marginTop=__next+'px';
    };

    if(typeof requestAnimationFrame==='function'){
      requestAnimationFrame(__mfAlignMeta);
    }else{
      setTimeout(__mfAlignMeta,0);
    }
  }
 }
${RENDER_END}`;

const STYLE=`${STYLE_START}
<style id="mf-primary-identity-restore-align-v17-style">
/* Restore the stable V15 layout. */
#primary-candidate .token-head.mf-primary-v17-head{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto!important;
  align-items:start!important;
  gap:14px!important;
  width:100%!important;
  min-width:0!important;
}

#primary-candidate .mf-primary-v17-left{
  display:grid!important;
  grid-template-columns:auto minmax(0,1fr)!important;
  grid-template-rows:auto auto!important;
  column-gap:12px!important;
  row-gap:0!important;
  align-items:start!important;
  justify-items:start!important;
  min-width:0!important;
  width:100%!important;
  max-width:100%!important;
  margin:0!important;
  padding:0!important;
  position:static!important;
  transform:none!important;
}

/* The native logo stays in column 1. Only these two text nodes are pinned to column 2. */
#primary-candidate .mf-primary-v17-left #primaryName{
  grid-column:2!important;
  grid-row:1!important;
  min-width:0!important;
  max-width:100%!important;
  width:100%!important;
  margin:0!important;
  padding:0!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  line-height:1.04!important;
  position:static!important;
  transform:none!important;
}

#primary-candidate .mf-primary-v17-left #primaryMeta{
  grid-column:2!important;
  grid-row:2!important;
  min-width:0!important;
  max-width:100%!important;
  margin:7px 0 0!important;
  padding:0!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  line-height:1!important;
  font-size:12px!important;
  position:static!important;
  transform:none!important;
}

#primary-candidate .mf-primary-v17-left #primaryMeta[hidden]{
  display:none!important;
}

#primary-candidate .mf-primary-v17-score{
  justify-self:end!important;
  align-self:start!important;
  min-width:max-content!important;
  margin:0!important;
  padding:0!important;
  position:static!important;
  transform:none!important;
}

@media(max-width:430px){
  #primary-candidate .token-head.mf-primary-v17-head{gap:10px!important}
  #primary-candidate .mf-primary-v17-left{column-gap:10px!important}
}
</style>
${STYLE_END}`;

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

const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

if(!fs.existsSync(target)){
  console.error('ERROR: index.html not found');
  process.exit(1);
}

let html=fs.readFileSync(target,'utf8');
if(!html.includes('id="primary-candidate"')){
  console.error('ERROR: Primary Candidate not found');
  process.exit(1);
}

const backup=target+'.before-primary-identity-restore-align-v17.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

for(const [a,b] of OLD_PAIRS)html=stripRange(html,a,b);
html=stripRange(html,RENDER_START,RENDER_END);
html=stripRange(html,STYLE_START,STYLE_END);

const prod=html.indexOf('<script id="production-core-js">');
if(prod<0){
  console.error('ERROR: production-core-js not found');
  process.exit(1);
}

const metaStart=html.indexOf("set('#primaryMeta',",prod);
if(metaStart<0){
  console.error("ERROR: authoritative primaryMeta render not found");
  process.exit(1);
}
const statementEnd=html.indexOf(';',metaStart);
if(statementEnd<0){
  console.error('ERROR: primaryMeta statement terminator not found');
  process.exit(1);
}

html=html.slice(0,statementEnd+1)+'\n'+RENDER+'\n'+html.slice(statementEnd+1);

const headClose=html.lastIndexOf('</head>');
if(headClose<0){
  console.error('ERROR: missing </head>');
  process.exit(1);
}
html=html.slice(0,headClose)+'\n'+STYLE+'\n'+html.slice(headClose);

fs.writeFileSync(target,html,'utf8');

console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Restored V15 composition.');
console.log('Only the small symbol/meta is moved vertically to match the AI SCORE caption bottom.');
console.log('Logo, big token name and AI SCORE are not moved.');
