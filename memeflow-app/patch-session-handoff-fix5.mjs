import fs from 'node:fs';

function mustReplace(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return text.replace(from, to);
}

/* ---------------- SERVER: one-time cross-browser session handoff ---------------- */
{
  const file='live-bootstrap.mjs';
  let s=fs.readFileSync(file,'utf8');

  if(!s.includes('MEMEFLOW_PHANTOM_SESSION_HANDOFF_FIX5')){
    const anchor="const nativeCreateServer=http.createServer;";
    const insert=`const nativeCreateServer=http.createServer;

// MEMEFLOW_PHANTOM_SESSION_HANDOFF_FIX5
// One-time, short-lived handoff lets Safari -> Phantom in-app browser keep the
// SAME authenticated MEMEFLOW user/session (owner or Pro entitlement included).
// Token is random, one-time, in-memory only, and is transported in the URL
// fragment so it is not sent in HTTP requests/referrers.
const __mfSessionHandoffs=new Map();
const __mfSessionHandoffTtlMs=120000;

function __mfCookieValue(req,name){
  const raw=String(req.headers.cookie||'');
  for(const part of raw.split(';')){
    const i=part.indexOf('=');
    if(i<0)continue;
    const k=part.slice(0,i).trim();
    if(k!==name)continue;
    try{return decodeURIComponent(part.slice(i+1).trim())}catch{return part.slice(i+1).trim()}
  }
  return '';
}
function __mfSecureCookie(req){
  const proto=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim().toLowerCase();
  return proto==='https'||String(req.headers.host||'').includes('replit.dev');
}
function __mfPruneHandoffs(){
  const now=Date.now();
  for(const [token,row] of __mfSessionHandoffs){
    if(!row||row.expiresAt<=now)__mfSessionHandoffs.delete(token);
  }
}
// /MEMEFLOW_PHANTOM_SESSION_HANDOFF_FIX5`;
    s=mustReplace(s,anchor,insert,'server handoff helpers');
  }

  if(!s.includes("pathname==='/api/session/handoff'")){
    const routeAnchor =
      s.includes("if(req.method==='GET'&&pathname==='/api/phantom/config')")
        ? "    if(req.method==='GET'&&pathname==='/api/phantom/config')"
        : "    if(req.method==='GET'&&pathname==='/api/live/status')";

    const routes=`    // MEMEFLOW_PHANTOM_SESSION_HANDOFF_ROUTES_FIX5
    if(req.method==='POST'&&pathname==='/api/session/handoff'){
      __mfPruneHandoffs();
      const sessionId=__mfCookieValue(req,'mf_session');
      if(!sessionId)return json(res,401,{error:'MEMEFLOW_SESSION_REQUIRED',message:'Open MEMEFLOW normally once before handing off to Phantom.'});
      const token=require('node:crypto').randomBytes(32).toString('base64url');
      __mfSessionHandoffs.set(token,{sessionId,expiresAt:Date.now()+__mfSessionHandoffTtlMs});
      return json(res,200,{token,expiresInMs:__mfSessionHandoffTtlMs});
    }

    if(req.method==='POST'&&pathname==='/api/session/handoff/redeem'){
      __mfPruneHandoffs();
      const body=await readJson(req).catch(error=>({__error:error}));
      if(body.__error)return json(res,body.__error.status||400,{error:body.__error.code||'INVALID_REQUEST',message:body.__error.message});
      const token=String(body.token||'').trim();
      const row=__mfSessionHandoffs.get(token);
      // one-time use whether valid or invalid after lookup
      if(token)__mfSessionHandoffs.delete(token);
      if(!row||row.expiresAt<=Date.now())return json(res,410,{error:'SESSION_HANDOFF_EXPIRED',message:'The Phantom session handoff expired. Return to MEMEFLOW and try again.'});
      const secure=__mfSecureCookie(req)?'; Secure':'';
      res.setHeader('Set-Cookie',\`mf_session=\${encodeURIComponent(row.sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000\${secure}\`);
      return json(res,200,{ok:true});
    }
    // /MEMEFLOW_PHANTOM_SESSION_HANDOFF_ROUTES_FIX5

`;
    if(!s.includes(routeAnchor))throw new Error('Anchor not found: live bootstrap route insertion');
    s=s.replace(routeAnchor,routes+routeAnchor);
  }

  fs.writeFileSync(file,s);
}

/* ---------------- CLIENT: create/redeem handoff around Phantom deep-link ---------------- */
{
  const file='phantom-connect-client.mjs';
  let s=fs.readFileSync(file,'utf8');

  if(!s.includes('async function redeemSessionHandoffIfPresent')){
    const anchor=`function openInPhantom(){`;
    const helpers=`async function createSessionHandoff(){
  const result=await api(
    '/api/session/handoff',
    {method:'POST',body:'{}'}
  );
  if(!result?.token)throw new Error('MEMEFLOW could not create a Phantom session handoff.');
  return result.token;
}

async function redeemSessionHandoffIfPresent(){
  const match=String(location.hash||'').match(/(?:^#|&)mf_handoff=([^&]+)/);
  if(!match)return false;

  const token=decodeURIComponent(match[1]);
  const clean=location.pathname+location.search;

  try{
    await api(
      '/api/session/handoff/redeem',
      {method:'POST',body:JSON.stringify({token})}
    );
    history.replaceState(null,'',clean);
    // Reload once so settings/billing/owner state are all fetched under the
    // transferred HttpOnly MEMEFLOW session cookie.
    location.replace(clean);
    return true;
  }catch(error){
    history.replaceState(null,'',clean);
    setMessage(error.message||'MEMEFLOW session handoff failed.',true);
    return false;
  }
}

async function openInPhantom(){`;

    if(!s.includes(anchor))throw new Error('Anchor not found: openInPhantom');
    s=s.replace(anchor,helpers);

    // Replace the old body header portion by inserting handoff target creation
    const old=`  const target=
    encodeURIComponent(
      location.href
    );`;

    const neu=`  let handoffToken='';
  try{
    handoffToken=await createSessionHandoff();
  }catch(error){
    setMessage(error.message||'Could not transfer MEMEFLOW session to Phantom.',true);
    throw error;
  }

  const base=location.origin+location.pathname+location.search;
  const target=
    encodeURIComponent(
      base+'#mf_handoff='+encodeURIComponent(handoffToken)
    );`;

    if(!s.includes(old))throw new Error('Anchor not found: openInPhantom target');
    s=s.replace(old,neu);
  }

  // Make mobile calls await the async deep-link creator.
  s=s.replaceAll(
    `    openInPhantom();
    return null;`,
    `    await openInPhantom();
    return null;`
  );

  // Redeem before any config/settings state is relied upon.
  if(!s.includes('const handoffRedeemed=await redeemSessionHandoffIfPresent()')){
    const bootAnchor=`async function boot(){
  try{`;
    const bootInsert=`async function boot(){
  const handoffRedeemed=await redeemSessionHandoffIfPresent();
  if(handoffRedeemed)return;

  try{`;
    if(!s.includes(bootAnchor))throw new Error('Anchor not found: boot');
    s=s.replace(bootAnchor,bootInsert);
  }

  fs.writeFileSync(file,s);
}

/* ---------------- Cache bump ---------------- */
{
  const file='settings.html';
  let s=fs.readFileSync(file,'utf8');
  s=s.replace(
    /phantom-connect-client\.bundle\.js\?v=[^"'\\s<]+/g,
    'phantom-connect-client.bundle.js?v=phase1-fix5-session-handoff-20260827'
  );
  fs.writeFileSync(file,s);
}
