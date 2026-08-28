#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Phantom Account Handoff — FIX 7 =="

if [[ -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" ]]; then
  :
else
  echo "ERROR: app-server.mjs not found. Run from MEMEFLOW repository root." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".phantom-account-handoff-fix7-backup-$STAMP"
mkdir -p "$BACKUP"

for f in app-server.mjs phantom-connect-client.mjs settings.html; do
  [[ -f "$f" ]] && cp -p "$f" "$BACKUP/$f"
done

echo "Backup: $PWD/$BACKUP"

cat > patch-account-handoff-fix7.mjs <<'EOF_PATCH'
import fs from 'node:fs';

function requireText(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`Anchor not found: ${label}`);
}

/* ------------------------------------------------------------------
   SERVER
   Root cause:
   Safari and Phantom use different anonymous mf_session cookies.
   Copying Set-Cookie across the in-app browser is not reliable enough.

   FIX 7 links the Phantom browser's local session to the ORIGINAL
   MEMEFLOW user record server-side. From then on user(req,res) resolves
   the Phantom session to the same owner/Pro/settings/positions account.
   ------------------------------------------------------------------ */
{
  const file = 'app-server.mjs';
  let s = fs.readFileSync(file, 'utf8');

  const oldUser = `function user(req,res){let id=cookies(req).mf_session;if(!id&&ALLOW_ANON){id=sessionId();res.setHeader('Set-Cookie',\`mf_session=\${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000\`)}return id?store.user(id):null}`;

  const newUser = `function user(req,res){
 let id=cookies(req).mf_session;
 if(!id&&ALLOW_ANON){
  id=sessionId();
  res.setHeader('Set-Cookie',\`mf_session=\${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000\`);
 }
 if(!id)return null;
 const local=store.user(id);
 const alias=String(local?.sessionAliasTo||'').trim();
 if(alias&&alias!==id){
  const canonical=store.user(alias);
  if(canonical)return canonical;
 }
 return local;
}`;

  if (!s.includes('sessionAliasTo') || !s.includes('const canonical=store.user(alias)')) {
    requireText(s, oldUser, 'user(req,res)');
    s = s.replace(oldUser, newUser);
  }

  const entitlementAnchor = `function hasLiveEntitlement(u){return Boolean(u?.isOwner||u?.liveEntitled)}`;

  if (!s.includes('MEMEFLOW_ACCOUNT_HANDOFF_FIX7')) {
    requireText(s, entitlementAnchor, 'hasLiveEntitlement');

    const helpers = `${entitlementAnchor}

// MEMEFLOW_ACCOUNT_HANDOFF_FIX7
const __mfAccountHandoffs=new Map();
const __mfAccountHandoffTtlMs=120000;

function __mfPruneAccountHandoffs(){
 const now=Date.now();
 for(const [token,row] of __mfAccountHandoffs){
  if(!row||row.expiresAt<=now)__mfAccountHandoffs.delete(token);
 }
}

function __mfSessionFingerprint(req){
 const raw=String(cookies(req).mf_session||'');
 if(!raw)return null;
 return crypto.createHash('sha256').update(raw).digest('hex').slice(0,12);
}
// /MEMEFLOW_ACCOUNT_HANDOFF_FIX7`;

    s = s.replace(entitlementAnchor, helpers);
  }

  const routeAnchor = ` if(url.pathname==='/api/settings/audit'&&req.method==='GET')`;

  if (!s.includes("url.pathname==='/api/session/handoff-v2/create'")) {
    requireText(s, routeAnchor, 'settings audit route');

    const routes = ` // MEMEFLOW_ACCOUNT_HANDOFF_ROUTES_FIX7
 if(url.pathname==='/api/session/handoff-v2/create'&&req.method==='POST'){
  if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
  __mfPruneAccountHandoffs();
  const token=crypto.randomBytes(32).toString('base64url');
  __mfAccountHandoffs.set(token,{
   sourceUserId:u.id,
   expiresAt:Date.now()+__mfAccountHandoffTtlMs
  });
  return json(res,200,{
   token,
   expiresInMs:__mfAccountHandoffTtlMs,
   source:{
    session:__mfSessionFingerprint(req),
    isOwner:Boolean(u.isOwner),
    liveEntitled:Boolean(u.liveEntitled),
    entitled:hasLiveEntitlement(u)
   }
  });
 }

 if(url.pathname==='/api/session/handoff-v2/redeem'&&req.method==='POST'){
  if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
  __mfPruneAccountHandoffs();
  const b=await body(req);
  const token=String(b.token||'').trim();
  const row=__mfAccountHandoffs.get(token);
  if(token)__mfAccountHandoffs.delete(token);

  if(!row||row.expiresAt<=Date.now()){
   return json(res,410,{
    error:'SESSION_HANDOFF_EXPIRED',
    message:'The MEMEFLOW handoff expired. Return to Safari and open Phantom again.'
   });
  }

  const source=store.user(row.sourceUserId);
  if(!source){
   return json(res,410,{
    error:'SESSION_HANDOFF_SOURCE_MISSING',
    message:'The original MEMEFLOW account is no longer available.'
   });
  }

  const localSessionId=String(cookies(req).mf_session||'').trim();
  if(!localSessionId){
   return json(res,400,{error:'DESTINATION_SESSION_MISSING'});
  }

  const local=store.user(localSessionId);
  if(!local){
   return json(res,400,{error:'DESTINATION_USER_MISSING'});
  }

  // Link this Phantom-browser cookie to the canonical Safari account.
  // We do NOT copy/forge Pro or owner flags. Future requests resolve the
  // canonical source user and therefore follow its CURRENT entitlement.
  local.sessionAliasTo=source.id;
  local.sessionAliasLinkedAt=new Date().toISOString();
  local.sessionAliasSource='phantom_handoff_v2';
  store.save();

  return json(res,200,{
   ok:true,
   destinationSession:__mfSessionFingerprint(req),
   canonicalUserIdHash:crypto.createHash('sha256').update(source.id).digest('hex').slice(0,12),
   isOwner:Boolean(source.isOwner),
   liveEntitled:Boolean(source.liveEntitled),
   entitled:hasLiveEntitlement(source)
  });
 }

 if(url.pathname==='/api/session/status'&&req.method==='GET'){
  return json(res,200,{
   session:__mfSessionFingerprint(req),
   userIdHash:u?crypto.createHash('sha256').update(u.id).digest('hex').slice(0,12):null,
   isOwner:Boolean(u?.isOwner),
   liveEntitled:Boolean(u?.liveEntitled),
   entitled:Boolean(u&&hasLiveEntitlement(u)),
   entitlementSource:u?.isOwner?'owner':u?.liveEntitled?'pro':'none'
  });
 }
 // /MEMEFLOW_ACCOUNT_HANDOFF_ROUTES_FIX7

`;

    s = s.replace(routeAnchor, routes + routeAnchor);
  }

  fs.writeFileSync(file, s);
}

/* ------------------------------------------------------------------
   CLIENT
   Switch handoff from FIX5 bootstrap cookie-copy endpoints to the new
   account-link endpoints in app-server.
   ------------------------------------------------------------------ */
{
  const file = 'phantom-connect-client.mjs';
  let s = fs.readFileSync(file, 'utf8');

  s = s.replaceAll(
    "'/api/session/handoff'",
    "'/api/session/handoff-v2/create'"
  );

  s = s.replaceAll(
    "'/api/session/handoff/redeem'",
    "'/api/session/handoff-v2/redeem'"
  );

  fs.writeFileSync(file, s);
}

/* Cache bust so Phantom/Safari cannot reuse FIX5/FIX6 JS. */
{
  const file = 'settings.html';
  let s = fs.readFileSync(file, 'utf8');

  s = s.replace(
    /phantom-connect-client\.bundle\.js\?v=[^"'\s<]+/g,
    'phantom-connect-client.bundle.js?v=phase1-fix7-account-handoff-20260827'
  );

  fs.writeFileSync(file, s);
}

console.log('FIX 7 account-handoff patch applied.');
EOF_PATCH

echo "Applying FIX 7..."
node patch-account-handoff-fix7.mjs

echo "Rebuilding Phantom Connect..."
npm run build:phantom-connect

echo "Validation..."
node --check app-server.mjs
node --check phantom-connect-client.bundle.js
test -s phantom-connect-client.bundle.js

grep -q "MEMEFLOW_ACCOUNT_HANDOFF_FIX7" app-server.mjs
grep -q "/api/session/handoff-v2/create" app-server.mjs
grep -q "/api/session/handoff-v2/redeem" app-server.mjs
grep -q "sessionAliasTo" app-server.mjs
grep -q "phase1-fix7-account-handoff-20260827" settings.html

echo
echo "== PHANTOM ACCOUNT HANDOFF FIX 7 INSTALLED =="
echo
echo "Root cause fixed at the account layer:"
echo "  Phantom no longer needs to successfully replace Safari's mf_session cookie."
echo "  Its own browser session is securely linked to the original MEMEFLOW user."
echo "  Owner/Pro entitlement is NOT copied as a permanent flag."
echo "  Future requests resolve the original account, so billing cancellation/owner state stays authoritative."
echo
echo "Diagnostic endpoint added:"
echo "  /api/session/status"
echo
echo "Now STOP -> RUN."
echo "Then start from Safari again:"
echo "  System Settings -> Use Phantom wallet -> connect -> Approve each trade."
echo
echo "Expected: the red Pro/owner entitlement error disappears."
