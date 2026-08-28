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
