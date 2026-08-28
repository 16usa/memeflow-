#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Owner Access — FIX 8 =="

if [[ -f "memeflow-app/settings.html" ]]; then
  cd memeflow-app
elif [[ -f "settings.html" ]]; then
  :
else
  echo "ERROR: settings.html not found. Run from MEMEFLOW repository root." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".owner-access-fix8-backup-$STAMP"
mkdir -p "$BACKUP"

for f in settings.html owner-access.js owner-access.css; do
  [[ -f "$f" ]] && cp -p "$f" "$BACKUP/$f"
done

echo "Backup: $PWD/$BACKUP"

cat > owner-access.js <<'EOF_JS'
(() => {
  const $ = id => document.getElementById(id);

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        accept: 'application/json',
        ...(options.body ? {'content-type': 'application/json'} : {}),
        ...(options.headers || {})
      }
    });

    let data = {};
    try { data = await response.json(); } catch {}

    if (!response.ok) {
      const error = new Error(
        data.message ||
        data.error ||
        `HTTP ${response.status}`
      );
      error.status = response.status;
      error.code = data.error || '';
      throw error;
    }

    return data;
  }

  function setMessage(text = '', bad = false) {
    const node = $('mfOwnerAccessMessage');
    if (!node) return;
    node.hidden = !text;
    node.textContent = text;
    node.classList.toggle('bad', bad);
  }

  function renderActive() {
    const panel = $('mfOwnerAccessPanel');
    if (!panel) return;

    panel.classList.add('active');

    const status = $('mfOwnerAccessStatus');
    if (status) status.textContent = 'OWNER LIVE ACCESS ACTIVE';

    const form = $('mfOwnerAccessForm');
    if (form) form.hidden = true;

    setMessage(
      'This browser session has verified owner entitlement. LIVE mode may now be armed after wallet connection.'
    );
  }

  async function refresh() {
    try {
      const status = await api('/api/owner/status');

      if (status?.isOwner) {
        renderActive();
        return;
      }

      const badge = $('mfOwnerAccessStatus');
      if (badge) badge.textContent = 'OWNER ACCESS NOT ACTIVE';
    } catch (error) {
      setMessage(
        error.message || 'Could not read owner status.',
        true
      );
    }
  }

  async function claim(event) {
    event.preventDefault();

    const input = $('mfOwnerAccessKey');
    const button = $('mfOwnerAccessButton');

    const ownerAccessKey = String(input?.value || '').trim();

    if (!ownerAccessKey) {
      setMessage('Enter the OWNER_ACCESS_KEY configured in Replit Secrets.', true);
      return;
    }

    if (button) button.disabled = true;
    setMessage();

    try {
      const result = await api('/api/owner/claim', {
        method: 'POST',
        body: JSON.stringify({ownerAccessKey})
      });

      if (input) input.value = '';

      if (result?.isOwner) {
        renderActive();

        // Refresh all server-backed settings under the newly entitled session.
        setTimeout(() => location.reload(), 450);
        return;
      }

      setMessage('Owner activation did not complete.', true);
    } catch (error) {
      if (input) input.value = '';

      if (error.code === 'OWNER_ACCESS_NOT_CONFIGURED') {
        setMessage(
          'OWNER_ACCESS_KEY is not configured on the server. Add it in Replit Secrets, then STOP → RUN.',
          true
        );
      } else if (error.code === 'INVALID_OWNER_ACCESS_KEY') {
        setMessage('The owner access key is incorrect.', true);
      } else {
        setMessage(
          error.message || 'Owner activation failed.',
          true
        );
      }
    } finally {
      if (button) button.disabled = false;
    }
  }

  function install() {
    if ($('mfOwnerAccessPanel')) return true;

    const wallet =
      $('mfAccountWalletGroup') ||
      document.querySelector('[data-settings-group="wallet"]');

    if (!wallet) return false;

    const panel = document.createElement('div');
    panel.id = 'mfOwnerAccessPanel';
    panel.className = 'mf-owner-access';

    panel.innerHTML = `
      <div class="mf-owner-access-head">
        <div>
          <b>Owner access</b>
          <small>Private project-owner entitlement</small>
        </div>
        <span id="mfOwnerAccessStatus">CHECKING…</span>
      </div>

      <form id="mfOwnerAccessForm" class="mf-owner-access-form">
        <input
          id="mfOwnerAccessKey"
          type="password"
          inputmode="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="OWNER_ACCESS_KEY"
          aria-label="Owner access key"
        >

        <button id="mfOwnerAccessButton" type="submit">
          Activate owner access
        </button>
      </form>

      <div class="mf-owner-access-note">
        The key is sent only to <code>/api/owner/claim</code> over this HTTPS session.
        MEMEFLOW does not store the entered key in the browser.
      </div>

      <div id="mfOwnerAccessMessage" class="mf-owner-access-message" hidden></div>
    `;

    wallet.appendChild(panel);

    $('mfOwnerAccessForm')?.addEventListener('submit', claim);

    refresh();
    return true;
  }

  async function boot() {
    for (let i = 0; i < 100; i++) {
      if (install()) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.error('MEMEFLOW Owner Access: Wallet settings group not found.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once: true});
  } else {
    boot();
  }
})();
EOF_JS

cat > owner-access.css <<'EOF_CSS'
.mf-owner-access{
  margin-top:10px;
  padding:12px;
  border:1px solid var(--line,#28333e);
  border-radius:13px;
  background:rgba(255,255,255,.012)
}

.mf-owner-access.active{
  border-color:rgba(81,231,168,.28);
}

.mf-owner-access-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px
}

.mf-owner-access-head b{
  display:block;
  font-size:12px
}

.mf-owner-access-head small{
  display:block;
  margin-top:3px;
  color:var(--muted,#84919f);
  font-size:9px
}

.mf-owner-access-head span{
  font-size:8px;
  letter-spacing:.08em;
  color:var(--red,#ff6679);
  text-align:right
}

.mf-owner-access.active .mf-owner-access-head span{
  color:var(--green,#51e7a8)
}

.mf-owner-access-form{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  gap:7px;
  margin-top:10px
}

.mf-owner-access-form input,
.mf-owner-access-form button{
  min-height:38px;
  border:1px solid var(--line,#28333e);
  border-radius:9px;
  background:transparent;
  color:var(--text,#eef4f8);
  font:inherit
}

.mf-owner-access-form input{
  padding:0 11px;
  min-width:0
}

.mf-owner-access-form button{
  padding:0 13px
}

.mf-owner-access-form button:disabled{
  opacity:.55
}

.mf-owner-access-note,
.mf-owner-access-message{
  margin-top:8px;
  font-size:9px;
  line-height:1.5;
  color:var(--muted,#84919f)
}

.mf-owner-access-note code{
  color:var(--text,#eef4f8)
}

.mf-owner-access-message.bad{
  color:var(--red,#ff6679)
}

@media(max-width:520px){
  .mf-owner-access-form{
    grid-template-columns:1fr
  }
}
EOF_CSS

python3 - <<'PY_PATCH'
from pathlib import Path

p = Path("settings.html")
s = p.read_text()

if "MEMEFLOW_OWNER_ACCESS_FIX8" not in s:
    marker = "</head>"
    if marker not in s:
        raise SystemExit("ERROR: settings.html has no </head>")

    inject = """  <!-- MEMEFLOW_OWNER_ACCESS_FIX8 -->
  <link rel="stylesheet" href="/owner-access.css?v=fix8-20260827">
  <script src="/owner-access.js?v=fix8-20260827" defer></script>
  <!-- /MEMEFLOW_OWNER_ACCESS_FIX8 -->
</head>"""

    s = s.replace(marker, inject, 1)

p.write_text(s)
PY_PATCH

echo "Validation..."
node --check owner-access.js
grep -q "MEMEFLOW_OWNER_ACCESS_FIX8" settings.html
grep -q "owner-access.js?v=fix8-20260827" settings.html

echo
echo "== OWNER ACCESS FIX 8 INSTALLED =="
echo
echo "IMPORTANT:"
echo "  The diagnostic proved Safari itself is NOT owner/Pro."
echo "  This patch adds an Owner access field directly to System Settings."
echo
echo "Before using it, create a strong Replit Secret:"
echo "  OWNER_ACCESS_KEY=<a long random value only you know>"
echo
echo "Do NOT send that secret to anyone."
echo
echo "Then STOP -> RUN."
echo "Open System Settings in normal Safari -> Wallet -> Owner access."
echo "Enter the same OWNER_ACCESS_KEY and press Activate owner access."
echo
echo "Expected /api/session/status in Safari afterwards:"
echo '  "isOwner":true'
echo '  "entitled":true'
echo '  "entitlementSource":"owner"'
