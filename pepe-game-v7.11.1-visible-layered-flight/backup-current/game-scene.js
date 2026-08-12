(()=>{
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const stageRank={ground:0,clouds:1,strato:2,orbit:3,moon:4,deep:5,hyper:6};
  const rand=(a,b)=>a+Math.random()*(b-a);

  function create(options={}){
    const root=options.root,world=options.world,canvas=options.canvas,rocket=options.rocket;
    if(!root||!world||!canvas||!rocket||typeof canvas.getContext!=='function')return null;
    const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true})||canvas.getContext('2d');
    if(!ctx)return null;
    const reduced=()=>Boolean(options.reducedMotion?.());
    const saveData=navigator.connection?.saveData===true;
    const memory=Number(navigator.deviceMemory)||8;
    const cores=Number(navigator.hardwareConcurrency)||8;
    const quality=saveData?.48:(memory<=4||cores<=4)?.68:1;
    let mode='idle',running=false,raf=null,w=1,h=1,dpr=1,last=0,scroll=0,drift=0,launchTimer=null;
    let state={multiplier:1,peak:1,velocity:0,acceleration:0,stage:'ground',danger:'none',thrust:0,flightState:'idle'};
    const stars=[],motes=[],smoke=[],sparks=[];
    const starTarget=()=>Math.max(28,Math.round((w<500?58:w<900?84:112)*quality));
    const moteTarget=()=>Math.max(10,Math.round((w<500?18:30)*quality));

    function resize(){
      const r=canvas.getBoundingClientRect();w=Math.max(1,r.width);h=Math.max(1,r.height);
      dpr=Math.min(saveData?1:1.65,Number(devicePixelRatio)||1);
      canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
      while(stars.length<starTarget())stars.push({x:rand(0,w),y:rand(0,h),z:rand(.18,1),s:rand(.35,1.35),a:rand(.16,.72),tw:rand(0,Math.PI*2)});
      if(stars.length>starTarget())stars.length=starTarget();
      while(motes.length<moteTarget())motes.push({x:rand(0,w),y:rand(0,h),z:rand(.25,1),s:rand(.7,2.1),a:rand(.04,.22)});
      if(motes.length>moteTarget())motes.length=moteTarget();
    }

    function rocketOrigin(){
      const rr=rocket.getBoundingClientRect(),cr=canvas.getBoundingClientRect();
      return{x:rr.left-cr.left+rr.width*.5,y:rr.top-cr.top+rr.height*.82,size:Math.max(30,rr.width)};
    }
    function emitSmoke(origin,count,energy){
      for(let i=0;i<count;i++)smoke.push({x:origin.x+rand(-origin.size*.06,origin.size*.06),y:origin.y+rand(0,origin.size*.06),vx:rand(-.22,.22)*(1+energy),vy:rand(.20,.62)*(1+energy*.7),r:rand(3.5,8)*(origin.size/180),a:rand(.12,.30),life:1});
      if(smoke.length>110*quality)smoke.splice(0,smoke.length-Math.round(110*quality));
    }
    function emitSparks(origin,count,energy){
      for(let i=0;i<count;i++)sparks.push({x:origin.x+rand(-4,4),y:origin.y+rand(0,7),vx:rand(-.8,.8)*(1+energy),vy:rand(.8,2.3)*(1+energy*1.6),r:rand(.6,1.8),a:rand(.45,.95),life:1,h:rand(35,62)});
      if(sparks.length>90*quality)sparks.splice(0,sparks.length-Math.round(90*quality));
    }

    function setMode(next){
      const prev=mode;mode=next||'idle';root.dataset.cinematic=mode;
      if(mode==='live'&&prev!=='live'&&!reduced()){
        root.classList.remove('cinema-launch-kick');void root.offsetWidth;root.classList.add('cinema-launch-kick');
        clearTimeout(launchTimer);launchTimer=setTimeout(()=>root.classList.remove('cinema-launch-kick'),900);
      }
      if(mode==='settling'&&!reduced()){
        root.classList.remove('cinema-settle-kick');void root.offsetWidth;root.classList.add('cinema-settle-kick');
        clearTimeout(launchTimer);launchTimer=setTimeout(()=>root.classList.remove('cinema-settle-kick'),700);
      }
    }
    function update(next={}){
      state={...state,...next};
      root.dataset.cinematicFlight=String(state.flightState||'idle');
    }

    function draw(ts,dt){
      ctx.clearRect(0,0,w,h);
      const rank=stageRank[state.stage]??0;
      const velocity=Math.abs(Number(state.velocity)||0),m=Math.max(1,Number(state.multiplier)||1);
      const live=mode==='live'||mode==='settling';
      const energy=clamp((Number(state.thrust)||0)/100*.58+velocity*7+rank*.055+Math.max(0,m-1)*.018,0,1);
      const travel=live?(18+energy*210+rank*13):(mode==='searching'?7:2.2);
      const scale=dt/16.67;

      // Layer 1: distant stars. Slow and crisp.
      for(const s of stars){
        s.tw+=.012*scale;s.y+=(travel*(.035+s.z*.12))*scale;
        if(s.y>h+20){s.y=-20;s.x=rand(0,w)}
        const visible=rank===0?(mode==='searching'?.20:.08):clamp(.18+rank*.14,0,1);
        ctx.globalAlpha=s.a*visible*(.84+Math.sin(s.tw)*.16);
        ctx.fillStyle=rank>=4?'#dfe8ff':'#e8f8ff';
        const trail=live?1+energy*22*s.z:1;
        ctx.fillRect(s.x,s.y,s.s,Math.max(s.s,trail));
      }

      // Layer 2: atmospheric motes move at a different depth.
      if(rank<=2){
        for(const p of motes){
          p.y+=(1.1+energy*4.5)*p.z*scale;p.x+=Math.sin((ts*.00045)+(p.y*.01))*p.z*.14*scale;
          if(p.y>h+8){p.y=-8;p.x=rand(0,w)}
          ctx.globalAlpha=p.a*(rank===0?.75:.35);
          ctx.fillStyle=rank===0?'#d9f5ff':'#b5ddf0';
          ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,Math.PI*2);ctx.fill();
        }
      }

      if(live&&!reduced()){
        const origin=rocketOrigin();
        const smokeRate=rank<=1?Math.max(1,Math.round((.6+energy*2.6)*quality)):0;
        const sparkRate=Math.max(0,Math.round((energy*2.4+(rank>=3?.7:0))*quality));
        if(smokeRate)emitSmoke(origin,smokeRate,energy);
        if(sparkRate)emitSparks(origin,sparkRate,energy);
      }else if((mode==='idle'||mode==='searching')&&!reduced()&&Math.random()<.10*quality){
        emitSmoke(rocketOrigin(),1,.1);
      }

      // Layer 3: exhaust smoke behind the rocket.
      for(let i=smoke.length-1;i>=0;i--){
        const p=smoke[i];p.x+=p.vx*scale;p.y+=p.vy*scale;p.r+=.08*scale;p.life*=Math.pow(.974,scale);p.a*=Math.pow(.984,scale);
        if(p.life<.04||p.a<.012||p.y>h+40){smoke.splice(i,1);continue}
        ctx.globalAlpha=p.a;ctx.fillStyle=rank>=2?'#8fc8e5':'#c8e1e8';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
      }
      // Layer 4: hot micro-sparks, visually faster than smoke.
      for(let i=sparks.length-1;i>=0;i--){
        const p=sparks[i];p.x+=p.vx*scale;p.y+=p.vy*scale;p.vx*=.995;p.life*=Math.pow(.94,scale);p.a*=Math.pow(.95,scale);
        if(p.life<.04||p.a<.02||p.y>h+30){sparks.splice(i,1);continue}
        ctx.globalAlpha=p.a;ctx.fillStyle=`hsl(${p.h} 100% 70%)`;ctx.fillRect(p.x,p.y,p.r,Math.max(p.r,3.5*p.r));
      }
      ctx.globalAlpha=1;

      scroll=(scroll+travel*.055*scale)%420;drift=Math.sin(ts/1300)*(1.2+energy*7)+(Number(state.acceleration)||0)*90;
      world.style.setProperty('--cinema-back-y',`${(scroll*.16).toFixed(2)}px`);
      world.style.setProperty('--cinema-mid-y',`${(scroll*.46).toFixed(2)}px`);
      world.style.setProperty('--cinema-front-y',`${(scroll*.86).toFixed(2)}px`);
      world.style.setProperty('--cinema-drift-x',`${clamp(drift,-16,16).toFixed(2)}px`);
      world.style.setProperty('--cinema-energy',energy.toFixed(3));
      world.style.setProperty('--cinema-streak',clamp((live?energy*.78:0)+(rank>=5?.20:0),0,.92).toFixed(3));
      world.style.setProperty('--cinema-bloom',clamp(.12+energy*.62+(state.danger==='high'?.14:0),.08,.9).toFixed(3));
    }

    function frame(ts=performance.now()){
      raf=null;if(!running)return;
      if(reduced()){ctx.clearRect(0,0,w,h);return;}
      const minFrame=(mode==='live'||mode==='settling')?15:30;
      if(last&&ts-last<minFrame){raf=requestAnimationFrame(frame);return}
      const dt=clamp(last?ts-last:16.67,4,50);last=ts;draw(ts,dt);raf=requestAnimationFrame(frame);
    }
    function resume(){if(running||reduced())return;running=true;resize();last=0;raf=requestAnimationFrame(frame)}
    function pause(){running=false;if(raf!==null){cancelAnimationFrame(raf);raf=null}}
    function stop(){pause();clearTimeout(launchTimer);launchTimer=null;ro?.disconnect();if(!ro)removeEventListener('resize',resize);ctx.clearRect(0,0,w,h)}
    const ro=globalThis.ResizeObserver?new ResizeObserver(resize):null;ro?.observe(canvas);if(!ro)addEventListener('resize',resize,{passive:true});resize();setMode('idle');
    return{setMode,update,resume,pause,stop,resize};
  }

  globalThis.PepeSceneDirector=Object.freeze({create});
})();
