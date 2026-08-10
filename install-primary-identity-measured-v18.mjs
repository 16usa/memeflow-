import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PRIMARY_IDENTITY_MEASURED_V18';
const OLD_PAIRS=[
  ['/* MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_RENDER_START */','/* MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_RENDER_END */'],
  ['<!-- MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_STYLE_END -->'],
  ['/* MF_PRIMARY_IDENTITY_BASELINE_V16_RENDER_START */','/* MF_PRIMARY_IDENTITY_BASELINE_V16_RENDER_END */'],
  ['<!-- MF_PRIMARY_IDENTITY_BASELINE_V16_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_BASELINE_V16_STYLE_END -->'],
  ['/* MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_START */','/* MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_END */'],
  ['<!-- MF_PRIMARY_IDENTITY_LAYOUT_V15_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_LAYOUT_V15_STYLE_END -->'],
  ['/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_START */','/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_END */'],
  ['<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_END -->']
];

const RENDER_START='/* MF_PRIMARY_IDENTITY_MEASURED_V18_RENDER_START */';
const RENDER_END='/* MF_PRIMARY_IDENTITY_MEASURED_V18_RENDER_END */';
const STYLE_START='<!-- MF_PRIMARY_IDENTITY_MEASURED_V18_STYLE_START -->';
const STYLE_END='<!-- MF_PRIMARY_IDENTITY_MEASURED_V18_STYLE_END -->';

const RENDER=`${RENDER_START}
 {
  /* V18 is measurement-based, not guess-based.
     It reads the actual rendered height of #primaryScore and uses that exact height
     for the token avatar, so the avatar top and bottom match the number.
     It also restores the 2x2 layout:
       [avatar] [big name ]    [big number]
       [      ] [small meta]   [AI SCORE ]
  */
  const __mfName=$('#primaryName');
  const __mfMeta=$('#primaryMeta');
  const __mfScore=$('#primaryScore');
  const __mfHead=__mfName?.closest?.('.token-head')||null;

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

  let __mfShowMeta=false;
  if(__mfMeta){
    const __rawMeta=String(__mfMeta.textContent||'').trim();
    const __cleanMeta=__mfClean(__rawMeta);
    __mfShowMeta=!!__cleanMeta && !__mfEmojiOnly(__rawMeta) && __cleanMeta.toLowerCase()!=='no token selected';
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
    const __mfScoreBox=__mfScore.parentElement||null;
    const __mfLeft=__mfName.parentElement||null;
    if(__mfMeta&&__mfLeft&&__mfMeta.parentElement!==__mfLeft){
      __mfLeft.appendChild(__mfMeta);
    }

    const __mfAvatar=__mfLeft
      ? [...__mfLeft.children].find((el)=>el.id!=='primaryName'&&el.id!=='primaryMeta') || null
      : null;

    const __mfScoreCaption=__mfScoreBox
      ? [...__mfScoreBox.children].find((el)=>el!==__mfScore && /AI\s*SCORE/i.test(String(el.textContent||'')))
        || [...__mfScoreBox.children].find((el)=>el!==__mfScore)
        || null
      : null;

    __mfHead.classList.add('mf-primary-v18-head');
    if(__mfLeft)__mfLeft.classList.add('mf-primary-v18-left');
    if(__mfScoreBox)__mfScoreBox.classList.add('mf-primary-v18-score');
    if(__mfAvatar)__mfAvatar.classList.add('mf-primary-v18-avatar');
    if(__mfScoreCaption)__mfScoreCaption.classList.add('mf-primary-v18-scorecaption');

    const __mfApplyMeasurements=()=>{
      if(!__mfHead||!__mfScore)return;
      const __scoreRect=__mfScore.getBoundingClientRect();
      const __scoreH=Math.max(1,Math.round(__scoreRect.height));
      if(__scoreH){
        __mfHead.style.setProperty('--mf-primary-v18-score-h', __scoreH+'px');
      }

      const __capRect=__mfScoreCaption?.getBoundingClientRect?.();
      const __capH=__capRect?.height ? Math.max(1,Math.round(__capRect.height)) : 14;
      __mfHead.style.setProperty('--mf-primary-v18-cap-h', __capH+'px');

      if(__mfAvatar&&__scoreH){
        __mfAvatar.style.width=__scoreH+'px';
        __mfAvatar.style.height=__scoreH+'px';
        __mfAvatar.style.minWidth=__scoreH+'px';
        __mfAvatar.style.minHeight=__scoreH+'px';
        __mfAvatar.style.maxWidth=__scoreH+'px';
        __mfAvatar.style.maxHeight=__scoreH+'px';
      }
    };

    const __mfSchedule=()=>{
      if(typeof requestAnimationFrame==='function') requestAnimationFrame(__mfApplyMeasurements);
      else setTimeout(__mfApplyMeasurements,0);
    };

    __mfSchedule();
    if(!window.__mfPrimaryV18ResizeBound){
      window.addEventListener('resize',()=>{
        document.querySelectorAll('#primary-candidate .token-head.mf-primary-v18-head').forEach((head)=>{
          const score=head.querySelector('#primaryScore');
          const avatar=head.querySelector('.mf-primary-v18-avatar');
          const scoreCap=head.querySelector('.mf-primary-v18-scorecaption');
          if(!score)return;
          const scoreRect=score.getBoundingClientRect();
          const h=Math.max(1,Math.round(scoreRect.height));
          head.style.setProperty('--mf-primary-v18-score-h',h+'px');
          const capRect=scoreCap?.getBoundingClientRect?.();
          head.style.setProperty('--mf-primary-v18-cap-h',((capRect?.height&&Math.round(capRect.height))||14)+'px');
          if(avatar){
            avatar.style.width=h+'px';
            avatar.style.height=h+'px';
            avatar.style.minWidth=h+'px';
            avatar.style.minHeight=h+'px';
            avatar.style.maxWidth=h+'px';
            avatar.style.maxHeight=h+'px';
          }
        });
      },{passive:true});
      window.__mfPrimaryV18ResizeBound=true;
    }
  }
 }
${RENDER_END}`;

const STYLE=`${STYLE_START}
<style id="mf-primary-identity-measured-v18-style">
/* Outer 2-column layout: left identity block, right score block. */
#primary-candidate .token-head.mf-primary-v18-head{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto!important;
  column-gap:14px!important;
  row-gap:0!important;
  align-items:start!important;
  width:100%!important;
  min-width:0!important;
  --mf-primary-v18-score-h:64px;
  --mf-primary-v18-cap-h:16px;
}

/* Left block keeps avatar + text in a strict 2x2 geometry. */
#primary-candidate .mf-primary-v18-left{
  display:grid!important;
  grid-template-columns:auto minmax(0,1fr)!important;
  grid-template-rows:var(--mf-primary-v18-score-h) var(--mf-primary-v18-cap-h)!important;
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

/* Avatar uses EXACT measured score height, so its top and bottom match the big number. */
#primary-candidate .mf-primary-v18-avatar{
  grid-column:1!important;
  grid-row:1!important;
  align-self:start!important;
  justify-self:start!important;
  width:var(--mf-primary-v18-score-h)!important;
  height:var(--mf-primary-v18-score-h)!important;
  min-width:var(--mf-primary-v18-score-h)!important;
  min-height:var(--mf-primary-v18-score-h)!important;
  max-width:var(--mf-primary-v18-score-h)!important;
  max-height:var(--mf-primary-v18-score-h)!important;
  overflow:hidden!important;
  position:static!important;
  transform:none!important;
}
#primary-candidate .mf-primary-v18-avatar img,
#primary-candidate .mf-primary-v18-avatar picture,
#primary-candidate .mf-primary-v18-avatar canvas,
#primary-candidate .mf-primary-v18-avatar svg{
  width:100%!important;
  height:100%!important;
  object-fit:cover!important;
}

/* Big token name shares the first row with the big number. */
#primary-candidate .mf-primary-v18-left #primaryName{
  grid-column:2!important;
  grid-row:1!important;
  align-self:center!important;
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

/* Small symbol shares the second row with the AI SCORE caption. */
#primary-candidate .mf-primary-v18-left #primaryMeta{
  grid-column:2!important;
  grid-row:2!important;
  align-self:end!important;
  min-width:0!important;
  max-width:100%!important;
  width:auto!important;
  margin:0!important;
  padding:0!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  font-size:12px!important;
  line-height:1!important;
  position:static!important;
  transform:none!important;
}
#primary-candidate .mf-primary-v18-left #primaryMeta[hidden]{display:none!important}

/* Right score block becomes the matching 2-row partner. */
#primary-candidate .mf-primary-v18-score{
  display:grid!important;
  grid-template-rows:var(--mf-primary-v18-score-h) var(--mf-primary-v18-cap-h)!important;
  align-items:start!important;
  justify-items:end!important;
  justify-self:end!important;
  align-self:start!important;
  min-width:max-content!important;
  margin:0!important;
  padding:0!important;
  position:static!important;
  transform:none!important;
}
#primary-candidate .mf-primary-v18-score #primaryScore{
  grid-row:1!important;
  align-self:start!important;
  margin:0!important;
}
#primary-candidate .mf-primary-v18-scorecaption{
  grid-row:2!important;
  align-self:end!important;
  margin:0!important;
  position:static!important;
  transform:none!important;
}

@media(max-width:430px){
  #primary-candidate .token-head.mf-primary-v18-head{column-gap:10px!important}
  #primary-candidate .mf-primary-v18-left{column-gap:10px!important}
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

const backup=target+'.before-primary-identity-measured-v18.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

for(const [a,b] of OLD_PAIRS) html=stripRange(html,a,b);
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
console.log('Avatar height is measured from #primaryScore at runtime.');
console.log('Avatar top/bottom now match the big score number.');
console.log('Big name shares row 1 with the number; small meta shares row 2 with AI SCORE.');
