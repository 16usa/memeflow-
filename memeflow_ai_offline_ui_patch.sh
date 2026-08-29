#!/usr/bin/env bash
set -euo pipefail

echo "[patch] MEMEFLOW AI graceful offline state"

if [ -f "/home/runner/workspace/memeflow-app/trading-ai-chat.js" ]; then
  APP="/home/runner/workspace/memeflow-app"
elif [ -f "./memeflow-app/trading-ai-chat.js" ]; then
  APP="$(cd ./memeflow-app && pwd)"
else
  echo "[patch] ERROR: trading-ai-chat.js not found"
  exit 1
fi

JS="$APP/trading-ai-chat.js"
CSS="$APP/trading-ai-chat.css"

if [ ! -f "$CSS" ]; then
  echo "[patch] ERROR: trading-ai-chat.css not found"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"

cp "$JS" "$JS.ai-offline-$STAMP.bak"
cp "$CSS" "$CSS.ai-offline-$STAMP.bak"

python3 - "$JS" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

MARKER = "MEMEFLOW_AI_GRACEFUL_OFFLINE_V1"

if MARKER in text:
    print("[patch] JS already patched")
    raise SystemExit(0)

anchor = """  let busy = false;
  let opened = false;
"""

insert = """  let busy = false;
  let opened = false;

  /* MEMEFLOW_AI_GRACEFUL_OFFLINE_V1 */

  function setAiAvailability(mode = 'online') {
    const drawer = document.getElementById('mfTerminalAiDrawer');
    const button = document.getElementById('mfTerminalAiButton');
    const subtitle = drawer?.querySelector('.mf-ai-subtitle');
    const dot = button?.querySelector('.mf-ai-live-dot');

    if (drawer) {
      drawer.dataset.aiStatus = mode;
    }

    if (button) {
      button.dataset.aiStatus = mode;
    }

    if (dot) {
      dot.dataset.aiStatus = mode;
    }

    if (!subtitle) return;

    if (mode === 'offline') {
      subtitle.textContent =
        'AI temporarily offline · trading engine continues normally';
      return;
    }

    if (mode === 'connecting') {
      subtitle.textContent =
        'Connecting to MEMEFLOW Intelligence…';
      return;
    }

    subtitle.textContent =
      'Trading decisions · system memory · token context';
  }

  function classifyAiError(error) {
    const raw = String(
      error?.message ||
      error?.payload?.message ||
      error?.payload?.error ||
      ''
    );

    const quotaOrBilling =
      /no credits remaining/i.test(raw) ||
      /insufficient[_ -]?quota/i.test(raw) ||
      /billing/i.test(raw) ||
      /credit balance/i.test(raw) ||
      /quota exceeded/i.test(raw) ||
      /usage limit/i.test(raw);

    if (quotaOrBilling) {
      return {
        status: 'offline',
        text:
          'MEMEFLOW Intelligence is temporarily offline. ' +
          'The trading engine, scanner, risk filters and trade management ' +
          'continue operating normally.'
      };
    }

    if (error?.name === 'AbortError') {
      return {
        status: 'offline',
        text:
          'MEMEFLOW Intelligence did not respond in time. ' +
          'Trading continues normally without waiting for the chat.'
      };
    }

    return {
      status: 'offline',
      text:
        'MEMEFLOW Intelligence is temporarily unavailable. ' +
        'Trading continues normally. Please try again shortly.'
    };
  }
"""

if anchor not in text:
    raise SystemExit("[patch] ERROR: expected JS anchor not found")

text = text.replace(anchor, insert, 1)

old_fetch = """    try {
      const response = await fetch('/api/ai/chat', {
"""

new_fetch = """    try {
      setAiAvailability('connecting');

      const response = await fetch('/api/ai/chat', {
"""

if old_fetch not in text:
    raise SystemExit("[patch] ERROR: fetch anchor not found")

text = text.replace(old_fetch, new_fetch, 1)

old_success = """      const answer = normalizeAnswer(payload);

      thinking?.remove();
      addMessage('assistant', answer);
"""

new_success = """      const answer = normalizeAnswer(payload);

      setAiAvailability('online');

      thinking?.remove();
      addMessage('assistant', answer);
"""

if old_success not in text:
    raise SystemExit("[patch] ERROR: success anchor not found")

text = text.replace(old_success, new_success, 1)

old_catch = """    } catch (error) {
      thinking?.remove();

      const message =
        error?.name === 'AbortError'
          ? 'AI request timed out. The trading engine was not blocked; try the question again.'
          : String(
              error?.message ||
              'AI chat is temporarily unavailable.'
            );

      addMessage(
        'assistant',
        message,
        {error:true}
      );
"""

new_catch = """    } catch (error) {
      thinking?.remove();

      const friendly = classifyAiError(error);

      setAiAvailability(friendly.status);

      addMessage(
        'assistant',
        friendly.text,
        {error:true}
      );
"""

if old_catch not in text:
    raise SystemExit(
        "[patch] ERROR: catch block not found. "
        "The local chat file differs from expected version."
    )

text = text.replace(old_catch, new_catch, 1)

path.write_text(text, encoding="utf-8")
print("[patch] JS updated")
PY

cat >> "$CSS" <<'CSS'

/* =========================================================
   MEMEFLOW_AI_GRACEFUL_OFFLINE_V1
   Friendly AI availability states.
   Trading engine remains independent.
   ========================================================= */

#mfTerminalAiButton[data-ai-status="offline"]{
  color:#94a0aa;
  border-color:rgba(148,160,170,.22);
}

#mfTerminalAiButton[data-ai-status="offline"] .mf-ai-live-dot,
#mfTerminalAiButton .mf-ai-live-dot[data-ai-status="offline"]{
  background:#7d8993;
  box-shadow:none;
}

#mfTerminalAiButton[data-ai-status="connecting"] .mf-ai-live-dot,
#mfTerminalAiButton .mf-ai-live-dot[data-ai-status="connecting"]{
  background:#54ddff;
  box-shadow:0 0 10px rgba(84,221,255,.62);
  animation:mfAiStatusPulse 1.15s ease-in-out infinite;
}

#mfTerminalAiDrawer[data-ai-status="offline"] .mf-ai-subtitle{
  color:#8e9ba6;
}

#mfTerminalAiDrawer[data-ai-status="offline"] .mf-ai-eyebrow{
  color:#8e9ba6;
}

#mfTerminalAiDrawer[data-ai-status="offline"] .mf-ai-message.error .mf-ai-bubble{
  border-color:rgba(148,160,170,.18);
  background:rgba(148,160,170,.045);
  color:#aeb9c2;
}

@keyframes mfAiStatusPulse{
  0%,100%{
    opacity:.35;
    transform:scale(.88);
  }
  50%{
    opacity:1;
    transform:scale(1);
  }
}
CSS

node --check "$JS"

grep -q "MEMEFLOW_AI_GRACEFUL_OFFLINE_V1" "$JS"
grep -q "MEMEFLOW_AI_GRACEFUL_OFFLINE_V1" "$CSS"

echo
echo "[patch] SUCCESS"
echo
echo "[patch] OpenAI raw billing/quota errors are now hidden"
echo "[patch] Friendly message: AI temporarily offline"
echo "[patch] Trading Engine remains independent and unchanged"
echo "[patch] Scanner unchanged"
echo "[patch] Score unchanged"
echo "[patch] BUY/SELL logic unchanged"
echo "[patch] Risk engine unchanged"
echo
echo "[patch] Backups:"
echo "  $JS.ai-offline-$STAMP.bak"
echo "  $CSS.ai-offline-$STAMP.bak"
echo
echo "[patch] Restart the Replit app and reload Trading Terminal"
