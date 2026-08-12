(()=>{'use strict';
const d=document;
const game=d.getElementById('game'),world=d.getElementById('world');
if(!game||!world)return;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas=d.createElement('canvas');canvas.id='webglScene';canvas.setAttribute('aria-hidden','true');
world.insertBefore(canvas,world.firstChild);
let gl=null;try{gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'})||canvas.getContext('experimental-webgl');}catch{}
if(!gl){canvas.remove();return;}
world.classList.add('webgl-ready');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const stageMap={ground:0,clouds:1,strato:2,orbit:3,moon:4,deep:5,hyper:6};
const state={w:1,h:1,dpr:1,time:0,last:performance.now(),stage:0,energy:0,search:0,live:0,danger:0,px:0,py:0,heroReady:false,heroAspect:.70,heroTex:null,particles:[],spawnCarry:0,speedCarry:0,alive:true};

function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const e=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(e)}return s}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}
const vs=`attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const fs=`precision highp float;
uniform vec2 R;uniform float T,S,E,Q,L,D;uniform vec2 P;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);} 
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);} 
float fb(vec2 p){float v=0.;v+=.52*n(p);p=p*2.03+13.1;v+=.26*n(p);p=p*2.01+7.7;v+=.13*n(p);p=p*2.07+3.2;v+=.065*n(p);return v;}
float st(vec2 uv,float sc,float th,float r){vec2 p=uv*sc;vec2 id=floor(p),g=fract(p)-.5;float q=h(id);float z=smoothstep(r,0.,length(g));return z*step(th,q)*(.35+.65*q);} 
float disc(vec2 uv,vec2 c,float r){return 1.-smoothstep(r,r+.006,length(uv-c));}
void main(){vec2 uv=gl_FragCoord.xy/R;float asp=R.x/R.y;vec2 q=vec2((uv.x-.5)*asp,uv.y-.5);float space=smoothstep(1.45,3.1,S);float deep=smoothstep(3.6,5.2,S);
vec3 top=mix(vec3(.012,.032,.055),vec3(.0015,.003,.014),space);vec3 bot=mix(vec3(.16,.40,.53),vec3(.015,.036,.072),space);vec3 col=mix(bot,top,pow(uv.y,.82));
float neb=fb(q*2.35+vec2(T*.012,-T*.006)+P*.18);float nebMask=smoothstep(.48,.82,neb)*space;col+=nebMask*mix(vec3(.025,.12,.18),vec3(.16,.045,.22),deep)*(.35+.5*E);
vec2 su=uv+P*.018;float drift=T*(.004+.012*E);float a=st(su+vec2(drift*.15,drift),36.,.976,.055);float b=st(su*1.31+vec2(-drift*.35,drift*1.8),64.,.985,.045);float c=st(su*1.83+vec2(drift*.8,drift*3.),92.,.992,.035);float stars=(a*.55+b*.78+c)*(.25+.75*space+.20*Q);col+=stars*vec3(.78,.9,1.);
float ca=(1.-smoothstep(.7,1.7,S));vec2 cp=vec2(uv.x*3.5+T*.012+P.x*.11,uv.y*7.5-T*.008);float cv=fb(cp)+.28*fb(cp*1.7+8.);float band=exp(-pow((uv.y-.20)/.115,2.));float clouds=smoothstep(.64,1.02,cv)*band*ca;col=mix(col,vec3(.72,.84,.88),clouds*.72);
float ea=1.-smoothstep(1.55,3.05,S);vec2 ec=vec2((uv.x-.5)*asp,uv.y+.51);float em=1.-smoothstep(.71,.73,length(ec));vec3 earth=mix(vec3(.045,.11,.17),vec3(.20,.43,.54),smoothstep(.0,.7,uv.y));col=mix(col,earth,em*ea*.96);col+=vec3(.13,.36,.48)*exp(-pow((length(ec)-.72)/.025,2.))*ea*.38;
float moonOn=smoothstep(2.65,3.75,S)*(1.-smoothstep(5.6,6.2,S));vec2 mc=vec2(.78+P.x*.025,.72+P.y*.02);float md=disc(vec2((uv.x-mc.x)*asp*.78+mc.x,uv.y),mc,.095);float msh=disc(vec2((uv.x-(mc.x+.022))*asp*.78+(mc.x+.022),uv.y),vec2(mc.x+.022,mc.y-.014),.092);col=mix(col,vec3(.58,.67,.72),md*moonOn*.72);col*=1.-msh*moonOn*.30;
float planetOn=smoothstep(4.2,5.0,S);vec2 pc=vec2(.10-P.x*.02,.66+P.y*.01);float pd=disc(vec2((uv.x-pc.x)*asp*.82+pc.x,uv.y),pc,.17);col=mix(col,vec3(.08,.22,.37)+vec3(.08,.04,.16)*fb(uv*8.),pd*planetOn*.58);
float horizon=exp(-pow((uv.y-.09)/.06,2.))*(.18+.22*(1.-space));col+=vec3(.10,.42,.58)*horizon;
float lineY=fract((uv.y+T*(.16+.72*E))*54.+uv.x*8.);float lane=step(.982,lineY)*step(.55,h(floor(vec2(uv.x*18.,(uv.y+T*.3)*28.))));col+=vec3(.50,.86,1.)*lane*E*L*.45;
float vign=smoothstep(.55,.98,length(q*vec2(.80,1.05)));col*=1.-vign*(.28+.08*D);col+=vec3(.03,.22,.17)*Q*.10;col=mix(col,vec3(.22,.02,.04),D*.12*vign);
col=pow(max(col,0.),vec3(.92));gl_FragColor=vec4(col,1.);}`;
let bgP;try{bgP=program(vs,fs)}catch(e){console.warn('[WebGL V9] shader init failed',e);world.classList.remove('webgl-ready');canvas.remove();return}
const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
const bgA=gl.getAttribLocation(bgP,'a'),uR=gl.getUniformLocation(bgP,'R'),uT=gl.getUniformLocation(bgP,'T'),uS=gl.getUniformLocation(bgP,'S'),uE=gl.getUniformLocation(bgP,'E'),uQ=gl.getUniformLocation(bgP,'Q'),uL=gl.getUniformLocation(bgP,'L'),uD=gl.getUniformLocation(bgP,'D'),uP=gl.getUniformLocation(bgP,'P');

const heroVS=`attribute vec2 a;attribute vec2 u;varying vec2 v;void main(){v=u;gl_Position=vec4(a,0.,1.);}`;
const heroFS=`precision mediump float;uniform sampler2D X;uniform float A;varying vec2 v;void main(){vec4 c=texture2D(X,v);c.a*=A;gl_FragColor=c;}`;
let heroP=null,heroBuf=null,heroA=-1,heroU=-1,heroX=null,heroAlpha=null;
try{heroP=program(heroVS,heroFS);heroBuf=gl.createBuffer();heroA=gl.getAttribLocation(heroP,'a');heroU=gl.getAttribLocation(heroP,'u');heroX=gl.getUniformLocation(heroP,'X');heroAlpha=gl.getUniformLocation(heroP,'A')}catch(e){console.warn('[WebGL V9] hero program failed',e)}

const partVS=`attribute vec2 a;attribute float s;attribute vec4 c;varying vec4 v;void main(){v=c;gl_Position=vec4(a,0.,1.);gl_PointSize=s;}`;
const partFS=`precision mediump float;varying vec4 v;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float a=smoothstep(.5,.04,d)*v.a;gl_FragColor=vec4(v.rgb,a);}`;
let partP=null,partBuf=null,pa=-1,ps=-1,pc=-1;
try{partP=program(partVS,partFS);partBuf=gl.createBuffer();pa=gl.getAttribLocation(partP,'a');ps=gl.getAttribLocation(partP,'s');pc=gl.getAttribLocation(partP,'c')}catch(e){console.warn('[WebGL V9] particle program failed',e)}

function resize(){const r=world.getBoundingClientRect();const cap=(innerWidth<700?1.5:1.8);const p=clamp(devicePixelRatio||1,1,cap);const w=Math.max(2,Math.round(r.width*p)),h=Math.max(2,Math.round(r.height*p));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;state.w=w;state.h=h;state.dpr=p;gl.viewport(0,0,w,h)}}
new ResizeObserver(resize).observe(world);resize();
let mx=.5,my=.5;world.addEventListener('pointermove',e=>{const r=world.getBoundingClientRect();mx=clamp((e.clientX-r.left)/Math.max(1,r.width),0,1);my=clamp((e.clientY-r.top)/Math.max(1,r.height),0,1)},{passive:true});world.addEventListener('pointerleave',()=>{mx=.5;my=.5},{passive:true});

function loadHero(){const src=d.querySelector('.rocket-body img')?.getAttribute('src')||'/game-assets/pepe-rocket.svg?v=51';const im=new Image();im.decoding='async';im.onload=()=>{try{const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);state.heroTex=tex;state.heroAspect=(im.naturalWidth||1)/(im.naturalHeight||1);state.heroReady=true;world.classList.add('webgl-hero-ready')}catch(e){console.warn('[WebGL V9] hero texture failed',e)}};im.onerror=()=>console.warn('[WebGL V9] hero asset fallback to DOM');im.src=src}
/* V9.2 clean scene: DOM hero is the only Pepe/rocket. */

function read(){const name=game.dataset.stage||'ground';const st=stageMap[name]??0;const mode=game.dataset.state||'idle';const flight=game.dataset.flight||'idle';const dir=game.dataset.direction||'flat';const dg=game.dataset.danger||'none';const m=parseFloat((d.getElementById('multiplierNumber')?.textContent||'1').replace(',','.'))||1;const en=clamp(Math.log(Math.max(1,m))/Math.log(5),0,1);return{st,mode,flight,dir,dg,m,en,search:mode==='searching'?1:0,live:mode==='live'||mode==='settling'?1:0,danger:dg==='high'?1:dg==='medium'?0.55:dg==='low'?0.22:0}}
function spawn(x,y,vx,vy,life,size,c){if(state.particles.length>420)state.particles.splice(0,state.particles.length-360);state.particles.push({x,y,vx,vy,life,max:life,size,c})}
function updateParticles(dt,hero,info){const q=reduce?0.45:(innerWidth<600?0.72:1);let rate=(info.live?45+info.en*110:info.search?24:11)*q;state.spawnCarry+=dt*rate;while(state.spawnCarry>=1){state.spawnCarry-=1;const live=info.live;const spark=Math.random()<(live?0.58:0.22);const x=hero.x+(Math.random()-.5)*hero.w*.12,y=hero.y+hero.h*.36+(Math.random()-.5)*5*state.dpr;if(spark){spawn(x,y,(Math.random()-.5)*(18+70*info.en)*state.dpr,(80+Math.random()*(130+220*info.en))*state.dpr,.28+Math.random()*.45,(2+Math.random()*4)*state.dpr,Math.random()<.55?[1,.48,.18,.82]:[.35,.9,1,.72])}else{spawn(x,y,(Math.random()-.5)*24*state.dpr,(28+Math.random()*48)*state.dpr,.8+Math.random()*1.2,(8+Math.random()*17)*state.dpr,[.35,.55,.63,.14])}}
if(info.live&&info.en>.08){state.speedCarry+=dt*(8+info.en*42)*q;while(state.speedCarry>=1){state.speedCarry-=1;spawn(Math.random()*state.w,-10,(-10+Math.random()*20)*state.dpr,(260+Math.random()*520*(.35+info.en))*state.dpr,.35+Math.random()*.65,(1.2+Math.random()*2.5)*state.dpr,[.62,.91,1,.24+.28*info.en])}}
for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=dt;if(p.life<=0||p.y>state.h+80){state.particles.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.992,dt*60);if(p.size>7)p.size*=1+dt*.20}
}
function drawParticles(hero,info){if(!partP)return;const arr=[];const halo=.06+.09*info.en+.04*info.search;arr.push(hero.x/state.w*2-1,1-hero.y/state.h*2,Math.max(hero.w,hero.h)*(.95+info.en*.35),.15,.88,.78,halo);for(const p of state.particles){const a=clamp(p.life/p.max,0,1);arr.push(p.x/state.w*2-1,1-p.y/state.h*2,p.size,p.c[0],p.c[1],p.c[2],p.c[3]*a)}if(arr.length===0)return;gl.useProgram(partP);gl.bindBuffer(gl.ARRAY_BUFFER,partBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.DYNAMIC_DRAW);const stride=7*4;gl.enableVertexAttribArray(pa);gl.vertexAttribPointer(pa,2,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(ps);gl.vertexAttribPointer(ps,1,gl.FLOAT,false,stride,2*4);gl.enableVertexAttribArray(pc);gl.vertexAttribPointer(pc,4,gl.FLOAT,false,stride,3*4);gl.drawArrays(gl.POINTS,0,arr.length/7)}
function heroGeom(info,t){const portrait=state.h>state.w;let base=portrait?state.w*.25:state.w*.205;base=clamp(base,105*state.dpr,230*state.dpr);const aspect=Math.max(.4,Math.min(1.2,state.heroAspect||.7));const hw=base,hh=hw/aspect;const bob=(info.live?Math.sin(t*2.0)*2.5:Math.sin(t*1.7)*4.5)*state.dpr;const rise=info.live?(22+info.en*60)*state.dpr:info.search?4*state.dpr:0;const x=state.w*.5+Math.sin(t*.62)*state.w*.006+(state.px*state.w*.018);const y=state.h*(portrait?0.60:0.61)-rise+bob;const rot=(Math.sin(t*.88)*(info.live?0.025:0.045)+(info.dir==='up'?-.025:info.dir==='down'?0.035:0));return{x,y,w:hw,h:hh,rot}}
function drawHero(h){if(!heroP||!state.heroReady||!state.heroTex)return;const c=Math.cos(h.rot),s=Math.sin(h.rot),hx=h.w/2,hy=h.h/2;const pts=[[-hx,-hy,0,1],[hx,-hy,1,1],[-hx,hy,0,0],[-hx,hy,0,0],[hx,-hy,1,1],[hx,hy,1,0]];const out=[];for(const p of pts){const rx=p[0]*c-p[1]*s+h.x,ry=p[0]*s+p[1]*c+h.y;out.push(rx/state.w*2-1,1-ry/state.h*2,p[2],p[3])}gl.useProgram(heroP);gl.bindBuffer(gl.ARRAY_BUFFER,heroBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(heroA);gl.vertexAttribPointer(heroA,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(heroU);gl.vertexAttribPointer(heroU,2,gl.FLOAT,false,16,8);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,state.heroTex);gl.uniform1i(heroX,0);gl.uniform1f(heroAlpha,1);gl.drawArrays(gl.TRIANGLES,0,6)}
function drawBg(info,t){gl.useProgram(bgP);gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(bgA);gl.vertexAttribPointer(bgA,2,gl.FLOAT,false,0,0);gl.uniform2f(uR,state.w,state.h);gl.uniform1f(uT,t);gl.uniform1f(uS,state.stage);gl.uniform1f(uE,state.energy);gl.uniform1f(uQ,state.search);gl.uniform1f(uL,state.live);gl.uniform1f(uD,state.danger);gl.uniform2f(uP,state.px,state.py);gl.drawArrays(gl.TRIANGLES,0,6)}
function frame(now){if(!state.alive)return;resize();const dt=Math.min(.05,Math.max(.001,(now-state.last)/1000));state.last=now;state.time+=dt;const info=read();state.stage=mix(state.stage,info.st,1-Math.pow(.0008,dt));state.energy=mix(state.energy,info.en,1-Math.pow(.002,dt));state.search=mix(state.search,info.search,1-Math.pow(.003,dt));state.live=mix(state.live,info.live,1-Math.pow(.002,dt));state.danger=mix(state.danger,info.danger,1-Math.pow(.003,dt));const driftX=(mx-.5)*2*.35+Math.sin(state.time*.18)*.22,driftY=(my-.5)*2*.18+Math.cos(state.time*.15)*.10;state.px=mix(state.px,driftX,1-Math.pow(.025,dt));state.py=mix(state.py,driftY,1-Math.pow(.025,dt));const hero=heroGeom(info,state.time);updateParticles(dt,hero,info);world.classList.toggle('webgl-boost',info.flight==='boost'||info.en>.45);world.classList.toggle('webgl-danger',info.danger>.7);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(0.005,0.01,0.02,1);gl.clear(gl.COLOR_BUFFER_BIT);drawBg(info,state.time);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);drawParticles(hero,info);/* V9.2 clean scene: no duplicate WebGL hero. */gl.disable(gl.BLEND);requestAnimationFrame(frame)}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.alive=false;world.classList.remove('webgl-ready','webgl-hero-ready','webgl-boost','webgl-danger')});
requestAnimationFrame(frame);
window.PepeRocketWebGLV9={version:'9.4',renderer:'WebGL 2.5D',layers:11,get ready(){return world.classList.contains('webgl-ready')}};
})();