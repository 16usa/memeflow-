import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PRIMARY_IDENTITY_META_RETURN_V14';
const V13_RENDER_START='/* MF_PRIMARY_IDENTITY_CLEAN_V13_RENDER_START */';
const V13_RENDER_END='/* MF_PRIMARY_IDENTITY_CLEAN_V13_RENDER_END */';
const V13_STYLE_START='<!-- MF_PRIMARY_IDENTITY_CLEAN_V13_STYLE_START -->';
const V13_STYLE_END='<!-- MF_PRIMARY_IDENTITY_CLEAN_V13_STYLE_END -->';
const V14_RENDER_START='/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_START */';
const V14_RENDER_END='/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_END */';
const V14_STYLE_START='<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_START -->';
const V14_STYLE_END='<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_END -->';

const V14_RENDER=`${V14_RENDER_START}
 {
  /* V14: keep the single native logo and bring back the small symbol/meta line. */
  const __mfName=$('#primaryName');
  const __mfMeta=$('#primaryMeta');
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

  if(__mfMeta){
    const __rawMeta=String(__mfMeta.textContent||'').trim();
    const __cleanMeta=__mfClean(__rawMeta);
    const __showMeta=!!__cleanMeta && !__mfEmojiOnly(__rawMeta) && __cleanMeta.toLowerCase()!=='no token selected';
    if(__showMeta){
      __mfMeta.textContent=__cleanMeta;
      __mfMeta.removeAttribute('hidden');
      __mfMeta.style.display='block';
    }else{
      __mfMeta.textContent=__cleanMeta;
      __mfMeta.setAttribute('hidden','hidden');
    }
  }
 }
${V14_RENDER_END}`;

const V14_STYLE=`${V14_STYLE_START}
<style id="mf-primary-identity-meta-return-v14-style">
#primary-candidate #primaryMeta{
  display:block!important;
  margin:7px 0 0!important;
  padding:0!important;
  line-height:1.02!important;
  font-size:12px!important;
  opacity:.86!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
#primary-candidate #primaryMeta[hidden]{display:none!important}
</style>
${V14_STYLE_END}`;

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

const backup=target+'.before-primary-identity-meta-return-v14.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

html=stripRange(html,V13_RENDER_START,V13_RENDER_END);
html=stripRange(html,V13_STYLE_START,V13_STYLE_END);
html=stripRange(html,V14_RENDER_START,V14_RENDER_END);
html=stripRange(html,V14_STYLE_START,V14_STYLE_END);

const prod=html.indexOf('<script id="production-core-js">');
if(prod<0){console.error('ERROR: production-core-js not found');process.exit(1)}
const metaStart=html.indexOf("set('#primaryMeta',",prod);
if(metaStart<0){console.error("ERROR: authoritative primaryMeta render not found");process.exit(1)}
const statementEnd=html.indexOf(';',metaStart);
if(statementEnd<0){console.error('ERROR: primaryMeta statement terminator not found');process.exit(1)}
html=html.slice(0,statementEnd+1)+'\n'+V14_RENDER+'\n'+html.slice(statementEnd+1);

const headClose=html.lastIndexOf('</head>');
if(headClose<0){console.error('ERROR: missing </head>');process.exit(1)}
html=html.slice(0,headClose)+'\n'+V14_STYLE+'\n'+html.slice(headClose);

fs.writeFileSync(target,html,'utf8');
console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Small primary meta/symbol line restored under the big token name.');
console.log('Single native logo is preserved. AI SCORE untouched.');
