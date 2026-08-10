from pathlib import Path
import shutil, sys, datetime
ROOT=Path.cwd()
if not (ROOT/"app-server.mjs").exists():
    print("ERROR: run this installer from the memeflow-app folder");sys.exit(1)
stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S");backup=ROOT/f".memeflow-openai-backup-{stamp}";backup.mkdir()
for rel in ["app-server.mjs","index.html",".env.example","src/store.mjs"]:
    p=ROOT/rel
    if p.exists():
        d=backup/rel;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,d)
src=Path(__file__).resolve().parent/"files";(ROOT/"src").mkdir(exist_ok=True);shutil.copy2(src/"src"/"openai-intelligence.mjs",ROOT/"src"/"openai-intelligence.mjs")
server=(ROOT/"app-server.mjs").read_text()
imp="import {OpenAIIntelligence} from './src/openai-intelligence.mjs';"
if imp not in server:
    anchor="import {StripeBilling} from './src/billing.mjs';"
    if anchor not in server: print("ERROR: import anchor not found; backup:",backup);sys.exit(2)
    server=server.replace(anchor,anchor+"\n"+imp,1)
init="""const openaiAI=new OpenAIIntelligence({
  store,
  executeTrade:async({uid,mint,side,amountSol})=>({
    executed:false,error:'LIVE_EXECUTION_NOT_READY',
    message:'AUTO AI is enabled, but the current MEMEFLOW repository still has no verified production wallet execution engine.',
    uid,mint,side,amountSol
  })
});"""
if "const openaiAI=new OpenAIIntelligence(" not in server:
    anchor="const OWNER_USER_IDS=new Set((process.env.OWNER_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));"
    if anchor not in server: print("ERROR: init anchor not found; backup:",backup);sys.exit(3)
    server=server.replace(anchor,anchor+"\n"+init,1)
route=""" if(url.pathname.startsWith('/api/openai/')){
   const aiRoute=await openaiAI.route({req,url,user:u,readBody:async()=>body(req)});
   if(aiRoute)return json(res,aiRoute.status,aiRoute.body);
 }
"""
if "url.pathname.startsWith('/api/openai/')" not in server:
    anchor=" if(url.pathname==='/api/ai/decisions')return json(res,200,{decisions:store.decisions(u.id).map(candidateView)});"
    if anchor not in server: print("ERROR: route anchor not found; backup:",backup);sys.exit(4)
    server=server.replace(anchor,route+anchor,1)
(ROOT/"app-server.mjs").write_text(server)
envp=ROOT/".env.example";env=envp.read_text() if envp.exists() else ""
if "OPENAI_API_KEY=" not in env:
    env+="\n# OpenAI Intelligence — put the real key ONLY in Replit Secrets\nOPENAI_API_KEY=\nOPENAI_MODEL=gpt-5-mini\nOPENAI_TIMEOUT_MS=18000\n";envp.write_text(env)
indexp=ROOT/"index.html"
if indexp.exists():
    idx=indexp.read_text()
    if "MEMEFLOW_OPENAI_CONTROL_CENTER_V1" not in idx:
        snippet=(src/"openai-ui-snippet.html").read_text()
        if "</body>" not in idx: print("ERROR: </body> not found; backend installed, UI not injected. Backup:",backup);sys.exit(5)
        idx=idx.replace("</body>",snippet+"\n</body>",1);indexp.write_text(idx)
(ROOT/".memeflow-openai-last-backup").write_text(str(backup))
print("MEMEFLOW OPENAI PATCH V1 INSTALLED")
print("Backup:",backup)
print("Add OPENAI_API_KEY to Replit Secrets, then restart the project.")
print("ANALYZE / ASSIST / AUTO AI / LEARNING / STRATEGY COACH / AUTO OPTIMIZE are ON per user.")
print("Real BUY/SELL is still blocked until a verified production wallet execution engine is connected.")
