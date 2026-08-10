import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PRIMARY_IDENTITY_CLEAN_V13';
const V12_RENDER_START='/* MF_PRIMARY_IDENTITY_NATIVE_V12_RENDER_START */';
const V12_RENDER_END='/* MF_PRIMARY_IDENTITY_NATIVE_V12_RENDER_END */';
const V13_RENDER_START='/* MF_PRIMARY_IDENTITY_CLEAN_V13_RENDER_START */';
const V13_RENDER_END='/* MF_PRIMARY_IDENTITY_CLEAN_V13_RENDER_END */';
const V13_STYLE_START='<!-- MF_PRIMARY_IDENTITY_CLEAN_V13_STYLE_START -->';
const V13_STYLE_END='<!-- MF_PRIMARY_IDENTITY_CLEAN_V13_STYLE_END -->';

const V13_RENDER=`${V13_RENDER_START}
 {
  /* V13: native logo remains the ONLY logo. This block only cleans text. */
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
    if(__mfEmojiOnly(__rawMeta) || !__cleanMeta){
      __mfMeta.textContent='';
      __mfMeta.setAttribute('hidden','hidden');
    }else{
      __mfMeta.textContent=__cleanMeta;
      __mfMeta.removeAttribute('hidden');
    }
  }
 }
${V13_RENDER_END}`;

const V13_STYLE=`${V13_STYLE_START}
<style id="mf-primary-identity-clean-v13-style">
/* Keep the native/legacy token logo. Remove our injected duplicate slot completely. */
#primary-candidate #primaryAvatar,
#primary-candidate #primaryAvatarImage,
#primary-candidate #primaryAvatarFallback{
  display:none!important;
}
#primary-candidate #primaryIdentity{
  grid-template-columns:minmax(0,1fr)!important;
}
#primary-candidate #primaryMeta[hidden]{
  display:none!important;
}
</style>
${V13_STYLE_END}`;

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

function removeDivById(html,id){
  const idToken=`id="${id}"`;
  const idPos=html.indexOf(idToken);
  if(idPos<0)return html;
  const start=html.lastIndexOf('<div',idPos);
  if(start<0)return html;

  const tokenRe=/<div\b[^>]*>|<\/div\s*>/gi;
  tokenRe.lastIndex=start;
  let depth=0,end=-1,m;
  while((m=tokenRe.exec(html))){
    if(/^<div\b/i.test(m[0]))depth++;
    else depth--;
    if(depth===0){end=tokenRe.lastIndex;break}
  }
  if(end<0)return html;
  return html.slice(0,start)+html.slice(end);
}

function cleanLiteralNewlineGarbage(html){
  /* V11 once inserted literal "\\n" around its head style. Safari can surface
     those text nodes at the top of the document. Convert only those known
     patch-adjacent literals, plus literal \\n immediately after <body>. */
  html=html.replace(/\\n(?=<!-- MF_PRIMARY_IDENTITY_NATIVE_V11_STYLE_START -->)/g,'');
  html=html.replace(/<!-- MF_PRIMARY_IDENTITY_NATIVE_V11_STYLE_END -->\\n/g,'<!-- MF_PRIMARY_IDENTITY_NATIVE_V11_STYLE_END -->');
  html=html.replace(/(<body\b[^>]*>)\\n+/i,'$1');
  return html;
}

const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

if(!fs.existsSync(target)){console.error('ERROR: index.html not found');process.exit(1)}

let html=fs.readFileSync(target,'utf8');
if(!html.includes('id="primary-candidate"')){console.error('ERROR: Primary Candidate not found');process.exit(1)}

const backup=target+'.before-primary-identity-clean-v13.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

/* Remove our duplicate avatar from the actual markup. */
html=removeDivById(html,'primaryAvatar');

/* Remove V12/V13 live blocks and install one text-only cleanup block. */
html=stripRange(html,V12_RENDER_START,V12_RENDER_END);
html=stripRange(html,V13_RENDER_START,V13_RENDER_END);
html=stripRange(html,V13_STYLE_START,V13_STYLE_END);

const prod=html.indexOf('<script id="production-core-js">');
if(prod<0){console.error('ERROR: production-core-js not found');process.exit(1)}

const metaStart=html.indexOf("set('#primaryMeta',",prod);
if(metaStart<0){console.error("ERROR: authoritative primaryMeta render not found");process.exit(1)}
const statementEnd=html.indexOf(';',metaStart);
if(statementEnd<0){console.error('ERROR: primaryMeta statement terminator not found');process.exit(1)}

html=html.slice(0,statementEnd+1)+'\n'+V13_RENDER+'\n'+html.slice(statementEnd+1);

html=cleanLiteralNewlineGarbage(html);

const headClose=html.lastIndexOf('</head>');
if(headClose<0){console.error('ERROR: missing </head>');process.exit(1)}
html=html.slice(0,headClose)+'\n'+V13_STYLE+'\n'+html.slice(headClose);

fs.writeFileSync(target,html,'utf8');

console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Injected duplicate #primaryAvatar removed from markup.');
console.log('Native token logo remains untouched.');
console.log('Emoji-only duplicate meta is hidden.');
console.log('Known literal \\\\n head garbage cleaned.');
console.log('AI SCORE is untouched.');
