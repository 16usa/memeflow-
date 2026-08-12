import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const payload=path.join(here,'payload');
const app=path.resolve(process.cwd(),'memeflow-app');
const expected={"game.html":"a144d830140cf45229864ce6c2d8653adfebaa236dd239ac70168e2ab57144aa","game.css":"a67ae47ad0f927212d51addfc3c05fb5252b734f31201b0836983241c8581a1a","game.js":"1d5d67e2823f3faf614e60a59e0f62fec93897da0aeca222d9707c584debd4d3"};
const files=['game.html','game.css','game.js'];
let checks=0;
const pass=(name,ok)=>{if(!ok)throw new Error('FAIL '+name);checks++;console.log('PASS',name)};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function cssBracesBalanced(source){
  let depth=0,quote=null,comment=false,escape=false;
  for(let i=0;i<source.length;i++){
    const c=source[i],n=source[i+1];
    if(comment){if(c==='*'&&n==='/'){comment=false;i++;}continue;}
    if(quote){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c===quote)quote=null;continue;}
    if(c==='/'&&n==='*'){comment=true;i++;continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='{')depth++;
    else if(c==='}'){depth--;if(depth<0)return false;}
  }
  return depth===0&&!quote&&!comment;
}

function duplicateCssSelectors(source){
  source=source.replace(/\/\*[\s\S]*?\*\//g,'');
  const duplicates=[];
  function walk(start,end,context){
    const seen=new Map();let i=start;
    while(i<end){
      while(i<end&&/\s/.test(source[i]))i++;
      if(i>=end)break;
      let quote=null,paren=0,j=i,open=-1,semi=-1;
      for(;j<end;j++){
        const c=source[j];
        if(quote){if(c==='\\')j++;else if(c===quote)quote=null;continue;}
        if(c==='"'||c==="'"){quote=c;continue;}
        if(c==='('){paren++;continue;}if(c===')'){paren=Math.max(0,paren-1);continue;}
        if(paren===0&&c==='{'){open=j;break;}
        if(paren===0&&c===';'){semi=j;break;}
      }
      if(semi>=0&&(open<0||semi<open)){i=semi+1;continue;}
      if(open<0)break;
      const head=source.slice(i,open).trim().replace(/\s+/g,' ');
      let depth=1,k=open+1,q=null;
      for(;k<end&&depth>0;k++){
        const c=source[k];
        if(q){if(c==='\\')k++;else if(c===q)q=null;continue;}
        if(c==='"'||c==="'"){q=c;continue;}
        if(c==='{')depth++;else if(c==='}')depth--;
      }
      const close=k-1;
      if(head.startsWith('@'))walk(open+1,close,context+' > '+head);
      else{
        const count=(seen.get(head)||0)+1;seen.set(head,count);
        if(count>1)duplicates.push(context+' :: '+head);
      }
      i=k;
    }
  }
  walk(0,source.length,'root');
  return duplicates;
}

pass('namespaced V6.4 package directory',path.basename(here)==='pepe-game-v6.4');
pass('package payload contains visual files only',JSON.stringify(fs.readdirSync(payload).sort())===JSON.stringify([...files].sort()));
for(const f of files){pass('payload hash '+f,sha(path.join(payload,f))===expected[f]);pass('installed hash '+f,sha(path.join(app,f))===expected[f]);}

const html=fs.readFileSync(path.join(app,'game.html'),'utf8');
const css=fs.readFileSync(path.join(app,'game.css'),'utf8');
const js=fs.readFileSync(path.join(app,'game.js'),'utf8');

pass('V6.4 client version',js.includes("CLIENT_VERSION='6.4'"));
pass('V6.4 cache bust',html.includes('/game.js?v=64')&&html.includes('/game.css?v=64'));
pass('ordering counters commit after session acceptance',js.indexOf('if(eventSeq>0)game.lastEventSeq')>js.indexOf('if(payload.session&&!accepted)return false'));
pass('healthy SSE ignores stale packet without demotion',js.includes("else ui.streamState.textContent='Server-authoritative game stream live · stale packet ignored'"));
pass('SSE stuck-connection watchdog',js.includes('now-game.streamOpenedAt>15000')&&js.includes('game.streamReconnectAt'));
pass('hidden page stops fallback polling',js.includes("stopFallback();syncClockActivity();syncVisualActivity();"));
pass('offline closes EventSource',js.includes("try{game.stream?.close?.();}catch{}game.stream=null;stopFallback();syncButtons();"));
pass('wake lock reacquire timer',js.includes("setTimeout(()=>void syncWakeLock(),700)"));
pass('restored live risk preview uses locked session',js.includes("locked?(num(game.session.autoCashout)||0)")&&js.includes("locked?(num(game.session.stopLoss)||0)"));
pass('lost reset response reconciles server status',js.includes("const status=await api('/api/game/status');apply(status,{allowResult:false})"));
pass('idle canvas no eager resume',js.includes("if(!ro)addEventListener('resize',resize,{passive:true});resize();"));

pass('Flight Director HTML',html.includes('id="flightDirector"')&&html.includes('id="flightDirectorState"'));
pass('Flight Director CSS',css.includes('.flight-director{')&&css.includes('.director-horizon{'));
pass('Flight Director visual-only JS variables',js.includes("'--director-roll'")&&js.includes("'--director-pitch'"));
pass('result trace entry reference',html.includes('id="resultTraceEntry"')&&js.includes('ui.resultTraceEntry.setAttribute'));
pass('result trace area',html.includes('id="resultTraceArea"')&&js.includes('ui.resultTraceArea.setAttribute'));
pass('result trace area styling',css.includes('#resultTraceArea'));
pass('result trace entry styling',css.includes('#resultTraceEntry'));

pass('no client feedFresh mutation',!js.includes('session.feedFresh =')&&!js.includes('session.feedFresh='));
pass('no client canCashout mutation',!js.includes('session.canCashout =')&&!js.includes('session.canCashout='));
pass('no Game settings mutation endpoint',!js.includes('/api/settings'));
pass('no Game BUY endpoint',!js.includes('/api/buy'));
pass('no Game SELL endpoint',!js.includes('/api/sell'));
pass('no old Game coherence entry gate',!js.includes('decisionMaxAge')&&!js.includes('holderMaxAge')&&!js.includes('coherence gate'));

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
pass('unique HTML ids',new Set(ids).size===ids.length);
const refs=[...js.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);
pass('all JS ids resolve',refs.every(id=>ids.includes(id)));
pass('CSS braces balanced',cssBracesBalanced(css));
pass('no exact duplicate CSS selectors in same context',duplicateCssSelectors(css).length===0);
pass('no literal escaped newline bug',!css.includes('\\n.'));
pass('single Game stylesheet',([...html.matchAll(/<link\b[^>]*rel="stylesheet"/g)].length)===1);
pass('single Game script',([...html.matchAll(/<script\b[^>]*src=/g)].length)===1);

execFileSync(process.execPath,['--check',path.join(app,'game.js')],{stdio:'ignore'});
pass('syntax game.js',true);

pass('protected game engine not packaged',!fs.existsSync(path.join(payload,'game-engine.mjs')));
pass('protected app server not packaged',!fs.existsSync(path.join(payload,'app-server.mjs')));
pass('protected index not packaged',!fs.existsSync(path.join(payload,'index.html')));

const latest=path.join(app,'.memeflow-patches','pepe-game-v64','latest.json');
pass('V6.4 protection metadata exists',fs.existsSync(latest));
if(fs.existsSync(latest)){
  const meta=JSON.parse(fs.readFileSync(latest,'utf8'));
  for(const f of ['src/game-engine.mjs','app-server.mjs','index.html'])pass('protected unchanged '+f,sha(path.join(app,f))===meta.protectedBefore[f]);
}

execFileSync(process.execPath,[path.join(here,'runtime-smoke-v64.cjs'),app],{stdio:'inherit'});
pass('runtime smoke',true);

console.log(`PEPE GAME V6.4 VERIFY: PASS (${checks} checks)`);
