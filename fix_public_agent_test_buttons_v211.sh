#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$PWD}"
APP="$ROOT/memeflow-app"

[ -f "$APP/settings-page.js" ] || { echo "ERROR: run from repository root"; exit 1; }
grep -q "/api/owner/public-agent/test" "$APP/app-server.mjs" || { echo "ERROR: V2.1 test backend is not installed"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.mf-backups/public-agent-v211-$STAMP"
mkdir -p "$BACKUP"
cp "$APP/settings-page.js" "$APP/settings.html" "$BACKUP/"
echo "Backup: $BACKUP"

python3 - "$APP" <<'PY'
from pathlib import Path
import sys

app=Path(sys.argv[1])
f=app/"settings-page.js"
j=f.read_text()

# Add a dedicated visual style instead of inheriting the muted secondary-button look.
css_needle="""      #mfPublicAgentGroup .mf-agent-history{font-size:11px;line-height:1.5;color:var(--muted);white-space:pre-wrap}
      @media(max-width:620px){#mfPublicAgentGroup .mf-agent-events{grid-template-columns:1fr}}"""
css_new="""      #mfPublicAgentGroup .mf-agent-history{font-size:11px;line-height:1.5;color:var(--muted);white-space:pre-wrap}
      #mfPublicAgentGroup .mf-agent-test{min-height:36px;padding:7px 12px;border:1px solid rgba(0,145,255,.38);border-radius:999px;background:rgba(0,145,255,.06);color:var(--text);font-weight:650;opacity:1;cursor:pointer}
      #mfPublicAgentGroup .mf-agent-test:active{transform:translateY(1px)}
      #mfPublicAgentGroup .mf-agent-test:disabled{border-color:var(--line);background:rgba(127,127,127,.08);color:var(--muted);opacity:.46;cursor:not-allowed}
      @media(max-width:620px){#mfPublicAgentGroup .mf-agent-events{grid-template-columns:1fr}}"""
if css_needle not in j:
    raise SystemExit("PATCH ABORTED: V2 Public Agent CSS marker not found")
j=j.replace(css_needle,css_new,1)

# Change only the test buttons to the dedicated class.
j=j.replace('class="mf293-secondary" data-mf-agent-test=', 'class="mf-agent-test" data-mf-agent-test=')

# Make enabled/disabled state reflect saved server config explicitly.
load_needle="""    el('mfEntityEventRisk').checked=e.risk!==false;
    renderQueue(p.queue||[]);renderHistory(p.audit||[]);"""
load_new="""    el('mfEntityEventRisk').checked=e.risk!==false;
    const testsEnabled=c.enabled===true&&c.mode!=='off';
    document.querySelectorAll('[data-mf-agent-test]').forEach(button=>{
      button.disabled=!testsEnabled;
      button.setAttribute('aria-disabled',testsEnabled?'false':'true');
    });
    renderQueue(p.queue||[]);renderHistory(p.audit||[]);"""
if load_needle not in j:
    raise SystemExit("PATCH ABORTED: Public Agent load marker not found")
j=j.replace(load_needle,load_new,1)

f.write_text(j)

hfile=app/"settings.html"
h=hfile.read_text()
for old in [
    "settings-page.js?v=public-agent-entity-v21-test-20260902",
    "settings-page.js?v=public-agent-entity-v2-20260902"
]:
    if old in h:
        h=h.replace(old,"settings-page.js?v=public-agent-entity-v211-testbuttons-20260902")
hfile.write_text(h)
PY

cd "$APP"
node --check settings-page.js
git diff --check

echo
echo "OK — Public Agent test buttons V2.1.1 fixed."
echo "Buttons are active only when the saved entity config is enabled and mode is not OFF."
echo "Backup: $BACKUP"
echo
echo "DO NOT git add . yet."
