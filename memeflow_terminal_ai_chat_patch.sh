#!/usr/bin/env bash
set -euo pipefail

echo "[patch] MEMEFLOW Trading Terminal AI Chat"

# Find app directory
if [ -f "/home/runner/workspace/memeflow-app/trading.html" ]; then
  APP="/home/runner/workspace/memeflow-app"
elif [ -f "./memeflow-app/trading.html" ]; then
  APP="$(cd ./memeflow-app && pwd)"
elif [ -f "./trading.html" ]; then
  APP="$(pwd)"
else
  echo "[patch] ERROR: memeflow-app/trading.html not found"
  exit 1
fi

HTML="$APP/trading.html"
CSS="$APP/trading-ai-chat.css"
JS="$APP/trading-ai-chat.js"

STAMP="$(date +%Y%m%d-%H%M%S)"

cp "$HTML" "$HTML.terminal-ai-chat-$STAMP.bak"

[ -f "$CSS" ] && cp "$CSS" "$CSS.terminal-ai-chat-$STAMP.bak" || true
[ -f "$JS" ] && cp "$JS" "$JS.terminal-ai-chat-$STAMP.bak" || true

# -------------------------------------------------------------------
# CSS
# -------------------------------------------------------------------
cat > "$CSS" <<'CSS'
/* =========================================================
   MEMEFLOW_TRADING_AI_CHAT_V1
   Same MEMEFLOW AI /api/ai/chat, exposed inside Trading Terminal
   ========================================================= */

:root{
  --mf-ai-bg:rgba(10,15,21,.97);
  --mf-ai-panel:rgba(15,22,30,.98);
  --mf-ai-panel-2:rgba(20,29,39,.96);
  --mf-ai-line:rgba(116,150,176,.18);
  --mf-ai-line-strong:rgba(84,221,255,.34);
  --mf-ai-text:#eef5f9;
  --mf-ai-muted:#81909d;
  --mf-ai-cyan:#54ddff;
  --mf-ai-green:#51e7a8;
  --mf-ai-shadow:0 28px 80px rgba(0,0,0,.58);
}

#mfTerminalAiButton{
  position:fixed;
  right:18px;
  bottom:20px;
  z-index:2147482000;
  width:58px;
  height:58px;
  border:1px solid rgba(84,221,255,.28);
  border-radius:18px;
  background:
    linear-gradient(180deg,rgba(20,31,41,.98),rgba(9,14,20,.98));
  color:var(--mf-ai-cyan);
  box-shadow:
    0 16px 42px rgba(0,0,0,.45),
    inset 0 1px 0 rgba(255,255,255,.04);
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  font:800 12px/1 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;
  letter-spacing:.12em;
  transition:
    transform .18s ease,
    border-color .18s ease,
    background .18s ease;
  -webkit-tap-highlight-color:transparent;
}

#mfTerminalAiButton:hover{
  transform:translateY(-2px);
  border-color:rgba(84,221,255,.6);
}

#mfTerminalAiButton[aria-expanded="true"]{
  border-color:rgba(81,231,168,.55);
  color:var(--mf-ai-green);
}

#mfTerminalAiButton .mf-ai-live-dot{
  position:absolute;
  right:7px;
  top:7px;
  width:7px;
  height:7px;
  border-radius:50%;
  background:var(--mf-ai-green);
  box-shadow:0 0 10px rgba(81,231,168,.75);
}

#mfTerminalAiOverlay{
  display:none;
}

#mfTerminalAiDrawer{
  position:fixed;
  right:18px;
  bottom:90px;
  z-index:2147482001;
  width:min(410px,calc(100vw - 36px));
  height:min(680px,calc(100dvh - 120px));
  border:1px solid var(--mf-ai-line);
  border-radius:22px;
  overflow:hidden;
  background:
    radial-gradient(circle at 82% -10%,rgba(84,221,255,.08),transparent 38%),
    var(--mf-ai-bg);
  box-shadow:var(--mf-ai-shadow);
  backdrop-filter:blur(24px);
  -webkit-backdrop-filter:blur(24px);
  display:flex;
  flex-direction:column;
  opacity:0;
  pointer-events:none;
  transform:translateY(12px) scale(.985);
  transform-origin:bottom right;
  transition:
    opacity .18s ease,
    transform .18s ease;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}

#mfTerminalAiDrawer.mf-ai-open{
  opacity:1;
  pointer-events:auto;
  transform:none;
}

.mf-ai-header{
  flex:none;
  min-height:73px;
  padding:14px 15px;
  border-bottom:1px solid var(--mf-ai-line);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  background:rgba(10,15,21,.72);
}

.mf-ai-title-wrap{
  min-width:0;
}

.mf-ai-eyebrow{
  color:var(--mf-ai-cyan);
  font-size:8px;
  font-weight:800;
  letter-spacing:.16em;
  text-transform:uppercase;
  margin-bottom:5px;
}

.mf-ai-title{
  color:var(--mf-ai-text);
  font-size:14px;
  font-weight:800;
  letter-spacing:.01em;
}

.mf-ai-subtitle{
  color:var(--mf-ai-muted);
  font-size:9px;
  margin-top:3px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

#mfTerminalAiClose{
  width:36px;
  height:36px;
  flex:none;
  border:1px solid var(--mf-ai-line);
  border-radius:11px;
  background:rgba(255,255,255,.018);
  color:#aab8c3;
  cursor:pointer;
  font-size:19px;
  line-height:1;
}

.mf-ai-context-row{
  flex:none;
  min-height:42px;
  padding:8px 13px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  border-bottom:1px solid rgba(116,150,176,.10);
  background:rgba(255,255,255,.012);
}

.mf-ai-context-label{
  color:#687783;
  font-size:8px;
  font-weight:750;
  letter-spacing:.13em;
  text-transform:uppercase;
}

#mfTerminalAiContext{
  max-width:75%;
  color:#aab7c1;
  font-size:9px;
  font-weight:700;
  padding:5px 8px;
  border:1px solid rgba(84,221,255,.14);
  border-radius:999px;
  background:rgba(84,221,255,.035);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

#mfTerminalAiMessages{
  flex:1;
  min-height:0;
  overflow:auto;
  overscroll-behavior:contain;
  padding:16px 13px 10px;
  display:flex;
  flex-direction:column;
  gap:11px;
  scrollbar-width:thin;
  scrollbar-color:rgba(129,144,157,.25) transparent;
}

.mf-ai-message{
  display:flex;
  flex-direction:column;
  gap:4px;
  max-width:91%;
}

.mf-ai-message.user{
  align-self:flex-end;
}

.mf-ai-message.assistant{
  align-self:flex-start;
}

.mf-ai-message-label{
  color:#64727f;
  font-size:7px;
  font-weight:800;
  letter-spacing:.13em;
  text-transform:uppercase;
  padding:0 4px;
}

.mf-ai-message.user .mf-ai-message-label{
  text-align:right;
}

.mf-ai-bubble{
  padding:10px 12px;
  border:1px solid var(--mf-ai-line);
  border-radius:14px;
  color:#dbe5eb;
  background:rgba(18,26,35,.86);
  font-size:11px;
  line-height:1.55;
  white-space:pre-wrap;
  overflow-wrap:anywhere;
}

.mf-ai-message.user .mf-ai-bubble{
  color:#eafcff;
  border-color:rgba(84,221,255,.20);
  background:rgba(84,221,255,.075);
  border-bottom-right-radius:5px;
}

.mf-ai-message.assistant .mf-ai-bubble{
  border-bottom-left-radius:5px;
}

.mf-ai-message.error .mf-ai-bubble{
  border-color:rgba(255,101,118,.28);
  color:#ffb3bd;
  background:rgba(255,101,118,.055);
}

.mf-ai-thinking{
  display:inline-flex;
  align-items:center;
  gap:4px;
  min-height:13px;
}

.mf-ai-thinking i{
  width:4px;
  height:4px;
  border-radius:50%;
  background:#82919d;
  animation:mfAiPulse 1.05s infinite ease-in-out;
}

.mf-ai-thinking i:nth-child(2){animation-delay:.14s}
.mf-ai-thinking i:nth-child(3){animation-delay:.28s}

@keyframes mfAiPulse{
  0%,70%,100%{opacity:.3;transform:translateY(0)}
  35%{opacity:1;transform:translateY(-2px)}
}

.mf-ai-suggestions{
  flex:none;
  display:flex;
  gap:6px;
  overflow-x:auto;
  padding:0 13px 9px;
  scrollbar-width:none;
}

.mf-ai-suggestions::-webkit-scrollbar{
  display:none;
}

.mf-ai-suggestion{
  flex:none;
  border:1px solid rgba(116,150,176,.14);
  border-radius:999px;
  background:rgba(255,255,255,.018);
  color:#81919d;
  min-height:28px;
  padding:5px 9px;
  font-size:8px;
  font-weight:700;
  cursor:pointer;
  white-space:nowrap;
}

.mf-ai-suggestion:hover{
  color:#d9f7ff;
  border-color:rgba(84,221,255,.30);
}

.mf-ai-compose{
  flex:none;
  padding:10px 11px calc(11px + env(safe-area-inset-bottom,0px));
  border-top:1px solid var(--mf-ai-line);
  background:rgba(7,11,16,.90);
}

.mf-ai-input-wrap{
  min-height:48px;
  padding:6px 6px 6px 11px;
  display:flex;
  align-items:flex-end;
  gap:7px;
  border:1px solid rgba(116,150,176,.18);
  border-radius:15px;
  background:rgba(17,25,34,.82);
}

#mfTerminalAiInput{
  flex:1;
  min-width:0;
  max-height:112px;
  resize:none;
  border:0;
  outline:0;
  background:transparent;
  color:var(--mf-ai-text);
  font:500 11px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;
  padding:7px 0;
}

#mfTerminalAiInput::placeholder{
  color:#63727e;
}

#mfTerminalAiSend{
  width:37px;
  height:37px;
  flex:none;
  border:1px solid rgba(84,221,255,.26);
  border-radius:11px;
  background:rgba(84,221,255,.10);
  color:var(--mf-ai-cyan);
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  font-size:17px;
}

#mfTerminalAiSend:disabled{
  opacity:.35;
  cursor:default;
}

.mf-ai-footnote{
  margin-top:5px;
  color:#52616d;
  font-size:7px;
  text-align:center;
  letter-spacing:.04em;
}

@media (max-width:720px){
  #mfTerminalAiButton{
    right:14px;
    bottom:calc(14px + env(safe-area-inset-bottom,0px));
    width:54px;
    height:54px;
    border-radius:17px;
  }

  #mfTerminalAiOverlay{
    position:fixed;
    inset:0;
    z-index:2147481999;
    background:rgba(0,0,0,.42);
    backdrop-filter:blur(2px);
    -webkit-backdrop-filter:blur(2px);
  }

  #mfTerminalAiOverlay.mf-ai-open{
    display:block;
  }

  #mfTerminalAiDrawer{
    left:8px;
    right:8px;
    bottom:calc(8px + env(safe-area-inset-bottom,0px));
    width:auto;
    height:min(78dvh,720px);
    max-height:calc(100dvh - 20px - env(safe-area-inset-bottom,0px));
    border-radius:21px;
    transform:translateY(24px);
    transform-origin:bottom center;
  }

  #mfTerminalAiDrawer.mf-ai-open{
    transform:none;
  }

  #mfTerminalAiButton[aria-expanded="true"]{
    opacity:0;
    pointer-events:none;
  }

  .mf-ai-header{
    min-height:67px;
  }

  .mf-ai-bubble{
    font-size:12px;
  }

  #mfTerminalAiInput{
    font-size:16px; /* prevents iOS Safari zoom */
  }
}
CSS

# -------------------------------------------------------------------
# JS
# -------------------------------------------------------------------
cat > "$JS" <<'JS'
/* =========================================================
   MEMEFLOW_TRADING_AI_CHAT_V1
   UI-only bridge to the SAME /api/ai/chat backend.
   No second AI. No duplicate score. No trading logic changes.
   ========================================================= */

(() => {
  'use strict';

  if (window.__mfTradingAiChatV1) return;
  window.__mfTradingAiChatV1 = true;

  const history = [];
  let busy = false;
  let opened = false;

  function shortMint(value) {
    const v = String(value || '').trim();
    if (!v) return '';
    if (v.length <= 18) return v;
    return `${v.slice(0,7)}…${v.slice(-6)}`;
  }

  function currentMint() {
    // trading.js puts the FULL selected mint on tokenAvatar.dataset.mint.
    const avatar = document.getElementById('tokenAvatar');
    const fromAvatar = String(avatar?.dataset?.mint || '').trim();

    if (fromAvatar && fromAvatar.length > 20) {
      return fromAvatar;
    }

    // Secondary source: active candidate button.
    const active = document.querySelector(
      '#candidateList .candidate.active[data-mint], ' +
      '#candidateList .candidate[data-mint][aria-selected="true"]'
    );

    const fromCandidate = String(active?.dataset?.mint || '').trim();

    if (fromCandidate && fromCandidate.length > 20) {
      return fromCandidate;
    }

    return '';
  }

  function currentTokenName() {
    const text = String(
      document.getElementById('tokenName')?.textContent || ''
    ).trim();

    if (
      !text ||
      /^select a candidate$/i.test(text)
    ) {
      return '';
    }

    return text;
  }

  function mount() {
    if (document.getElementById('mfTerminalAiDrawer')) return;

    const overlay = document.createElement('div');
    overlay.id = 'mfTerminalAiOverlay';
    overlay.setAttribute('aria-hidden', 'true');

    const button = document.createElement('button');
    button.id = 'mfTerminalAiButton';
    button.type = 'button';
    button.setAttribute('aria-label', 'Open MEMEFLOW AI');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = `
      AI
      <span class="mf-ai-live-dot" aria-hidden="true"></span>
    `;

    const drawer = document.createElement('section');
    drawer.id = 'mfTerminalAiDrawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'MEMEFLOW AI');
    drawer.setAttribute('aria-hidden', 'true');

    drawer.innerHTML = `
      <div class="mf-ai-header">
        <div class="mf-ai-title-wrap">
          <div class="mf-ai-eyebrow">MEMEFLOW INTELLIGENCE</div>
          <div class="mf-ai-title">AI Trading Chat</div>
          <div class="mf-ai-subtitle">Trading decisions · system memory · token context</div>
        </div>
        <button id="mfTerminalAiClose" type="button" aria-label="Close AI chat">×</button>
      </div>

      <div class="mf-ai-context-row">
        <span class="mf-ai-context-label">Context</span>
        <span id="mfTerminalAiContext">SYSTEM</span>
      </div>

      <div id="mfTerminalAiMessages" aria-live="polite"></div>

      <div class="mf-ai-suggestions">
        <button class="mf-ai-suggestion" type="button" data-mf-prompt="Why did you buy or consider buying this token?">WHY BUY?</button>
        <button class="mf-ai-suggestion" type="button" data-mf-prompt="Why did you sell or consider selling this token?">WHY SELL?</button>
        <button class="mf-ai-suggestion" type="button" data-mf-prompt="What is happening with this token right now and what are the main risks?">WHAT NOW?</button>
        <button class="mf-ai-suggestion" type="button" data-mf-prompt="Explain the most recent trading decision in the system.">LAST DECISION</button>
      </div>

      <div class="mf-ai-compose">
        <div class="mf-ai-input-wrap">
          <textarea
            id="mfTerminalAiInput"
            rows="1"
            autocomplete="off"
            autocapitalize="sentences"
            spellcheck="true"
            placeholder="Ask about a trade, token or decision…"
          ></textarea>
          <button id="mfTerminalAiSend" type="button" aria-label="Send">↑</button>
        </div>
        <div class="mf-ai-footnote">Same MEMEFLOW AI · same trading memory</div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(button);
    document.body.appendChild(drawer);

    button.addEventListener('click', () => setOpen(!opened));
    overlay.addEventListener('click', () => setOpen(false));
    document
      .getElementById('mfTerminalAiClose')
      ?.addEventListener('click', () => setOpen(false));

    document
      .getElementById('mfTerminalAiSend')
      ?.addEventListener('click', () => send());

    const input = document.getElementById('mfTerminalAiInput');

    input?.addEventListener('keydown', event => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        send();
      }
    });

    input?.addEventListener('input', autoSizeInput);

    drawer.querySelectorAll('.mf-ai-suggestion').forEach(node => {
      node.addEventListener('click', () => {
        const prompt = String(node.dataset.mfPrompt || '');
        if (!prompt) return;

        const input = document.getElementById('mfTerminalAiInput');
        if (input) {
          input.value = prompt;
          autoSizeInput();
        }

        send();
      });
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && opened) {
        setOpen(false);
      }
    });

    addMessage(
      'assistant',
      'Ask me why MEMEFLOW bought, sold, watched or blocked a token. I can also explain the latest trading decision and what the system saw.'
    );

    watchSelectedToken();
    updateContext();
  }

  function setOpen(value) {
    opened = Boolean(value);

    const drawer = document.getElementById('mfTerminalAiDrawer');
    const overlay = document.getElementById('mfTerminalAiOverlay');
    const button = document.getElementById('mfTerminalAiButton');

    drawer?.classList.toggle('mf-ai-open', opened);
    overlay?.classList.toggle('mf-ai-open', opened);

    drawer?.setAttribute('aria-hidden', opened ? 'false' : 'true');
    overlay?.setAttribute('aria-hidden', opened ? 'false' : 'true');
    button?.setAttribute('aria-expanded', opened ? 'true' : 'false');

    if (opened) {
      updateContext();

      setTimeout(() => {
        document.getElementById('mfTerminalAiInput')?.focus({
          preventScroll:true
        });
      }, 120);
    }
  }

  function updateContext() {
    const badge = document.getElementById('mfTerminalAiContext');
    if (!badge) return;

    const mint = currentMint();
    const name = currentTokenName();

    if (!mint) {
      badge.textContent = 'SYSTEM';
      badge.title = 'System-wide trading memory';
      return;
    }

    badge.textContent = name
      ? `${name} · ${shortMint(mint)}`
      : shortMint(mint);

    badge.title = mint;
  }

  function watchSelectedToken() {
    const avatar = document.getElementById('tokenAvatar');
    const name = document.getElementById('tokenName');
    const list = document.getElementById('candidateList');

    const observer = new MutationObserver(() => {
      updateContext();
    });

    if (avatar) {
      observer.observe(avatar, {
        attributes:true,
        attributeFilter:['data-mint'],
        childList:true
      });
    }

    if (name) {
      observer.observe(name, {
        childList:true,
        subtree:true,
        characterData:true
      });
    }

    if (list) {
      observer.observe(list, {
        attributes:true,
        subtree:true,
        attributeFilter:['class','aria-selected']
      });
    }
  }

  function addMessage(role, text, options = {}) {
    const container = document.getElementById('mfTerminalAiMessages');
    if (!container) return null;

    const wrap = document.createElement('div');
    wrap.className =
      `mf-ai-message ${role}` +
      (options.error ? ' error' : '');

    const label = document.createElement('div');
    label.className = 'mf-ai-message-label';
    label.textContent = role === 'user' ? 'YOU' : 'MEMEFLOW AI';

    const bubble = document.createElement('div');
    bubble.className = 'mf-ai-bubble';
    bubble.textContent = String(text || '');

    wrap.appendChild(label);
    wrap.appendChild(bubble);
    container.appendChild(wrap);

    container.scrollTop = container.scrollHeight;
    return wrap;
  }

  function addThinking() {
    const container = document.getElementById('mfTerminalAiMessages');
    if (!container) return null;

    const wrap = document.createElement('div');
    wrap.className = 'mf-ai-message assistant';
    wrap.dataset.thinking = '1';

    const label = document.createElement('div');
    label.className = 'mf-ai-message-label';
    label.textContent = 'MEMEFLOW AI';

    const bubble = document.createElement('div');
    bubble.className = 'mf-ai-bubble';
    bubble.innerHTML = `
      <span class="mf-ai-thinking" aria-label="Thinking">
        <i></i><i></i><i></i>
      </span>
    `;

    wrap.appendChild(label);
    wrap.appendChild(bubble);
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;

    return wrap;
  }

  function normalizeAnswer(payload) {
    const possible = [
      payload?.answer,
      payload?.reply,
      payload?.text,
      payload?.output_text,
      payload?.message,
      payload?.result?.answer,
      payload?.result?.reply,
      payload?.result?.text,
      payload?.response?.answer,
      payload?.response?.text,
      payload?.response?.output_text
    ];

    for (const value of possible) {
      if (
        typeof value === 'string' &&
        value.trim()
      ) {
        return value.trim();
      }
    }

    // Responses API-like output fallback
    const output = payload?.output || payload?.response?.output;

    if (Array.isArray(output)) {
      const texts = [];

      for (const item of output) {
        if (!Array.isArray(item?.content)) continue;

        for (const part of item.content) {
          if (
            typeof part?.text === 'string' &&
            part.text.trim()
          ) {
            texts.push(part.text.trim());
          }
        }
      }

      if (texts.length) return texts.join('\n\n');
    }

    return 'The AI response was received, but it did not contain displayable text.';
  }

  async function send() {
    if (busy) return;

    const input = document.getElementById('mfTerminalAiInput');
    const sendButton = document.getElementById('mfTerminalAiSend');

    const message = String(input?.value || '').trim();
    if (!message) return;

    const mint = currentMint();

    busy = true;
    if (sendButton) sendButton.disabled = true;

    addMessage('user', message);

    history.push({
      role:'user',
      content:message
    });

    // Keep the conversation bounded; server-side trading journal remains
    // the persistent system memory.
    while (history.length > 16) {
      history.shift();
    }

    if (input) {
      input.value = '';
      autoSizeInput();
    }

    const thinking = addThinking();

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      45000
    );

    try {
      const response = await fetch('/api/ai/chat', {
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{
          'content-type':'application/json',
          'accept':'application/json'
        },
        body:JSON.stringify({
          message,
          mint:mint || '',
          messages:history.slice(-12)
        }),
        signal:controller.signal
      });

      let payload = {};

      try {
        payload = await response.json();
      } catch {}

      if (!response.ok) {
        throw new Error(
          payload?.message ||
          payload?.error ||
          `AI request failed (${response.status})`
        );
      }

      const answer = normalizeAnswer(payload);

      thinking?.remove();
      addMessage('assistant', answer);

      history.push({
        role:'assistant',
        content:answer
      });

      while (history.length > 16) {
        history.shift();
      }

    } catch (error) {
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
    } finally {
      clearTimeout(timeout);
      busy = false;
      if (sendButton) sendButton.disabled = false;
      input?.focus({preventScroll:true});
    }
  }

  function autoSizeInput() {
    const input = document.getElementById('mfTerminalAiInput');
    if (!input) return;

    input.style.height = 'auto';
    input.style.height =
      `${Math.min(112, Math.max(34, input.scrollHeight))}px`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, {once:true});
  } else {
    mount();
  }
})();
JS

# -------------------------------------------------------------------
# Inject CSS + JS into trading.html
# -------------------------------------------------------------------
python3 - "$HTML" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

css_marker = "MEMEFLOW_TRADING_AI_CHAT_V1_CSS"
js_marker = "MEMEFLOW_TRADING_AI_CHAT_V1_JS"

if css_marker not in text:
    css = """
  <!-- MEMEFLOW_TRADING_AI_CHAT_V1_CSS -->
  <link rel="stylesheet" href="/trading-ai-chat.css?v=1">
"""
    if "</head>" not in text:
        raise SystemExit("[patch] ERROR: </head> not found in trading.html")
    text = text.replace("</head>", css + "</head>", 1)

if js_marker not in text:
    js = """
  <!-- MEMEFLOW_TRADING_AI_CHAT_V1_JS -->
  <script type="module" src="/trading-ai-chat.js?v=1"></script>
"""
    if "</body>" not in text:
        raise SystemExit("[patch] ERROR: </body> not found in trading.html")
    text = text.replace("</body>", js + "</body>", 1)

path.write_text(text, encoding="utf-8")
PY

# -------------------------------------------------------------------
# Validation
# -------------------------------------------------------------------
node --check "$JS"

grep -q "MEMEFLOW_TRADING_AI_CHAT_V1_CSS" "$HTML"
grep -q "MEMEFLOW_TRADING_AI_CHAT_V1_JS" "$HTML"
grep -q "/api/ai/chat" "$JS"
grep -q "tokenAvatar" "$JS"

echo
echo "[patch] files updated"
echo "[patch] SUCCESS"
echo "[patch] Added the SAME MEMEFLOW AI chat to Trading Terminal"
echo "[patch] Backend trading logic: UNCHANGED"
echo "[patch] Score logic: UNCHANGED"
echo "[patch] AI memory/journal backend: REUSED"
echo "[patch] Selected token mint: AUTO-CONTEXT"
echo
echo "[patch] Modified:"
echo "  $HTML"
echo "[patch] Created:"
echo "  $CSS"
echo "  $JS"
echo
echo "[patch] Backup:"
echo "  $HTML.terminal-ai-chat-$STAMP.bak"
echo
echo "[patch] Restart the Replit app, then open /trading.html"
