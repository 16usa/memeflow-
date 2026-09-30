#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import shutil
import subprocess
import sys

MARK_JS = "MEMEFLOW_TOKEN_FLOW_TWO_ROWS_INFO_V247_JS"
MARK_CSS = "MEMEFLOW_TOKEN_FLOW_TWO_ROWS_INFO_V247_CSS"

root = Path.cwd()
app = root / "memeflow-app"
if not app.is_dir() and root.name == "memeflow-app":
    app = root
    root = root.parent

js_path = app / "system-tokens.js"
css_path = app / "system-tokens.css"
html_path = app / "system-tokens.html"

for p in (js_path, css_path, html_path):
    if not p.exists():
        raise SystemExit(f"[FAIL] Missing file: {p}")

js = js_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

if MARK_JS in js or MARK_CSS in css:
    print("[OK] V247 already installed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = app / ".patch-backups" / f"token-flow-two-rows-info-v247-{stamp}"
backup.mkdir(parents=True, exist_ok=True)

for p in (js_path, css_path, html_path):
    shutil.copy2(p, backup / p.name)

css_block = r"""
/* ===== MEMEFLOW_TOKEN_FLOW_TWO_ROWS_INFO_V247_CSS ===== */
@media (max-width: 760px) {
  body.mf-page-system-tokens .token-list > .flow-token {
    grid-template-columns: minmax(0, 2.1fr) minmax(0, 1.45fr) 56px !important;
    grid-template-rows: auto auto !important;
    column-gap: 10px !important;
    row-gap: 4px !important;
    min-height: 88px !important;
    align-items: center !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token > .token-primary {
    grid-column: 1 !important;
    grid-row: 1 / span 2 !important;
    min-width: 0 !important;
    width: 100% !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token .token-head {
    grid-template-columns: 40px minmax(0, 1fr) !important;
    gap: 8px !important;
    align-items: center !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token :is(
    .token-avatar,
    .mf-token-avatar-anchor-v51,
    .mf-token-avatar-anchor-v51 > .token-avatar
  ) {
    width: 40px !important;
    height: 40px !important;
    min-width: 40px !important;
    min-height: 40px !important;
    max-width: 40px !important;
    max-height: 40px !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token .token-meta {
    display: grid !important;
    grid-template-rows: auto auto !important;
    gap: 4px !important;
    min-width: 0 !important;
    align-content: center !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token .token-top {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    min-width: 0 !important;
    padding-right: 0 !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token .token-name {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    max-width: none !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token .mf-token-subline-v47c {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    min-width: 0 !important;
    min-height: 14px !important;
    flex-wrap: nowrap !important;
    overflow: hidden !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token .mf-holder-mini-v47c,
  body.mf-page-system-tokens .token-list > .flow-token .mf-token-age-chip-v47c,
  body.mf-page-system-tokens .token-list > .flow-token .mf-v247-copy-inline {
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    color: #8fa0aa !important;
    font-size: 7px !important;
    line-height: 1.1 !important;
    white-space: nowrap !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token .mf-holder-mini-v47c svg,
  body.mf-page-system-tokens .token-list > .flow-token .mf-v247-copy-inline svg {
    width: 11px !important;
    height: 11px !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) {
    display: grid !important;
    grid-column: 2 !important;
    grid-row: 1 / span 2 !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
    grid-template-rows: auto auto !important;
    gap: 5px 10px !important;
    min-width: 0 !important;
    width: 100% !important;
    padding: 0 18px 0 0 !important;
    margin: 0 !important;
    border: 0 !important;
    position: relative !important;
    align-self: center !important;
    align-content: center !important;
    box-sizing: border-box !important;
    background: transparent !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat) {
    min-width: 0 !important;
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    justify-content: center !important;
    gap: 2px !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    text-align: left !important;
  }

  /* 4-cell strips */
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(1) { grid-column: 1; grid-row: 1; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(2) { grid-column: 1; grid-row: 2; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(3) { grid-column: 2; grid-row: 1; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(4) { grid-column: 2; grid-row: 2; }

  /* 6-cell strips where first 2 are already hidden by older patches */
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(3) { grid-column: 1; grid-row: 1; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(4) { grid-column: 1; grid-row: 2; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(5) { grid-column: 2; grid-row: 1; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(6) { grid-column: 2; grid-row: 2; }

  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat) > span {
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    color: #768b96 !important;
    font-size: 6px !important;
    font-weight: 800 !important;
    line-height: 1 !important;
    letter-spacing: .05em !important;
    text-transform: uppercase !important;
    white-space: nowrap !important;
    opacity: .9 !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat) > strong {
    display: block !important;
    margin: 0 !important;
    font-size: 8px !important;
    line-height: 1.05 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    text-align: left !important;
  }

  /* icons for 4-item strips */
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(1) > span::before { content: "◔"; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(2) > span::before { content: "⇄"; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(3) > span::before { content: "◎"; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(4) > span::before { content: "↗"; }

  /* icons for 6-item strips */
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(3) > span::before { content: "◔"; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(4) > span::before { content: "⇄"; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(5) > span::before { content: "◎"; }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-regular-market-strip, .mf-open-market-strip) > :is(.mf-regular-market-stat, .mf-open-market-stat):nth-child(6) > span::before { content: "↗"; }

  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot, .mf-open-pnl-slot) {
    grid-column: 3 !important;
    grid-row: 1 / span 2 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    height: 100% !important;
    gap: 4px !important;
    padding: 0 !important;
    margin: 0 !important;
    text-align: center !important;
    white-space: nowrap !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot, .mf-open-pnl-slot) > span {
    display: block !important;
    font-size: 6px !important;
    line-height: 1 !important;
    opacity: .7 !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot, .mf-open-pnl-slot) > strong {
    font-size: 10px !important;
    line-height: 1 !important;
    margin: 0 !important;
  }

  .mf-card-info-btn-v247 {
    position: absolute !important;
    top: 0 !important;
    right: 0 !important;
    width: 14px !important;
    height: 14px !important;
    min-width: 14px !important;
    min-height: 14px !important;
    display: inline-grid !important;
    place-items: center !important;
    padding: 0 !important;
    border: 1px solid rgba(147,178,202,.16) !important;
    border-radius: 999px !important;
    background: rgba(10,18,24,.92) !important;
    color: #8fa0aa !important;
    font: inherit !important;
    font-size: 8px !important;
    font-weight: 900 !important;
    line-height: 1 !important;
    box-shadow: none !important;
    z-index: 3 !important;
  }

  .mf-card-info-tip-v247 {
    position: absolute !important;
    top: 18px !important;
    right: 0 !important;
    width: 138px !important;
    padding: 7px 8px !important;
    border: 1px solid rgba(147,178,202,.12) !important;
    border-radius: 9px !important;
    background: rgba(8,15,20,.98) !important;
    color: #d8e2e8 !important;
    box-shadow: 0 10px 25px rgba(0,0,0,.26) !important;
    font-size: 6px !important;
    line-height: 1.35 !important;
    z-index: 4 !important;
  }

  .mf-card-info-tip-v247 b {
    color: #ffffff !important;
    font-weight: 800 !important;
  }

  .mf-card-info-tip-v247 ul {
    list-style: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .mf-card-info-tip-v247 li + li {
    margin-top: 4px !important;
  }
}
/* ===== /MEMEFLOW_TOKEN_FLOW_TWO_ROWS_INFO_V247_CSS ===== */
"""

js_block = r"""
// ===== MEMEFLOW_TOKEN_FLOW_TWO_ROWS_INFO_V247_JS =====
(function memeflowTokenFlowTwoRowsInfoV247(){
  const CARD_DATA_KEY = 'mfTwoRowsInfoV247';

  function ensureSubline(card){
    let sub = card.querySelector('.mf-token-subline-v47c');
    if (sub) return sub;

    const meta = card.querySelector('.token-meta');
    const top = card.querySelector('.token-top');
    if (!meta || !top) return null;

    sub = document.createElement('div');
    sub.className = 'mf-token-subline-v47c';
    top.insertAdjacentElement('afterend', sub);
    return sub;
  }

  function maybeMove(el, target, className=''){
    if (!el || !target) return;
    if (className) el.classList.add(className);
    if (el.parentElement !== target) {
      target.appendChild(el);
    }
  }

  function ensureInfo(strip){
    if (!strip || strip.querySelector('.mf-card-info-btn-v247')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mf-card-info-btn-v247';
    btn.setAttribute('aria-label', 'Metric info');
    btn.textContent = '!';

    const tip = document.createElement('div');
    tip.className = 'mf-card-info-tip-v247';
    tip.hidden = true;
    tip.innerHTML = `
      <ul>
        <li><b>VOL</b> — volume за 5m</li>
        <li><b>TX</b> — transactions за 5m</li>
        <li><b>MC</b> — market cap</li>
        <li><b>Δ%</b> — price change за 5m</li>
        <li><b>Holders</b> — количество холдеров</li>
        <li><b>Age</b> — возраст токена</li>
        <li><b>Score</b> — оценка системы</li>
      </ul>
    `;

    btn.addEventListener('click', function(event){
      event.preventDefault();
      event.stopPropagation();
      const willShow = tip.hidden;
      document.querySelectorAll('.mf-card-info-tip-v247').forEach(node => {
        node.hidden = true;
      });
      tip.hidden = !willShow;
    });

    tip.addEventListener('click', function(event){
      event.stopPropagation();
    });

    strip.appendChild(btn);
    strip.appendChild(tip);
  }

  function enhanceCard(card){
    if (!card || card.dataset[CARD_DATA_KEY] === '1') return;
    card.dataset[CARD_DATA_KEY] = '1';

    const sub = ensureSubline(card);
    const age = card.querySelector('.mf-token-age-chip-v47c');
    const holder = card.querySelector('.mf-holder-mini-v47c');
    const copy = card.querySelector(
      '.token-copy, .token-copy-button, .token-mint-copy, [aria-label*="Copy"], [title*="Copy"]'
    );

    maybeMove(holder, sub);
    maybeMove(age, sub);
    maybeMove(copy, sub, 'mf-v247-copy-inline');

    const strip = card.querySelector('.mf-regular-market-strip, .mf-open-market-strip');
    ensureInfo(strip);
  }

  function sweep(){
    document.querySelectorAll('.flow-token').forEach(enhanceCard);
  }

  function boot(){
    sweep();

    const list = document.getElementById('tokenList');
    if (list) {
      const observer = new MutationObserver(() => sweep());
      observer.observe(list, { childList: true, subtree: true });
    }

    document.addEventListener('click', function(event){
      document.querySelectorAll('.mf-card-info-tip-v247').forEach(node => {
        const owner = node.parentElement;
        if (node.hidden) return;
        if (owner && !owner.contains(event.target)) {
          node.hidden = true;
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
// ===== /MEMEFLOW_TOKEN_FLOW_TWO_ROWS_INFO_V247_JS =====
"""

css = css.rstrip() + "\n\n" + css_block + "\n"
js = js.rstrip() + "\n\n" + js_block + "\n"
# Normalize EOF: exactly one newline, no trailing blank lines
for _rel in ("memeflow-app/system-tokens.css", "memeflow-app/system-tokens.js"):
    _p = root / _rel
    if _p.exists():
        _txt = _p.read_text()
        _p.write_text(_txt.rstrip() + "\n")

n"

html = re.sub(
    r'href="/system-tokens\.css\?v=[^"]*"',
    'href="/system-tokens.css?v=token-flow-two-rows-info-v247-20260928"',
    html,
    count=1
)
html = re.sub(
    r'src="/system-tokens\.js\?v=[^"]*"',
    'src="/system-tokens.js?v=token-flow-two-rows-info-v247-20260928"',
    html,
    count=1
)

js_path.write_text(js, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")

try:
    subprocess.run(["node", "--check", str(js_path)], check=True)
except Exception as e:
    for p in (js_path, css_path, html_path):
        shutil.copy2(backup / p.name, p)
    raise SystemExit(f"[FAIL] JS syntax check failed. Rollback applied. {e}")

try:
    subprocess.run(
        ["git", "diff", "--check", "--", str(js_path.relative_to(root)), str(css_path.relative_to(root)), str(html_path.relative_to(root))],
        check=True
    )
except Exception:
    for p in (js_path, css_path, html_path):
        shutil.copy2(backup / p.name, p)
    raise SystemExit("[FAIL] git diff --check failed. Rollback applied.")

print("[OK] MEMEFLOW TOKEN FLOW TWO ROWS INFO V247 installed.")
print(f"[BACKUP] {backup}")
print("No process/server restart was performed.")
