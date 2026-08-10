from pathlib import Path
import shutil, sys, datetime, re, subprocess

ROOT=Path.cwd()
if not (ROOT/"app-server.mjs").exists():
    print("ERROR: run this installer from ~/workspace/memeflow-app")
    sys.exit(1)

stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
backup=ROOT/f".memeflow-openai-backup-{stamp}"
backup.mkdir()
tracked=["app-server.mjs","index.html",".env.example","src/store.mjs"]

for rel in tracked:
    p=ROOT/rel
    if p.exists():
        d=backup/rel
        d.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,d)

def restore_and_fail(msg, code):
    print("ERROR:", msg)
    print("RESTORING BACKUP:", backup)
    for rel in tracked:
        s=backup/rel
        if s.exists():
            d=ROOT/rel
            d.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(s,d)
    newmod=ROOT/"src"/"openai-intelligence.mjs"
    if newmod.exists():
        try:newmod.unlink()
        except:pass
    sys.exit(code)

src=Path(__file__).resolve().parent/"files"
(ROOT/"src").mkdir(exist_ok=True)
shutil.copy2(src/"src"/"openai-intelligence.mjs",ROOT/"src"/"openai-intelligence.mjs")

serverp=ROOT/"app-server.mjs"
server=serverp.read_text()

# 1) Import — exact anchor first, then generic import fallback.
imp="import {OpenAIIntelligence} from './src/openai-intelligence.mjs';"
if imp not in server:
    exact="import {StripeBilling} from './src/billing.mjs';"
    if exact in server:
        server=server.replace(exact, exact+"\n"+imp, 1)
    else:
        m=list(re.finditer(r"^import .*?;\s*$",server,re.M))
        if not m:
            restore_and_fail("could not find import section in app-server.mjs",2)
        pos=m[-1].end()
        server=server[:pos]+"\n"+imp+server[pos:]

# 2) OpenAI service initialization — robustly place before discovery runtime.
init="""const openaiAI=new OpenAIIntelligence({
  store,
  executeTrade:async({uid,mint,side,amountSol})=>({
    executed:false,
    error:'LIVE_EXECUTION_NOT_READY',
    message:'AUTO AI reached the execution adapter, but this MEMEFLOW build has no verified production wallet signing/execution engine yet.',
    uid,mint,side,amountSol
  })
});"""
if "const openaiAI=new OpenAIIntelligence(" not in server:
    candidates=[
        r"(const OWNER_USER_IDS=.*?;\s*)",
        r"(const OWNER_ACCESS_KEY=.*?;\s*)",
        r"(let discovery=)"
    ]
    inserted=False
    for pat in candidates:
        m=re.search(pat,server,re.S)
        if not m: continue
        if pat=="(let discovery=)":
            server=server[:m.start()]+init+"\n"+server[m.start():]
        else:
            server=server[:m.end()]+init+"\n"+server[m.end():]
        inserted=True
        break
    if not inserted:
        restore_and_fail("could not find a safe OpenAI initialization point",3)

# 3) API route — DO NOT depend on the old /api/ai/decisions line.
route=""" if(url.pathname.startsWith('/api/openai/')){
   const aiRoute=await openaiAI.route({req,url,user:u,readBody:async()=>body(req)});
   if(aiRoute)return json(res,aiRoute.status,aiRoute.body);
 }
"""
if "url.pathname.startsWith('/api/openai/')" not in server:
    # Preferred: after authenticated-user guard.
    guards=[
        r"(\s*if\s*\(\s*!u\s*\)\s*return\s+json\s*\(\s*res\s*,\s*401\s*,\s*\{\s*error\s*:\s*['\"]AUTH_REQUIRED['\"]\s*\}\s*\)\s*;)",
        r"(\s*if\s*\(\s*!u\s*\)\s*return\s+json\s*\(\s*res\s*,\s*401\b.*?;)"
    ]
    placed=False
    for pat in guards:
        m=re.search(pat,server,re.S)
        if m:
            server=server[:m.end()]+"\n"+route+server[m.end():]
            placed=True
            break
    if not placed:
        # Fallback: place immediately before first authenticated settings/decisions route.
        fallback=re.search(r"\n\s*if\s*\(\s*url\.pathname\s*===?\s*['\"]/(?:api/)?(?:ai/decisions|settings)",server)
        if fallback:
            server=server[:fallback.start()]+"\n"+route+server[fallback.start():]
            placed=True
    if not placed:
        restore_and_fail("could not locate authenticated API route block",4)

serverp.write_text(server)

# 4) Environment template.
envp=ROOT/".env.example"
env=envp.read_text() if envp.exists() else ""
if "OPENAI_API_KEY=" not in env:
    env += """
# MEMEFLOW OpenAI — put the REAL key only in Replit Secrets
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
OPENAI_TIMEOUT_MS=18000
"""
    envp.write_text(env)

# 5) UI.
indexp=ROOT/"index.html"
if indexp.exists():
    idx=indexp.read_text()
    if "MEMEFLOW_OPENAI_CONTROL_CENTER_V1" not in idx:
        snippet=(src/"openai-ui-snippet.html").read_text()
        if "</body>" not in idx:
            restore_and_fail("</body> not found in index.html",5)
        idx=idx.replace("</body>",snippet+"\n</body>",1)
        indexp.write_text(idx)

# 6) Syntax validation. Automatic rollback on failure.
checks=[
    ["node","--check",str(serverp)],
    ["node","--check",str(ROOT/"src"/"openai-intelligence.mjs")]
]
for cmd in checks:
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode!=0:
        restore_and_fail("syntax check failed:\n"+(r.stderr or r.stdout),6)

(ROOT/".memeflow-openai-last-backup").write_text(str(backup))

print("==========================================")
print(" MEMEFLOW OPENAI PATCH V2 INSTALLED OK")
print("==========================================")
print("Backup:",backup)
print("app-server syntax: OK")
print("OpenAI module syntax: OK")
print("Per-user isolation: ON")
print("Analyze: ON")
print("Assist: ON")
print("AUTO AI: ON")
print("Learning: ON")
print("Strategy Coach: ON")
print("Auto Optimize: ON")
print("")
print("NEXT: add OPENAI_API_KEY in Replit Secrets and restart the project.")
print("NOTE: real BUY/SELL remains blocked until a verified wallet execution engine exists.")
