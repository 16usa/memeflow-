const ALPH='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58decode(s){let n=0n;for(const c of s){const i=ALPH.indexOf(c);if(i<0)throw Error('invalid base58');n=n*58n+BigInt(i)}let h=n.toString(16);if(h.length%2)h='0'+h;let b=Buffer.from(h,'hex');let z=0;while(s[z]==='1')z++;return Buffer.concat([Buffer.alloc(z),b])}
export function validPubkey(s){try{return b58decode(s).length===32}catch{return false}}

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

// Retryable: timeout/abort, rate-limit, transient server errors, network failures
function retryable(e){
  return e.name==='AbortError'||
    /abort|operation was aborted/i.test(e.message)||
    [429,502,503,504].includes(e.status)||
    ['ECONNRESET','ENOTFOUND','ETIMEDOUT','ECONNREFUSED'].includes(e.code)||
    /network|connection reset|ECONNRESET/i.test(e.message);
}

export class RpcPool{
  constructor(urls,commitment='confirmed'){
    this.urls=urls.filter(Boolean);
    this.commitment=commitment;
    this.i=0;
    this.last={ok:false,latency:null,url:null,error:'not checked'};
    // Exposed for /api/discovery/status metrics
    this.metrics={retries:0,timeouts:0};
  }

  async call(method,params=[]){
    if(!this.urls.length)throw new Error('SOLANA_RPC_URLS is not configured');
    const TIMEOUT=Number(process.env.SOLANA_RPC_TIMEOUT_MS||20000);
    const MAX_ATTEMPTS=3;
    let lastError;

    for(let attempt=0;attempt<MAX_ATTEMPTS;attempt++){
      if(attempt>0){
        // 429 → respect Retry-After header, else use 2s/5s cooldown; other errors use 500ms/1500ms
        const is429=lastError?.status===429;
        const defaultMs=is429?[2000,5000][attempt-1]:[500,1500][attempt-1];
        const delayMs=lastError?.retryAfterMs??defaultMs;
        await sleep(delayMs);
        this.metrics.retries++;
      }

      for(let k=0;k<this.urls.length;k++){
        const url=this.urls[(this.i+k)%this.urls.length];
        const ac=new AbortController();
        const t=setTimeout(()=>ac.abort(),TIMEOUT);
        const start=Date.now();
        try{
          const r=await fetch(url,{
            method:'POST',
            headers:{'content-type':'application/json'},
            body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params}),
            signal:ac.signal
          });
          clearTimeout(t);
          const j=await r.json();
          if(j.error){
            const code=j.error.code;
            // Permanent JSON-RPC errors: parse error, invalid request/method/params — no retry
            if(code===-32700||code===-32600||code===-32601||code===-32602)
              throw Object.assign(new Error(j.error.message||`RPC error ${code}`),{permanent:true});
            const e=Object.assign(new Error(j.error.message||`RPC error ${code}`),{rpcCode:code});
            if(!r.ok){
              e.status=r.status;
              // Capture Retry-After for 429 backoff
              const ra=r.headers?.get?.('retry-after');
              if(ra&&!isNaN(ra))e.retryAfterMs=Number(ra)*1000;
            }
            throw e;
          }
          if(!r.ok){
            const ra=r.headers?.get?.('retry-after');
            const retryAfterMs=ra&&!isNaN(ra)?Number(ra)*1000:null;
            throw Object.assign(new Error(`RPC HTTP ${r.status}`),{status:r.status,retryAfterMs});
          }
          // Success — advance round-robin to this working endpoint
          this.i=(this.i+k)%this.urls.length;
          this.last={ok:true,latency:Date.now()-start,url,error:null};
          return j.result;
        }catch(e){
          clearTimeout(t);
          lastError=e;
          this.last={ok:false,latency:Date.now()-start,url,error:e.message};
          if(e.permanent)throw e;           // never retry invalid-request errors
          if(!retryable(e))throw e;         // non-retryable: stop immediately
          if(e.name==='AbortError'||/abort/i.test(e.message))this.metrics.timeouts++;
          // retryable: continue inner loop to try next endpoint in same attempt
        }
      }
      // All endpoints exhausted for this attempt; outer loop will apply backoff before next attempt
    }
    throw lastError||new Error('RPC failed after retries');
  }
}

export function u64(buf,o){return Number(buf.readBigUInt64LE(o))}
export function decodeCurve(base64,decimals=6){const b=Buffer.from(base64,'base64');if(b.length<49)throw Error('Bonding curve account too short');let o=8;const virtualToken=u64(b,o);o+=8;const virtualSol=u64(b,o);o+=8;const realToken=u64(b,o);o+=8;const realSol=u64(b,o);o+=8;const supply=u64(b,o);o+=8;const complete=Boolean(b[o]);const priceSol=virtualToken>0?(virtualSol/1e9)/(virtualToken/10**decimals):null;return {virtualToken,virtualSol,realToken,realSol,supply,complete,priceSol,liquiditySol:realSol/1e9}}
export function decodeCreateData(data){try{const b=b58decode(data),disc=[...b.subarray(0,8)],create='24,30,200,40,5,28,7,119',create2='214,144,76,236,95,139,49,180';if(disc.join(',')!==create&&disc.join(',')!==create2)return null;let o=8;const str=()=>{const n=b.readUInt32LE(o);o+=4;const s=b.subarray(o,o+n).toString('utf8');o+=n;return s};return {kind:disc.join(',')===create?'create':'create_v2',name:str(),symbol:str(),uri:str()}}catch{return null}}
