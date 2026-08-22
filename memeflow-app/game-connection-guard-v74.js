(() => {
'use strict';

/*
  MF_V74_CONNECTION_GUARD

  The existing game stream remains authoritative.

  This guard only decides whether the large top
  network warning is justified.

  An SSE reconnect alone is NOT a confirmed outage.
*/

const strip =
  document.getElementById('networkStrip');

const text =
  document.getElementById('networkText');

const streamState =
  document.getElementById('streamState');

if(!strip){
  return;
}

let failures = 0;
let firstFailureAt = 0;
let probing = false;
let confirmed = false;

const CONFIRM_MS = 12000;
const REQUIRED_FAILURES = 3;
const PROBE_TIMEOUT = 2500;


function hide(){
  confirmed=false;
  strip.hidden=true;
  document.documentElement
    .removeAttribute('data-mf-server-outage');
}


function show(){
  confirmed=true;

  if(document.hidden){
    return;
  }

  strip.hidden=false;

  if(text){
    text.textContent=
      'Server temporarily unavailable. Reconnecting…';
  }

  document.documentElement
    .setAttribute(
      'data-mf-server-outage',
      'true'
    );
}


async function health(){

  if(
    probing ||
    document.hidden ||
    navigator.onLine===false
  ){
    return false;
  }

  probing=true;

  const controller=
    new AbortController();

  const timeout=
    setTimeout(
      ()=>controller.abort(),
      PROBE_TIMEOUT
    );

  try{

    const response=
      await fetch(
        `/api/healthz?t=${Date.now()}`,
        {
          method:'GET',
          credentials:'include',
          cache:'no-store',
          headers:{
            accept:'application/json'
          },
          signal:controller.signal
        }
      );

    if(!response.ok){
      throw new Error(
        `HTTP_${response.status}`
      );
    }

    const data=
      await response.json();

    if(data?.ok!==true){
      throw new Error(
        'INVALID_HEALTH'
      );
    }


    /*
      Node is reachable.
      Therefore a short EventSource interruption
      is NOT a server outage.
    */
    failures=0;
    firstFailureAt=0;

    hide();

    if(
      streamState &&
      /unreachable|retrying|reconnect/i
        .test(streamState.textContent||'')
    ){
      streamState.textContent=
        'Server reachable · stream recovering';
    }

    return true;

  }catch(error){

    const now=Date.now();

    failures++;

    if(!firstFailureAt){
      firstFailureAt=now;
    }

    const elapsed=
      now-firstFailureAt;


    /*
      Do not annoy the user for tiny Safari /
      EventSource / proxy interruptions.
    */
    if(
      failures>=REQUIRED_FAILURES &&
      elapsed>=CONFIRM_MS
    ){
      show();

      if(streamState){
        streamState.textContent=
          'Server unreachable · retrying';
      }
    }else{
      strip.hidden=true;
    }

    return false;

  }finally{

    clearTimeout(timeout);
    probing=false;
  }
}


/*
  Existing game.js may try to display its reconnect
  banner immediately.

  Intercept that UI change and require health proof.
*/
const observer=
  new MutationObserver(()=>{

    if(strip.hidden){
      return;
    }

    if(confirmed){
      return;
    }

    strip.hidden=true;

    void health();
  });


observer.observe(
  strip,
  {
    attributes:true,
    attributeFilter:['hidden']
  }
);


/*
  Initial and recurring lightweight health check.
*/

void health();

setInterval(
  ()=>{
    if(
      !confirmed &&
      strip.hidden
    ){
      return;
    }

    void health();
  },
  4000
);


window.addEventListener(
  'online',
  ()=>{
    failures=0;
    firstFailureAt=0;
    void health();
  },
  {passive:true}
);


document.addEventListener(
  'visibilitychange',
  ()=>{
    if(!document.hidden){
      failures=0;
      firstFailureAt=0;
      void health();
    }
  }
);


window.addEventListener(
  'pageshow',
  ()=>{
    failures=0;
    firstFailureAt=0;
    void health();
  },
  {passive:true}
);

})();