import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PRIMARY_IDENTITY_BASELINE_V16';

const STRIP_MARKERS=[
 ['/* MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_START */','/* MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_END */'],
 ['<!-- MF_PRIMARY_IDENTITY_LAYOUT_V15_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_LAYOUT_V15_STYLE_END -->'],
 ['/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_START */','/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_END */'],
 ['<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_END -->']
];

const V16_RENDER_START='/* MF_PRIMARY_IDENTITY_BASELINE_V16_RENDER_START */';
const V16_RENDER_END='/* MF_PRIMARY_IDENTITY_BASELINE_V16_RENDER_END */';
const V16_STYLE_START='<!-- MF_PRIMARY_IDENTITY_BASELINE_V16_STYLE_START -->';
const V16_STYLE_END='<!-- MF_PRIMARY_IDENTITY_BASELINE_V16_STYLE_END -->';

const V16_RENDER=`${V16_RENDER_START}
 {
  /* V16: keep native logo and big name; place small symbol under big name and
     align its baseline to the AI SCORE caption baseline. */
  const __mfName=$('#primaryName');
  const __mfMeta=$('#primaryMeta');
  const __mfScore=$('#primaryScore');

  const __mfClean=(value)=>{
    let s=String(value??'').trim();
    s=s.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+(?:[\s._\-|:•·]+)?/u,'').trim();
    return s;
  };
  const __mfEmojiOnly=(value)=>{
    const compact=String(value??'').trim().replace(/[\s._\-|:•·]/g,'');
    return !!compact && /^[\p{Extended_Pictographic}\uFE0F\u200D]+$/u.test(compact);
  };

  if(__mfName){
    const __rawName=String(__mfName.textContent||'').trim();
    const __cleanName=__mfClean(__rawName);
    if(__cleanName)__mfName.textContent=__cleanName;
  }

  let __showMeta=false;
  if(__mfMeta){
    const __rawMeta=String(__mfMeta.textContent||'').trim();
    const __cleanMeta=__mfClean(__rawMeta);
    __showMeta=!!__cleanMeta && !__mfEmojiOnly(__rawMeta) && __cleanMeta.toLowerCase()!=='no token selected';
    __mfMeta.textContent=__cleanMeta;
    if(__showMeta){
      __mfMeta.removeAttribute('hidden');
      __mfMeta.style.display='block';
    }else{
      __mfMeta.setAttribute('hidden','hidden');
      __mfMeta.style.display='none';
    }
  }

  const __mfHead=__mfName?.closest?.('.token-head')||null;
  const __mfLeft=__mfName?.parentElement||null;
  const __mfScoreBox=__mfScore?.parentElement||null;
  const __mfScoreCaption=__mfScoreBox
    ? [...__mfScoreBox.children].find((el)=>el!==__mfScore && /AI\s*SCORE/i.test(String(el.textContent||'')))
      || [...__mfScoreBox.children].find((el)=>el!==__mfScore)
      || null
    : null;

  if(__mfMeta&&__mfLeft&&__mfMeta.parentElement!==__mfLeft){
    __mfLeft.appendChild(__mfMeta);
  }

  if(__mfHead) __mfHead.classList.add('mf-primary-v16-head');
  if(__mfLeft) __mfLeft.classList.add('mf-primary-v16-left');
  if(__mfScoreBox) __mfScoreBox.classList.add('mf-primary-v16-scorebox');
  if(__mfScoreCaption) __mfScoreCaption.classList.add('mf-primary-v16-scorecaption');

  const __mfAlignMeta=()=>{
    if(!__mfMeta||!__showMeta||!__mfScoreCaption||!__mfName) return;
    const __nameRect=__mfName.getBoundingClientRect();
    const __metaRect=__mfMeta.getBoundingClientRect();
    const __captionRect=__mfScoreCaption.getBoundingClientRect();
    if(!__nameRect.height||!__captionRect.height) return;

    /* Keep meta below the name, then shift it so its baseline visually aligns
       with the AI SCORE caption on the right. */
    const __minGap=8;
    const __currentTopGap=Math.max(0,__metaRect.top-__nameRect.bottom);
    const __captionBaselineY=__captionRect.bottom;
    const __metaBaselineY=__metaRect.bottom;
    const __delta=__captionBaselineY-__metaBaselineY;
    const __nextMargin=Math.max(__minGap,__currentTopGap+__delta);
    __mfMeta.style.marginTop=String(Math.round(__nextMargin))+'px';
  };

  if(typeof requestAnimationFrame==='function') requestAnimationFrame(__mfAlignMeta);
  else setTimeout(__mfAlignMeta,0);
 }
${V16_RENDER_END}`;

const V16_STYLE=`${V16_STYLE_START}
<style id="mf-primary-identity-baseline-v16-style">
/* Keep the right AI score column fixed; do not move AI SCORE. */
#primary-candidate .token-head.mf-primary-v16-head{
  display:flex!important;
  align-items:flex-start!important;
  justify-content:space-between!important;
  gap:12px!important;
  min-width:0!important;
}
#primary-candidate .token-head.mf-primary-v16-head > *{min-width:0!important}

/* Left column: native logo stays where it already is; the text block keeps the
   big name on top and the small symbol underneath. */
#primary-candidate .mf-primary-v16-left{
  display:flex!important;
  flex-direction:column!important;
  align-items:flex-start!important;
  justify-content:flex-start!important;
  min-width:0!important;
  flex:1 1 auto!important;
  width:auto!important;
  max-width:100%!important;
  position:static!important;
  transform:none!important;
}

#primary-candidate #primaryName{
  display:block!important;
  min-width:0!important;
  max-width:100%!important;
  width:100%!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  margin:0!important;
  position:static!important;
  transform:none!important;
}

#primary-candidate #primaryMeta{
  display:block!important;
  margin:8px 0 0!important;
  padding:0!important;
  font-size:12px!important;
  line-height:1!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  opacity:.86!important;
  position:static!important;
  transform:none!important;
}
#primary-candidate #primaryMeta[hidden]{display:none!important}

#primary-candidate .mf-primary-v16-scorebox{
  flex:0 0 auto!important;
  align-self:flex-start!important;
  min-width:max-content!important;
  text-align:right!important;
  position:static!important;
  transform:none!important;
}
#primary-candidate .mf-primary-v16-scorecaption{
  display:block!important;
  margin:0!important;
  position:static!important;
  transform:none!important;
}
</style>
${V16_STYLE_END}`;

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

if(!fs.existsSync(target)){console.error('ERROR: index.html not found');process.exit(1)}
let html=fs.readFileSync(target,'utf8');
if(!html.includes('id="primary-candidate"')){console.error('ERROR: Primary Candidate not found');process.exit(1)}

const backup=target+'.before-primary-identity-baseline-v16.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

for(const [a,b] of STRIP_MARKERS){ html=stripRange(html,a,b); }
html=stripRange(html,V16_RENDER_START,V16_RENDER_END);
html=stripRange(html,V16_STYLE_START,V16_STYLE_END);

const prod=html.indexOf('<script id="production-core-js">');
if(prod<0){console.error('ERROR: production-core-js not found');process.exit(1)}
const metaStart=html.indexOf("set('#primaryMeta',",prod);
if(metaStart<0){console.error("ERROR: authoritative primaryMeta render not found");process.exit(1)}
const statementEnd=html.indexOf(';',metaStart);
if(statementEnd<0){console.error('ERROR: primaryMeta statement terminator not found');process.exit(1)}
html=html.slice(0,statementEnd+1)+'\n'+V16_RENDER+'\n'+html.slice(statementEnd+1);

const headClose=html.lastIndexOf('</head>');
if(headClose<0){console.error('ERROR: missing </head>');process.exit(1)}
html=html.slice(0,headClose)+'\n'+V16_STYLE+'\n'+html.slice(headClose);

fs.writeFileSync(target,html,'utf8');
console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Small token symbol is restored under the big name and aligned to the AI SCORE caption baseline.');
console.log('AI SCORE remains in place.');
