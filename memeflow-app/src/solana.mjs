const ALPH='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58decode(s){let n=0n;for(const c of s){const i=ALPH.indexOf(c);if(i<0)throw Error('invalid base58');n=n*58n+BigInt(i)}let h=n.toString(16);if(h.length%2)h='0'+h;let b=Buffer.from(h,'hex');let z=0;while(s[z]==='1')z++;return Buffer.concat([Buffer.alloc(z),b])}
export function b58encode(buf){let n=BigInt('0x'+buf.toString('hex')||'0');let r='';while(n>0n){const rem=n%58n;r=ALPH[Number(rem)]+r;n=n/58n}for(let i=0;i<buf.length&&buf[i]===0;i++)r=ALPH[0]+r;return r||ALPH[0]}
export function validPubkey(s){try{return b58decode(s).length===32}catch{return false}}

// ── Pump.fun discriminator constants (sha256("global:<name>")[0:8]) ────────────
export const PUMP_DISC_CREATE             = [24,30,200,40,5,28,7,119];
export const PUMP_DISC_CREATE_V2          = [214,144,76,236,95,139,49,180];
export const PUMP_DISC_BUY                = [102,6,61,18,1,218,235,234];
export const PUMP_DISC_SELL               = [51,230,133,164,1,127,131,173];
export const PUMP_DISC_WITHDRAW           = [183,18,70,156,148,109,161,34];
export const PUMP_DISC_BUY_EXACT_SOL_IN   = [56,252,116,8,158,223,205,95];
// Inner CPI event/log payloads — not instructions, never decode-failed
export const PUMP_DISC_EVENT_PAYLOAD      = [228,69,165,46,81,203,154,29];
// Known non-create trade instructions (string form for fast lookup)
const KNOWN_NON_CREATE = new Set([
  PUMP_DISC_BUY.join(','),
  PUMP_DISC_SELL.join(','),
  PUMP_DISC_WITHDRAW.join(','),
  PUMP_DISC_BUY_EXACT_SOL_IN.join(','),
]);
// Known inner event/CPI payloads — silently skipped, different counter than knownNonCreate
const KNOWN_EVENT_PAYLOAD = new Set([
  PUMP_DISC_EVENT_PAYLOAD.join(','),
]);
const DISC_CREATE    = PUMP_DISC_CREATE.join(',');
const DISC_CREATE_V2 = PUMP_DISC_CREATE_V2.join(',');
// Rate-limit unknown discriminator logging — log first occurrence per disc key only
const _loggedUnknownDiscs = new Set();

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

  /** Sanitized hostname of the current endpoint — never exposes credentials or full URL. */
  get activeHostname(){try{return new URL(this.urls[this.i%Math.max(1,this.urls.length)]).hostname}catch{return '[unconfigured]'}}

  /** Single-attempt fetch — no retry loop. Rotates endpoint on 429. Throws on any error. */
  async callOnce(method,params=[]){
    if(!this.urls.length)throw new Error('SOLANA_RPC_URLS is not configured');
    const TIMEOUT=Number(process.env.SOLANA_RPC_TIMEOUT_MS||20000);
    const url=this.urls[this.i%this.urls.length];
    const ac=new AbortController();
    const t=setTimeout(()=>ac.abort(),TIMEOUT);
    const start=Date.now();
    try{
      const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params}),signal:ac.signal});
      clearTimeout(t);
      const j=await r.json();
      if(j.error){
        const code=j.error.code;
        if(code===-32700||code===-32600||code===-32601||code===-32602)throw Object.assign(new Error(j.error.message||`RPC error ${code}`),{permanent:true});
        const e=Object.assign(new Error(j.error.message||`RPC error ${code}`),{rpcCode:code});
        if(!r.ok){e.status=r.status;if(r.status===429)this.i=(this.i+1)%this.urls.length;const ra=r.headers?.get?.('retry-after');if(ra&&!isNaN(ra))e.retryAfterMs=Number(ra)*1000}
        throw e;
      }
      if(!r.ok){
        if(r.status===429||r.status>=500)this.i=(this.i+1)%this.urls.length;
        const ra=r.headers?.get?.('retry-after');const retryAfterMs=ra&&!isNaN(ra)?Number(ra)*1000:null;
        throw Object.assign(new Error(`RPC HTTP ${r.status}`),{status:r.status,retryAfterMs});
      }
      this.last={ok:true,latency:Date.now()-start,url,error:null};
      return j.result;
    }catch(e){
      clearTimeout(t);
      this.last={ok:false,latency:Date.now()-start,url,error:e.message};
      if(e.name==='AbortError'||/abort/i.test(e.message))this.metrics.timeouts++;
      throw e;
    }
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

/**
 * Decode a single Pump.fun instruction into a create record.
 * Returns {ok:true, mint, curve, creator, name, symbol, uri, kind}
 *     or  {ok:false, reason, discBytes?, dataLen?, accountCount?}
 * reason values:
 *   'pumpInstructionWithoutData' — ix.data absent or undecodable
 *   'knownNonCreate'             — recognised Buy/Sell/Withdraw; caller must NOT increment decodeFailed
 *   'unknownPumpDiscriminator'   — unrecognised discriminator; discBytes+dataLen returned for logging
 *   'invalidAccountLayout'       — discriminator matched but < 2 accounts
 *   'invalidMint'                — accounts[0] is not a valid 32-byte pubkey
 *
 * @param {object} ix    instruction object {data?, accounts?[]}
 * @param {string[]} keys  resolved account-key array (for numeric account refs)
 */
export function decodePumpCreate(ix, keys) {
  if (!ix.data) return {ok:false, reason:'pumpInstructionWithoutData'};
  let b, discBytes, dataLen;
  try {
    b = b58decode(ix.data);
    discBytes = [...b.subarray(0, 8)];
    dataLen   = b.length;
  } catch {
    return {ok:false, reason:'pumpInstructionWithoutData'};
  }
  const discKey = discBytes.join(',');
  // Known non-create trade instructions — caller increments knownNonCreateIgnored, not decodeFailed
  if (KNOWN_NON_CREATE.has(discKey)) return {ok:false, reason:'knownNonCreate'};
  // Known inner event/CPI payloads — caller increments ignoredPumpEventPayloads, not decodeFailed
  if (KNOWN_EVENT_PAYLOAD.has(discKey)) return {ok:false, reason:'ignoredPumpEventPayload'};
  // Unknown discriminator — log first occurrence only, then aggregate silently
  if (discKey !== DISC_CREATE && discKey !== DISC_CREATE_V2) {
    if (!_loggedUnknownDiscs.has(discKey)) {
      _loggedUnknownDiscs.add(discKey);
      console.log(`[DECODE] unknown disc=[${discBytes.join(',')}] dataLen=${dataLen} — first occurrence, subsequent hits aggregated silently`);
    }
    return {ok:false, reason:'unknownPumpDiscriminator', discBytes, dataLen};
  }
  // Parse string fields
  let name, symbol, uri;
  try {
    let o = 8;
    const str = () => {const n=b.readUInt32LE(o);o+=4;const s=b.subarray(o,o+n).toString('utf8');o+=n;return s};
    name=str(); symbol=str(); uri=str();
  } catch {
    return {ok:false, reason:'invalidAccountLayout', discBytes, dataLen};
  }
  const ac = (ix.accounts || []).map(a => typeof a === 'number' ? keys[a] : a);
  if (ac.length < 2) return {ok:false, reason:'invalidAccountLayout', accountCount:ac.length, discBytes, dataLen};
  const mint  = ac[0];
  const curve = ac.length > 2 ? ac[2] : null;
  if (!validPubkey(mint)) return {ok:false, reason:'invalidMint', discBytes, dataLen};
  return {ok:true, mint, curve, creator:ac[7]||null, name, symbol, uri, kind:discKey===DISC_CREATE?'create':'create_v2'};
}
