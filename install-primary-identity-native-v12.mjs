import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PRIMARY_IDENTITY_NATIVE_V12';
const V11_RENDER_START='/* MF_PRIMARY_IDENTITY_NATIVE_V11_RENDER_START */';
const V11_RENDER_END='/* MF_PRIMARY_IDENTITY_NATIVE_V11_RENDER_END */';
const V12_STYLE_START='<!-- MF_PRIMARY_IDENTITY_NATIVE_V12_STYLE_START -->';
const V12_STYLE_END='<!-- MF_PRIMARY_IDENTITY_NATIVE_V12_STYLE_END -->';
const V12_RENDER_START='/* MF_PRIMARY_IDENTITY_NATIVE_V12_RENDER_START */';
const V12_RENDER_END='/* MF_PRIMARY_IDENTITY_NATIVE_V12_RENDER_END */';

const V12_STYLE=`${V12_STYLE_START}
<style id="mf-primary-identity-native-v12-style">
#primary-candidate #primaryMeta[hidden]{display:none!important}
</style>
${V12_STYLE_END}`;

const V12_RENDER=`${V12_RENDER_START}
 {
  /* V12: keep one logo; strip emoji/logo duplicates from name/meta text. */
  const __mfIdentity=$('#primaryIdentity');
  const __mfAvatar=$('#primaryAvatar');
  const __mfAvatarImage=$('#primaryAvatarImage');
  const __mfAvatarFallback=$('#primaryAvatarFallback');
  const __mfScore=$('#primaryScore');
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

  if(__mfIdentity&&__mfAvatar&&__mfAvatarImage&&__mfAvatarFallback){
   if(!has){
    __mfAvatar.hidden=true;
    __mfAvatarImage.hidden=true;
    __mfAvatarFallback.hidden=true;
    __mfIdentity.style.gridTemplateColumns='minmax(0,1fr)';
   }else{
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
    const __mfImageLower=__mfImageUrl.toLowerCase();
    if(__mfImageLower.startsWith('ipfs://'))__mfImageUrl='https://ipfs.io/ipfs/'+__mfImageUrl.slice(7);
    else if(__mfImageLower.startsWith('ar://'))__mfImageUrl='https://arweave.net/'+__mfImageUrl.slice(5);
    const __mfAllowed=__mfImageLower.startsWith('http://')||__mfImageLower.startsWith('https://')||__mfImageLower.startsWith('data:image/')||__mfImageLower.startsWith('blob:');
    if(!__mfAllowed && !__mfImageUrl.startsWith('https://ipfs.io/ipfs/') && !__mfImageUrl.startsWith('https://arweave.net/'))__mfImageUrl='';

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
${V12_RENDER_END}`;

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
if(!html.includes(V11_RENDER_START)){console.error('ERROR: V11 render block not found. Install V11 first.');process.exit(1)}

const backup=target+'.before-primary-identity-native-v12.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

html=stripRange(html,V12_STYLE_START,V12_STYLE_END);
html=stripRange(html,V12_RENDER_START,V12_RENDER_END);

const v11Start=html.indexOf(V11_RENDER_START);
const v11End=html.indexOf(V11_RENDER_END,v11Start);
if(v11Start<0||v11End<0){console.error('ERROR: broken V11 render markers');process.exit(1)}
html=html.slice(0,v11Start)+V12_RENDER+html.slice(v11End+V11_RENDER_END.length);

const headClose=html.lastIndexOf('</head>');
if(headClose<0){console.error('ERROR: missing </head>');process.exit(1)}
html=html.slice(0,headClose)+'\n'+V12_STYLE+'\n'+html.slice(headClose);

fs.writeFileSync(target,html,'utf8');
console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Removes duplicate emoji/logo text from name and meta. Keeps one left logo only.');
