from pathlib import Path
import shutil,sys
ROOT=Path.cwd();m=ROOT/".memeflow-openai-last-backup"
if not m.exists():print("No backup marker found.");sys.exit(1)
b=Path(m.read_text().strip())
if not b.exists():print("Backup folder not found:",b);sys.exit(2)
for rel in ["app-server.mjs","index.html",".env.example","src/store.mjs"]:
    s=b/rel
    if s.exists():
        d=ROOT/rel;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(s,d)
p=ROOT/"src"/"openai-intelligence.mjs"
if p.exists():p.unlink()
print("ROLLBACK COMPLETE:",b)
