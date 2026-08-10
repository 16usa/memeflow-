import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PRIMARY_IDENTITY_LAYOUT_V15';

const V14_RENDER_START='/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_START */';
const V14_RENDER_END='/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_END */';
const V14_STYLE_START='<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_START -->';
const V14_STYLE_END='<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_END -->';

const V15_RENDER_START='/* MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_START */';
const V15_RENDER_END='/* MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_END */';
const V15_STYLE_START='<!-- MF_PRIMARY_IDENTITY_LAYOUT_V15_STYLE_START -->';
const V15_STYLE_END='<!-- MF_PRIMARY_IDENTITY_LAYOUT_V15_STYLE_END -->';

const V15_RENDER=`${V15_RENDER_START}
 {
  /* V15: no logo creation. Keep native logo; align name + meta in the text column. */
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

  if(__mfMeta){
    const __rawMeta=String(__mfMeta.textContent||'').trim();
    const __cleanMeta=__mfClean(__rawMeta);
    const __showMeta=!!__cleanMeta &&
      !__mfEmojiOnly(__rawMeta) &&
      __cleanMeta.toLowerCase()!=='no token selected';

    if(__showMeta){
      __mfMeta.textContent=__cleanMeta;
      __mfMeta.removeAttribute('hidden');
    }else{
      __mfMeta.textContent=__cleanMeta;
      __mfMeta.setAttribute('hidden','hidden');
    }
  }

  if(__mfHead&&__mfName&&__mfScore){
    const __mfScoreBox=__mfScore.parentElement;
    let __mfLeft=__mfName.parentElement;

    /* If a previous layout left primaryMeta elsewhere, bring only the TEXT node
       back to the same native left group. We do not touch the token logo. */
    if(__mfMeta&&__mfLeft&&__mfMeta.parentElement!==__mfLeft){
      __mfLeft.appendChild(__mfMeta);
    }

    if(__mfLeft){
      __mfLeft.classList.add('mf-primary-v15-left');
    }
    if(__mfScoreBox){
      __mfScoreBox.classList.add('mf-primary-v15-score');
    }
    __mfHead.classList.add('mf-primary-v15-head');
  }
 }
${V15_RENDER_END}`;

const V15_STYLE=`${V15_STYLE_START}
<style id="mf-primary-identity-layout-v15-style">
/* Two stable outer columns: identity on the left, untouched AI score on the right. */
#primary-candidate .token-head.mf-primary-v15-head{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto!important;
  align-items:start!important;
  gap:14px!important;
  width:100%!important;
  min-width:0!important;
}

/* Native left group becomes: logo | text. Name and symbol share the same text column. */
#primary-candidate .mf-primary-v15-left{
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

/* Whatever native logo/image node already exists auto-occupies column 1.
   The two known text IDs are pinned to column 2. */
#primary-candidate .mf-primary-v15-left #primaryName{
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

#primary-candidate .mf-primary-v15-left #primaryMeta{
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
  position:static!important;
  transform:none!important;
}

#primary-candidate .mf-primary-v15-left #primaryMeta[hidden]{
  display:none!important;
}

/* Score stays in its original right-hand box. */
#primary-candidate .mf-primary-v15-score{
  justify-self:end!important;
  align-self:start!important;
  min-width:max-content!important;
  margin:0!important;
  padding:0!important;
  position:static!important;
  transform:none!important;
}

@media(max-width:430px){
  #primary-candidate .token-head.mf-primary-v15-head{gap:10px!important}
  #primary-candidate .mf-primary-v15-left{column-gap:10px!important}
}
</style>
${V15_STYLE_END}`;

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

const backup=target+'.before-primary-identity-layout-v15.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

html=stripRange(html,V14_RENDER_START,V14_RENDER_END);
html=stripRange(html,V14_STYLE_START,V14_STYLE_END);
html=stripRange(html,V15_RENDER_START,V15_RENDER_END);
html=stripRange(html,V15_STYLE_START,V15_STYLE_END);

const prod=html.indexOf('<script id="production-core-js">');
if(prod<0){console.error('ERROR: production-core-js not found');process.exit(1)}

const metaStart=html.indexOf("set('#primaryMeta',",prod);
if(metaStart<0){console.error("ERROR: authoritative primaryMeta render not found");process.exit(1)}
const statementEnd=html.indexOf(';',metaStart);
if(statementEnd<0){console.error('ERROR: primaryMeta statement terminator not found');process.exit(1)}

html=html.slice(0,statementEnd+1)+'\n'+V15_RENDER+'\n'+html.slice(statementEnd+1);

const headClose=html.lastIndexOf('</head>');
if(headClose<0){console.error('ERROR: missing </head>');process.exit(1)}
html=html.slice(0,headClose)+'\n'+V15_STYLE+'\n'+html.slice(headClose);

fs.writeFileSync(target,html,'utf8');

console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Small symbol/meta is pinned under the big token name.');
console.log('Long names ellipsize before AI SCORE instead of overlapping it.');
console.log('No logo is created, removed, resized, or moved by V15.');
console.log('AI SCORE is not changed.');
