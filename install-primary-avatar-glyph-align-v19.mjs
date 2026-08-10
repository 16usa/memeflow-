import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PRIMARY_AVATAR_GLYPH_ALIGN_V19';

const OLD_PAIRS=[
  ['/* MF_PRIMARY_IDENTITY_MEASURED_V18_RENDER_START */','/* MF_PRIMARY_IDENTITY_MEASURED_V18_RENDER_END */'],
  ['<!-- MF_PRIMARY_IDENTITY_MEASURED_V18_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_MEASURED_V18_STYLE_END -->'],
  ['/* MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_RENDER_START */','/* MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_RENDER_END */'],
  ['<!-- MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_STYLE_END -->'],
  ['/* MF_PRIMARY_IDENTITY_BASELINE_V16_RENDER_START */','/* MF_PRIMARY_IDENTITY_BASELINE_V16_RENDER_END -->'],
  ['<!-- MF_PRIMARY_IDENTITY_BASELINE_V16_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_BASELINE_V16_STYLE_END -->'],
  ['/* MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_START */','/* MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_END */'],
  ['<!-- MF_PRIMARY_IDENTITY_LAYOUT_V15_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_LAYOUT_V15_STYLE_END -->'],
  ['/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_START */','/* MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_END */'],
  ['<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_START -->','<!-- MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_END -->']
];

const RENDER_START='/* MF_PRIMARY_AVATAR_GLYPH_ALIGN_V19_RENDER_START */';
const RENDER_END='/* MF_PRIMARY_AVATAR_GLYPH_ALIGN_V19_RENDER_END */';
const STYLE_START='<!-- MF_PRIMARY_AVATAR_GLYPH_ALIGN_V19_STYLE_START -->';
const STYLE_END='<!-- MF_PRIMARY_AVATAR_GLYPH_ALIGN_V19_STYLE_END -->';

const RENDER=`${RENDER_START}
 {
  /*
    V19 does NOT use the DOM line-box height as avatar height.
    It measures the actual visible score glyphs with Canvas TextMetrics:
      actualBoundingBoxAscent + actualBoundingBoxDescent.
    The avatar is then sized to that glyph height and vertically offset to the
    glyph top inside #primaryScore's line box.

    Result:
      avatar TOP    = visible digit TOP
      avatar BOTTOM = visible digit BOTTOM

    Big name stays in row 1 with the number.
    Small symbol stays in row 2 with the AI SCORE caption.
  */
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
    const __mfScoreBox=__mfScore.parentElement||null;
    const __mfLeft=__mfName.parentElement||null;

    if(__mfMeta&&__mfLeft&&__mfMeta.parentElement!==__mfLeft){
      __mfLeft.appendChild(__mfMeta);
    }

    const __mfAvatar=__mfLeft
      ? [...__mfLeft.children].find((el)=>el.id!=='primaryName'&&el.id!=='primaryMeta') || null
      : null;

    const __mfScoreCaption=__mfScoreBox
      ? [...__mfScoreBox.children].find((el)=>el!==__mfScore && /AI\\s*SCORE/i.test(String(el.textContent||'')))
        || [...__mfScoreBox.children].find((el)=>el!==__mfScore)
        || null
      : null;

    __mfHead.classList.add('mf-primary-v19-head');
    if(__mfLeft)__mfLeft.classList.add('mf-primary-v19-left');
    if(__mfScoreBox)__mfScoreBox.classList.add('mf-primary-v19-score');
    if(__mfAvatar)__mfAvatar.classList.add('mf-primary-v19-avatar');
    if(__mfScoreCaption)__mfScoreCaption.classList.add('mf-primary-v19-scorecaption');

    const __mfMeasureScoreGlyph=()=>{
      const __scoreRect=__mfScore.getBoundingClientRect();
      const __scoreStyle=getComputedStyle(__mfScore);
      const __text=String(__mfScore.textContent||'').trim()||'0';

      let __glyphH=Math.max(1,Math.round(__scoreRect.height));
      let __glyphTop=0;

      try{
        const __canvas=document.createElement('canvas');
        const __ctx=__canvas.getContext('2d');
        if(__ctx){
          let __font=__scoreStyle.font;
          if(!__font || __font===''){
            __font=[
              __scoreStyle.fontStyle,
              __scoreStyle.fontVariant,
              __scoreStyle.fontWeight,
              __scoreStyle.fontSize+'/'+__scoreStyle.lineHeight,
              __scoreStyle.fontFamily
            ].filter(Boolean).join(' ');
          }
          __ctx.font=__font;

          const __tm=__ctx.measureText(__text);
          const __actualA=Number(__tm.actualBoundingBoxAscent)||0;
          const __actualD=Number(__tm.actualBoundingBoxDescent)||0;
          const __fontA=Number(__tm.fontBoundingBoxAscent)||0;
          const __fontD=Number(__tm.fontBoundingBoxDescent)||0;
          const __actualH=__actualA+__actualD;

          if(__actualH>0){
            __glyphH=Math.ceil(__actualH);

            const __fontBoxH=__fontA+__fontD;
            if(__fontBoxH>0){
              /*
                Baseline inside the CSS line box:
                center the font box inside the actual rendered line box, then
                subtract the real glyph ascent. This gives the glyph's real top.
              */
              const __baseline=((__scoreRect.height-__fontBoxH)/2)+__fontA;
              __glyphTop=Math.round(__baseline-__actualA);
            }else{
              /* Safari fallback if fontBoundingBox metrics are unavailable. */
              __glyphTop=Math.round((__scoreRect.height-__glyphH)/2);
            }
          }
        }
      }catch(_err){
        /* Measurement fallback remains the rendered score box. */
      }

      return {
        lineH:Math.max(1,Math.round(__scoreRect.height)),
        glyphH:Math.max(1,__glyphH),
        glyphTop:__glyphTop
      };
    };

    const __mfApply=()=>{
      const __m=__mfMeasureScoreGlyph();
      const __capRect=__mfScoreCaption?.getBoundingClientRect?.();
      const __capH=(__capRect?.height&&Math.max(1,Math.round(__capRect.height)))||14;

      __mfHead.style.setProperty('--mf-primary-v19-line-h',__m.lineH+'px');
      __mfHead.style.setProperty('--mf-primary-v19-glyph-h',__m.glyphH+'px');
      __mfHead.style.setProperty('--mf-primary-v19-glyph-top',__m.glyphTop+'px');
      __mfHead.style.setProperty('--mf-primary-v19-cap-h',__capH+'px');

      if(__mfAvatar){
        __mfAvatar.style.width=__m.glyphH+'px';
        __mfAvatar.style.height=__m.glyphH+'px';
        __mfAvatar.style.minWidth=__m.glyphH+'px';
        __mfAvatar.style.minHeight=__m.glyphH+'px';
        __mfAvatar.style.maxWidth=__m.glyphH+'px';
        __mfAvatar.style.maxHeight=__m.glyphH+'px';
        __mfAvatar.style.marginTop=__m.glyphTop+'px';
      }
    };

    const __mfSchedule=()=>{
      if(typeof requestAnimationFrame==='function'){
        requestAnimationFrame(()=>requestAnimationFrame(__mfApply));
      }else{
        setTimeout(__mfApply,0);
      }
    };

    __mfSchedule();

    if(document.fonts && document.fonts.status!=='loaded'){
      document.fonts.ready.then(__mfSchedule).catch(()=>{});
    }

    if(!window.__mfPrimaryV19ResizeBound){
      window.addEventListener('resize',()=>{
        const __name=document.querySelector('#primary-candidate #primaryName');
        const __score=document.querySelector('#primary-candidate #primaryScore');
        if(!__name||!__score)return;
        const __head=__name.closest('.token-head');
        const __left=__name.parentElement;
        const __avatar=__left
          ? [...__left.children].find((el)=>el.id!=='primaryName'&&el.id!=='primaryMeta') || null
          : null;
        if(!__head||!__avatar)return;

        const __style=getComputedStyle(__score);
        const __rect=__score.getBoundingClientRect();
        let __h=Math.max(1,Math.round(__rect.height));
        let __top=0;
        try{
          const __c=document.createElement('canvas');
          const __x=__c.getContext('2d');
          if(__x){
            __x.font=__style.font||(__style.fontWeight+' '+__style.fontSize+' '+__style.fontFamily);
            const __tm=__x.measureText(String(__score.textContent||'0'));
            const __a=Number(__tm.actualBoundingBoxAscent)||0;
            const __d=Number(__tm.actualBoundingBoxDescent)||0;
            const __fa=Number(__tm.fontBoundingBoxAscent)||0;
            const __fd=Number(__tm.fontBoundingBoxDescent)||0;
            if(__a+__d>0){
              __h=Math.ceil(__a+__d);
              const __fb=__fa+__fd;
              __top=__fb>0
                ? Math.round((((__rect.height-__fb)/2)+__fa)-__a)
                : Math.round((__rect.height-__h)/2);
            }
          }
        }catch(_e){}

        __head.style.setProperty('--mf-primary-v19-line-h',Math.round(__rect.height)+'px');
        __head.style.setProperty('--mf-primary-v19-glyph-h',__h+'px');
        __head.style.setProperty('--mf-primary-v19-glyph-top',__top+'px');
        __avatar.style.width=__h+'px';
        __avatar.style.height=__h+'px';
        __avatar.style.minWidth=__h+'px';
        __avatar.style.minHeight=__h+'px';
        __avatar.style.maxWidth=__h+'px';
        __avatar.style.maxHeight=__h+'px';
        __avatar.style.marginTop=__top+'px';
      },{passive:true});
      window.__mfPrimaryV19ResizeBound=true;
    }
  }
 }
${RENDER_END}`;

const STYLE=`${STYLE_START}
<style id="mf-primary-avatar-glyph-align-v19-style">
#primary-candidate .token-head.mf-primary-v19-head{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto!important;
  column-gap:14px!important;
  row-gap:0!important;
  align-items:start!important;
  width:100%!important;
  min-width:0!important;
  --mf-primary-v19-line-h:64px;
  --mf-primary-v19-glyph-h:54px;
  --mf-primary-v19-glyph-top:5px;
  --mf-primary-v19-cap-h:16px;
}

#primary-candidate .mf-primary-v19-left{
  display:grid!important;
  grid-template-columns:auto minmax(0,1fr)!important;
  grid-template-rows:var(--mf-primary-v19-line-h) var(--mf-primary-v19-cap-h)!important;
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

#primary-candidate .mf-primary-v19-avatar{
  grid-column:1!important;
  grid-row:1!important;
  align-self:start!important;
  justify-self:start!important;
  width:var(--mf-primary-v19-glyph-h)!important;
  height:var(--mf-primary-v19-glyph-h)!important;
  min-width:var(--mf-primary-v19-glyph-h)!important;
  min-height:var(--mf-primary-v19-glyph-h)!important;
  max-width:var(--mf-primary-v19-glyph-h)!important;
  max-height:var(--mf-primary-v19-glyph-h)!important;
  margin-top:var(--mf-primary-v19-glyph-top)!important;
  overflow:hidden!important;
  position:static!important;
  transform:none!important;
}

#primary-candidate .mf-primary-v19-avatar img,
#primary-candidate .mf-primary-v19-avatar picture,
#primary-candidate .mf-primary-v19-avatar canvas,
#primary-candidate .mf-primary-v19-avatar svg{
  width:100%!important;
  height:100%!important;
  object-fit:cover!important;
}

#primary-candidate .mf-primary-v19-left #primaryName{
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

#primary-candidate .mf-primary-v19-left #primaryMeta{
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

#primary-candidate .mf-primary-v19-left #primaryMeta[hidden]{display:none!important}

#primary-candidate .mf-primary-v19-score{
  display:grid!important;
  grid-template-rows:var(--mf-primary-v19-line-h) var(--mf-primary-v19-cap-h)!important;
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

#primary-candidate .mf-primary-v19-score #primaryScore{
  grid-row:1!important;
  align-self:start!important;
  margin:0!important;
}

#primary-candidate .mf-primary-v19-scorecaption{
  grid-row:2!important;
  align-self:end!important;
  margin:0!important;
  position:static!important;
  transform:none!important;
}

@media(max-width:430px){
  #primary-candidate .token-head.mf-primary-v19-head{column-gap:10px!important}
  #primary-candidate .mf-primary-v19-left{column-gap:10px!important}
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

const backup=target+'.before-primary-avatar-glyph-align-v19.bak';
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
console.log('Avatar is sized from visible score glyph metrics, not DOM line-height.');
console.log('Avatar top/bottom follow the visible digits.');
console.log('Big name and small symbol keep the V18 two-row alignment with score / AI SCORE.');
