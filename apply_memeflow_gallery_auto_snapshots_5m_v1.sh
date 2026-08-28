#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_GALLERY_AUTO_SNAPSHOTS_5M_V1"
COMMIT_MESSAGE="Refresh System Overview page snapshots every five minutes"
DO_PUSH=1

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    *)
      echo "Usage: $0 [--push|--no-push]" >&2
      exit 2
      ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this inside the MEMEFLOW git repository." >&2
  exit 1
fi

if [[ -d "$ROOT/memeflow-app" ]]; then
  APP="$ROOT/memeflow-app"
else
  APP="$ROOT"
fi

HTML="$APP/system.html"
JS="$APP/system.js"

for f in "$HTML" "$JS"; do
  [[ -f "$f" ]] || {
    echo "ERROR: missing $f" >&2
    exit 1
  }
done

echo
echo "MEMEFLOW Gallery Auto Snapshots 5M V1"
echo "The three System Overview preview images will be recaptured"
echo "from the real pages every 5 minutes while System View is open."
echo
echo "Pages:"
echo "  Trading Terminal"
echo "  System Settings"
echo "  Real-Time Pipeline"
echo

grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" "$JS" || {
  echo "ERROR: page gallery V1 was not found in system.js." >&2
  exit 1
}

grep -Fq "/memeflow-gallery/trading-terminal.webp" "$JS" || {
  echo "ERROR: Trading Terminal gallery image was not found." >&2
  exit 1
}

grep -Fq "/settings.html" "$JS" || {
  echo "ERROR: standalone Settings destination was not found." >&2
  exit 1
}

grep -Fq "/system-tokens.html" "$JS" || {
  echo "ERROR: Real-Time Pipeline destination was not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$JS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || {
  echo "ERROR: detached HEAD." >&2
  exit 1
}

REL_HTML="${HTML#"$ROOT"/}"
REL_JS="${JS#"$ROOT"/}"
TARGETS=("$REL_HTML" "$REL_JS")

for rel in "${TARGETS[@]}"; do
  if ! git -C "$ROOT" diff --quiet -- "$rel" || \
     ! git -C "$ROOT" diff --cached --quiet -- "$rel"; then
    echo "ERROR: target file has local/staged edits: $rel" >&2
    echo "Commit or stash it first; nothing was changed." >&2
    exit 1
  fi
done

if [[ -n "$(git -C "$ROOT" diff --cached --name-only)" ]]; then
  echo "ERROR: unrelated files are already staged. Unstage them first." >&2
  git -C "$ROOT" diff --cached --name-only >&2
  exit 1
fi

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" fetch origin "$BRANCH"
  LOCAL_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
  REMOTE_HEAD="$(git -C "$ROOT" rev-parse "origin/$BRANCH")"

  if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
    echo "ERROR: local $BRANCH differs from origin/$BRANCH." >&2
    echo "Nothing changed." >&2
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.patch-backups/gallery-auto-snapshots-5m-v1-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$JS" "$BACKUP"/
echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch files..."
    cp -p "$BACKUP/system.html" "$HTML"
    cp -p "$BACKUP/system.js" "$JS"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_SYSTEM_HTML="$HTML"
export MF_SYSTEM_JS="$JS"

python3 <<'PY'
from pathlib import Path
import os
import re

html_path = Path(os.environ["MF_SYSTEM_HTML"])
js_path = Path(os.environ["MF_SYSTEM_JS"])

PATCH_ID = "MEMEFLOW_GALLERY_AUTO_SNAPSHOTS_5M_V1"

html = html_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

if PATCH_ID in js:
    raise SystemExit("ERROR: partial auto-snapshot marker already exists")

JS_BLOCK = r'''
/* ===== MEMEFLOW_GALLERY_AUTO_SNAPSHOTS_5M_V1 ===== */
(() => {
  'use strict';

  /*
    Why this is client-side:
    the existing gallery is made from static .webp files. Simply adding a
    cache-busting query every five minutes would reload the SAME old file.
    This layer opens each real same-origin page off-screen, waits for it to
    render, rasterizes the visible mobile viewport, writes the result into the
    existing .mfpg-shot image, then destroys the temporary iframe.

    Result:
      - real refreshed preview
      - no permanent iframe / duplicate SSE connections
      - current 3D card/swipe/click code stays untouched
      - static .webp remains the fallback if capture ever fails
  */

  const PATCH_ID = 'MEMEFLOW_GALLERY_AUTO_SNAPSHOTS_5M_V1';
  const REFRESH_MS = 5 * 60 * 1000;
  const CAPTURE_WIDTH = 390;
  const CAPTURE_HEIGHT = 844;
  const PAGE_SETTLE_MS = 4200;
  const FRAME_TIMEOUT_MS = 22000;
  const BETWEEN_CAPTURES_MS = 650;

  const PAGES = [
    {
      title: 'Trading Terminal',
      url: '/trading.html'
    },
    {
      title: 'System Settings',
      url: '/settings.html'
    },
    {
      title: 'Real-Time Pipeline',
      url: '/system-tokens.html'
    }
  ];

  let running = false;
  let lastCompletedAt = 0;
  let html2CanvasPromise = null;
  let scheduler = 0;
  let stopped = false;
  const activeFrames = new Set();

  const wait = (ms) => new Promise(resolve => window.setTimeout(resolve, ms));

  function loadHtml2Canvas() {
    if (typeof window.html2canvas === 'function') {
      return Promise.resolve(window.html2canvas);
    }

    if (html2CanvasPromise) {
      return html2CanvasPromise;
    }

    html2CanvasPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-mf-gallery-html2canvas="1"]'
      );

      if (existing) {
        const started = Date.now();
        const poll = window.setInterval(() => {
          if (typeof window.html2canvas === 'function') {
            window.clearInterval(poll);
            resolve(window.html2canvas);
            return;
          }

          if (Date.now() - started > 15000) {
            window.clearInterval(poll);
            reject(new Error('html2canvas load timeout'));
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.src =
        'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.async = true;
      script.dataset.mfGalleryHtml2canvas = '1';

      script.onload = () => {
        if (typeof window.html2canvas === 'function') {
          resolve(window.html2canvas);
        } else {
          reject(new Error('html2canvas loaded without global API'));
        }
      };

      script.onerror = () => {
        reject(new Error('html2canvas CDN load failed'));
      };

      document.head.appendChild(script);
    }).catch(error => {
      html2CanvasPromise = null;
      throw error;
    });

    return html2CanvasPromise;
  }

  function galleryCardForTitle(title) {
    const cards = Array.from(
      document.querySelectorAll('#mfPageGallery .mfpg-card')
    );

    return cards.find(card => {
      const label = card.querySelector('.mfpg-title');
      return String(label?.textContent || '').trim() === title;
    }) || null;
  }

  function shotForTitle(title) {
    return galleryCardForTitle(title)?.querySelector('.mfpg-shot') || null;
  }

  function previewUrl(baseUrl) {
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.set('mfGalleryPreview', '1');
    url.searchParams.set('mfGalleryCapturedAt', String(Date.now()));
    return url.href;
  }

  function makeFrame(url) {
    const frame = document.createElement('iframe');
    frame.src = previewUrl(url);
    frame.width = String(CAPTURE_WIDTH);
    frame.height = String(CAPTURE_HEIGHT);
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute(
      'sandbox',
      'allow-same-origin allow-scripts allow-forms allow-modals'
    );

    Object.assign(frame.style, {
      position: 'fixed',
      left: '-20000px',
      top: '0',
      width: `${CAPTURE_WIDTH}px`,
      height: `${CAPTURE_HEIGHT}px`,
      border: '0',
      margin: '0',
      padding: '0',
      opacity: '0.001',
      pointerEvents: 'none',
      zIndex: '-2147483647',
      background: '#0f141a'
    });

    document.body.appendChild(frame);
    activeFrames.add(frame);
    return frame;
  }

  function destroyFrame(frame) {
    activeFrames.delete(frame);
    try {
      frame.src = 'about:blank';
    } catch (_) {}

    try {
      frame.remove();
    } catch (_) {}
  }

  function waitForFrameLoad(frame) {
    return new Promise((resolve, reject) => {
      let done = false;

      const finish = (fn, value) => {
        if (done) return;
        done = true;
        window.clearTimeout(timeout);
        frame.removeEventListener('load', onLoad);
        frame.removeEventListener('error', onError);
        fn(value);
      };

      const onLoad = () => finish(resolve);
      const onError = () => finish(
        reject,
        new Error('preview iframe failed to load')
      );

      const timeout = window.setTimeout(() => {
        finish(
          reject,
          new Error('preview iframe timed out')
        );
      }, FRAME_TIMEOUT_MS);

      frame.addEventListener('load', onLoad, { once: true });
      frame.addEventListener('error', onError, { once: true });
    });
  }

  async function waitForUsableDocument(frame) {
    const started = Date.now();

    while (Date.now() - started < PAGE_SETTLE_MS) {
      if (stopped) return;

      try {
        const doc = frame.contentDocument;
        if (
          doc?.documentElement &&
          doc?.body &&
          doc.body.scrollHeight > 100 &&
          doc.body.scrollWidth > 100
        ) {
          // Keep waiting through the settle window so live data/chart/settings
          // can finish their first paint.
        }
      } catch (_) {}

      await wait(180);
    }

    try {
      frame.contentWindow?.scrollTo?.(0, 0);
    } catch (_) {}

    await wait(120);
  }

  async function capturePage(page, html2canvas) {
    const shot = shotForTitle(page.title);
    if (!shot) {
      throw new Error(`gallery shot not found: ${page.title}`);
    }

    const frame = makeFrame(page.url);

    try {
      await waitForFrameLoad(frame);
      await waitForUsableDocument(frame);

      if (stopped) return false;

      const doc = frame.contentDocument;
      const target = doc?.documentElement || doc?.body;

      if (!target) {
        throw new Error(`preview document unavailable: ${page.title}`);
      }

      const canvas = await html2canvas(target, {
        backgroundColor: '#0f141a',
        width: CAPTURE_WIDTH,
        height: CAPTURE_HEIGHT,
        windowWidth: CAPTURE_WIDTH,
        windowHeight: CAPTURE_HEIGHT,
        scrollX: 0,
        scrollY: 0,
        scale: Math.min(
          1.5,
          Math.max(1, Number(window.devicePixelRatio || 1))
        ),
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 8000,
        removeContainer: true
      });

      const freshSrc = canvas.toDataURL('image/webp', 0.84);

      if (!freshSrc || freshSrc.length < 1000) {
        throw new Error(`empty captured image: ${page.title}`);
      }

      // Decode before replacing the visible image to prevent flashes.
      const probe = new Image();
      probe.decoding = 'async';
      probe.src = freshSrc;

      if (typeof probe.decode === 'function') {
        try {
          await probe.decode();
        } catch (_) {}
      }

      shot.src = freshSrc;
      shot.dataset.mfLiveSnapshot = '1';
      shot.dataset.mfLiveSnapshotAt = String(Date.now());

      const card = galleryCardForTitle(page.title);
      if (card) {
        card.dataset.mfSnapshotUpdatedAt = String(Date.now());
      }

      return true;
    } finally {
      destroyFrame(frame);
    }
  }

  async function refreshSnapshots(reason = 'timer') {
    if (running || stopped || document.hidden) {
      return;
    }

    const gallery = document.getElementById('mfPageGallery');
    if (!gallery) {
      return;
    }

    running = true;
    gallery.dataset.mfSnapshotRefresh = 'running';
    gallery.dataset.mfSnapshotRefreshReason = reason;

    try {
      const html2canvas = await loadHtml2Canvas();
      let successCount = 0;

      for (const page of PAGES) {
        if (stopped || document.hidden) break;

        try {
          const ok = await capturePage(page, html2canvas);
          if (ok) successCount += 1;
        } catch (error) {
          // Keep the old static/current snapshot for this card.
          console.warn(
            '[PAGE-GALLERY] snapshot refresh failed',
            page.title,
            error?.message || error
          );
        }

        await wait(BETWEEN_CAPTURES_MS);
      }

      if (successCount > 0) {
        lastCompletedAt = Date.now();
        gallery.dataset.mfSnapshotUpdatedAt = String(lastCompletedAt);
        gallery.dataset.mfSnapshotRefresh = 'ready';
      } else {
        gallery.dataset.mfSnapshotRefresh = 'fallback';
      }
    } catch (error) {
      gallery.dataset.mfSnapshotRefresh = 'fallback';
      console.warn(
        '[PAGE-GALLERY] snapshot engine unavailable; static previews kept',
        error?.message || error
      );
    } finally {
      running = false;
    }
  }

  function startScheduler() {
    if (scheduler || stopped) return;

    // First fresh capture shortly after the System View/gallery is ready.
    window.setTimeout(() => {
      refreshSnapshots('initial');
    }, 1800);

    // A light scheduler checks age; actual recapture is exactly on/after 5 min.
    scheduler = window.setInterval(() => {
      if (
        !document.hidden &&
        !running &&
        Date.now() - lastCompletedAt >= REFRESH_MS
      ) {
        refreshSnapshots('5-minute');
      }
    }, 15000);
  }

  function waitForGallery() {
    let attempts = 0;

    const timer = window.setInterval(() => {
      attempts += 1;

      const gallery = document.getElementById('mfPageGallery');
      const cards = gallery?.querySelectorAll('.mfpg-card');

      if (gallery && cards?.length >= 3) {
        window.clearInterval(timer);
        gallery.dataset.mfSnapshotIntervalMs = String(REFRESH_MS);
        startScheduler();
        console.log(
          `[PAGE-GALLERY] ${PATCH_ID} mounted; interval=${REFRESH_MS}ms`
        );
        return;
      }

      if (attempts >= 80) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  document.addEventListener('visibilitychange', () => {
    if (
      !document.hidden &&
      !running &&
      Date.now() - lastCompletedAt >= REFRESH_MS
    ) {
      refreshSnapshots('visibility-resume');
    }
  });

  window.addEventListener('pagehide', () => {
    stopped = true;

    if (scheduler) {
      window.clearInterval(scheduler);
      scheduler = 0;
    }

    for (const frame of [...activeFrames]) {
      destroyFrame(frame);
    }
  }, { once: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForGallery, {
      once: true
    });
  } else {
    waitForGallery();
  }
})();
/* ===== /MEMEFLOW_GALLERY_AUTO_SNAPSHOTS_5M_V1 ===== */
'''

js = js.rstrip() + "\n\n" + JS_BLOCK.strip() + "\n"

# Cache-bust system.js so mobile Safari gets the new snapshot scheduler.
html, count = re.subn(
    r'src="/system\.js(?:\?[^"]*)?"',
    'src="/system.js?v=gallery-auto-snapshots-5m-v1"',
    html,
    count=1
)

if count != 1:
    raise SystemExit(
        f"ERROR: expected one /system.js reference, found {count}"
    )

def clean(text: str) -> str:
    return "\n".join(line.rstrip(" \t") for line in text.splitlines()) + "\n"

html = clean(html)
js = clean(js)

html_path.write_text(html, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
final_js = js_path.read_text(encoding="utf-8")

checks = {
    "marker installed":
        PATCH_ID in final_js,
    "5-minute interval":
        "const REFRESH_MS = 5 * 60 * 1000;" in final_js,
    "Trading capture":
        "url: '/trading.html'" in final_js,
    "Settings capture":
        "url: '/settings.html'" in final_js,
    "Pipeline capture":
        "url: '/system-tokens.html'" in final_js,
    "html2canvas pinned":
        "html2canvas@1.4.1" in final_js,
    "temporary iframes destroyed":
        "destroyFrame(frame)" in final_js,
    "existing webp fallback preserved":
        "/memeflow-gallery/trading-terminal.webp" in final_js
        and "/memeflow-gallery/system-settings.webp" in final_js
        and "/memeflow-gallery/live-token-states.webp" in final_js,
    "system JS cache bust":
        "/system.js?v=gallery-auto-snapshots-5m-v1" in final_html,
    "gallery click code preserved":
        "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" in final_js,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: validation failed: " + ", ".join(failed))

for path, text in ((html_path, final_html), (js_path, final_js)):
    bad = [
        i for i, line in enumerate(text.splitlines(), start=1)
        if line.endswith((" ", "\t"))
    ]
    if bad:
        raise SystemExit(
            f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}"
        )

print("Gallery Auto Snapshots 5M V1 validation: PASS")
print("Refresh interval: 300000 ms")
print("Existing static WEBP files remain as safe fallback.")
print("The 3D/swipe/click gallery code is not replaced.")
PY

node --check "$JS"
git -C "$ROOT" diff --check -- "${TARGETS[@]}"

echo
echo "Changed:"
git -C "$ROOT" status --short -- "${TARGETS[@]}"
git -C "$ROOT" diff --stat -- "${TARGETS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"

  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact two snapshot files." >&2
    git -C "$ROOT" reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
    exit 1
  fi

  git -C "$ROOT" commit -m "$COMMIT_MESSAGE"

  git -C "$ROOT" fetch origin "$BRANCH"
  if [[ "$(git -C "$ROOT" rev-parse HEAD^)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
    echo "ERROR: origin/$BRANCH changed while patch was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: automatic 5-minute snapshots committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: automatic 5-minute snapshots installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - 3D page previews are freshly captured from the real pages"
echo "  - first refresh runs after System View opens"
echo "  - subsequent refresh runs every 5 minutes"
echo "  - captures are sequential, not all three at once"
echo "  - temporary preview iframes are destroyed after each capture"
echo "  - static WEBPs stay as fallback if a capture fails"
echo "  - swipe/click/navigation behavior is untouched"
echo "Backup: $BACKUP"
