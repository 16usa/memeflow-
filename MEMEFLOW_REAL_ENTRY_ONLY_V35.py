#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
V35_MARKER = "MEMEFLOW_TRADING_REAL_ENTRY_ONLY_V35"

def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)

def replace_once(src, old, new, label):
    count = src.count(old)
    if count != 1:
        fail(f"{label}: expected exactly 1 anchor, found {count}")
    return src.replace(old, new, 1)

root = Path.cwd()
app = root / "memeflow-app"
if not app.is_dir() and root.name == "memeflow-app":
    app = root
if not app.is_dir():
    fail("memeflow-app not found. Run this from the existing Replit workspace Shell.")

try:
    origin = subprocess.check_output(
        ["git", "config", "--get", "remote.origin.url"],
        cwd=root,
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
except Exception:
    origin = ""

if origin and EXPECTED_REPO_FRAGMENT not in origin:
    fail(f"Unexpected git origin: {origin}")

js_path = app / "trading.js"
html_path = app / "trading.html"

for p in (js_path, html_path):
    if not p.is_file():
        fail(f"Missing required file: {p}")

js = js_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")
originals = {js_path: js, html_path: html}
changed = False

old_strategy = r'''function strategyLevels() {
  if (!state.selectedMint) return [];

  const rate = solUsdRate();
  if (!(rate > 0)) return [];

  const position = state.positions.find(
    p => p.status === 'OPEN' && p.mint === state.selectedMint
  );

  let entrySol = num(position?.entryPriceSol);

  if (!(entrySol > 0)) {
    entrySol = chartRuntime.previewEntrySolByMint.get(state.selectedMint) ?? null;

    if (!(entrySol > 0)) {
      const points = rawPoints(state.selectedMint);
      const last = points[points.length - 1];
      entrySol = num(
        last?.priceSol ?? last?.price,
        candidatePrice(state.selected)
      );

      if (entrySol > 0) {
        chartRuntime.previewEntrySolByMint.set(
          state.selectedMint,
          entrySol
        );
      }
    }
  }

  if (!(entrySol > 0)) return [];

  const entry = chartValueFromUsdPrice(entrySol * rate);
  if (!(entry > 0)) return [];

  const hard = num($('hardStopPct')?.value, state.settings?.hardStopPct);
  const tp1 = num($('tp1Pct')?.value, state.settings?.tp1Pct);
  const tp2 = num($('tp2Pct')?.value, state.settings?.tp2Pct);
  const tp1Sell = num($('tp1SellPct')?.value, state.settings?.tp1SellPct);
  const tp2Sell = num($('tp2SellPct')?.value, state.settings?.tp2SellPct);

  return [
    { label: 'ENTRY', price: entry, kind: 'entry' },
    hard > 0
      ? { label: `SL -${fmt(hard, 1)}%`, price: entry * (1 - hard / 100), kind: 'stop' }
      : null,
    tp1 > 0
      ? { label: `TP1 +${fmt(tp1, 0)}% · ${fmt(tp1Sell, 0)}%`, price: entry * (1 + tp1 / 100), kind: 'tp' }
      : null,
    tp2 > 0
      ? { label: `TP2 +${fmt(tp2, 0)}% · ${fmt(tp2Sell, 0)}%`, price: entry * (1 + tp2 / 100), kind: 'tp2' }
      : null
  ].filter(Boolean);
}'''

new_strategy = r'''function strategyLevels() {
  // V35 REAL ENTRY ONLY:
  // Strategy levels exist only after the trading engine has actually opened
  // a position. WATCH / WAITING / BLOCKED / BUY READY candidates must not
  // invent an ENTRY from the current chart price or from a cached preview.
  //
  // LIVE remains visible independently via chartHorizontalLevelSeries(...).
  // ENTRY / SL / TP1 / TP2 are derived only from the persisted fill price.
  if (!state.selectedMint) return [];

  const position = state.positions.find(
    p =>
      String(p?.status || '').toUpperCase() === 'OPEN' &&
      String(p?.mint || '') === String(state.selectedMint)
  );

  if (!position) return [];

  const entrySol = num(position?.entryPriceSol);
  if (!(entrySol > 0)) return [];

  const rate = solUsdRate();
  if (!(rate > 0)) return [];

  const entry = chartValueFromUsdPrice(entrySol * rate);
  if (!(entry > 0)) return [];

  const hard = num($('hardStopPct')?.value, state.settings?.hardStopPct);
  const tp1 = num($('tp1Pct')?.value, state.settings?.tp1Pct);
  const tp2 = num($('tp2Pct')?.value, state.settings?.tp2Pct);
  const tp1Sell = num($('tp1SellPct')?.value, state.settings?.tp1SellPct);
  const tp2Sell = num($('tp2SellPct')?.value, state.settings?.tp2SellPct);

  return [
    {
      label:'ENTRY',
      price:entry,
      kind:'entry',
      source:'executed-position'
    },
    hard > 0
      ? {
          label:`SL -${fmt(hard, 1)}%`,
          price:entry * (1 - hard / 100),
          kind:'stop',
          source:'executed-position'
        }
      : null,
    tp1 > 0
      ? {
          label:`TP1 +${fmt(tp1, 0)}% · ${fmt(tp1Sell, 0)}%`,
          price:entry * (1 + tp1 / 100),
          kind:'tp',
          source:'executed-position'
        }
      : null,
    tp2 > 0
      ? {
          label:`TP2 +${fmt(tp2, 0)}% · ${fmt(tp2Sell, 0)}%`,
          price:entry * (1 + tp2 / 100),
          kind:'tp2',
          source:'executed-position'
        }
      : null
  ].filter(Boolean);
}'''

if "// V35 REAL ENTRY ONLY:" not in js:
    js = replace_once(js, old_strategy, new_strategy, "strategyLevels real-entry-only")
    changed = True

# Cache bust: accept local V34 or older V33 workspace.
if "real-entry-only-v35-20260928" not in html:
    replaced = False
    for old in (
        "chart-axis-rail-v34-20260928",
        "chart-level-integration-v33-20260927",
    ):
        if old in html:
            html = html.replace(old, "real-entry-only-v35-20260928")
            replaced = True
    if not replaced:
        fail("Could not find trading cache-version anchor in trading.html")
    changed = True

if V35_MARKER not in html:
    html += f"\n<!-- {V35_MARKER} -->\n"
    changed = True

if not changed:
    print("\n[OK] V35 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-real-entry-only-v35-backup-{stamp}"
backup_dir.mkdir(parents=True, exist_ok=False)

for p, content in originals.items():
    rel = p.relative_to(root) if root in p.parents else Path(p.name)
    target = backup_dir / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

js_path.write_text(js, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")

try:
    subprocess.run(["node", "--check", str(js_path)], cwd=root, check=True)
except FileNotFoundError:
    print("[WARN] node is unavailable; JS syntax check skipped.")
except subprocess.CalledProcessError:
    fail("node --check failed. Restore from backup: " + str(backup_dir))

try:
    subprocess.run(
        [
            "git", "diff", "--check", "--",
            str(js_path.relative_to(root)),
            str(html_path.relative_to(root)),
        ],
        cwd=root,
        check=True,
    )
except Exception:
    print("[WARN] git diff --check could not run.")

print("\n[OK] MEMEFLOW REAL ENTRY ONLY V35 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV35 logic:")
print("  • WATCH / WAITING / BLOCKED / BUY READY: no fake ENTRY, SL, TP1 or TP2.")
print("  • LIVE remains visible for every selected token with live candle data.")
print("  • OPEN POSITION: ENTRY = real position.entryPriceSol only.")
print("  • SL / TP1 / TP2 are calculated only from that executed ENTRY.")
print("  • If an OPEN position temporarily has no valid entryPriceSol, strategy levels stay hidden.")
print("  • Cached preview/current chart price can no longer become ENTRY.")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
print(
    'git add memeflow-app/trading.js memeflow-app/trading.html && '
    'git commit -m "Use executed entry only for chart strategy levels" && git push'
)
