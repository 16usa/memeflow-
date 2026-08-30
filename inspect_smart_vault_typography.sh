#!/usr/bin/env bash
set -euo pipefail

echo "MEMEFLOW Smart Vault Typography Audit"
echo "===================================="

python3 <<'PY'
from pathlib import Path
from html.parser import HTMLParser
from collections import Counter, defaultdict
import re
import sys

ROOT = Path.cwd().resolve()

def choose_html():
    preferred = [
        ROOT / "memeflow-app" / "smart-vault.html",
        ROOT / "smart-vault.html",
    ]
    for p in preferred:
        if p.is_file():
            return p

    candidates = []
    for p in ROOT.rglob("*.html"):
        if any(part in {".git", "node_modules", "dist", "build"} for part in p.parts):
            continue
        n = p.name.lower().replace("_", "-")
        score = 0
        if "smart-vault" in n:
            score = 100
        elif "smart" in n and "vault" in n:
            score = 90
        elif "vault" in n:
            score = 50
        if score:
            candidates.append((score, len(p.parts), p))

    if not candidates:
        return None
    candidates.sort(key=lambda x: (-x[0], x[1], str(x[2])))
    return candidates[0][2]

html_path = choose_html()
if html_path is None:
    print("ERROR: Could not find smart-vault.html (or another Vault HTML file).")
    print("Searched under:", ROOT)
    print()
    print("Run this command and send me the result:")
    print("find . -maxdepth 5 -type f \\( -iname '*vault*.html' -o -iname '*smart*vault*' \\) -print")
    sys.exit(2)

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stylesheets = []
        self.inline_styles = []
        self.in_style = False
        self.style_buf = []
        self.inline_style_attrs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag.lower() == "link":
            rel = str(attrs.get("rel", "")).lower()
            href = attrs.get("href")
            if "stylesheet" in rel and href:
                self.stylesheets.append(href)
        elif tag.lower() == "style":
            self.in_style = True
            self.style_buf = []
        style = attrs.get("style")
        if style:
            ident = attrs.get("id") or attrs.get("class") or tag
            self.inline_style_attrs.append((ident, style))

    def handle_data(self, data):
        if self.in_style:
            self.style_buf.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "style" and self.in_style:
            self.inline_styles.append("".join(self.style_buf))
            self.in_style = False
            self.style_buf = []

html_text = html_path.read_text(encoding="utf-8", errors="replace")
parser = PageParser()
parser.feed(html_text)

app_root = html_path.parent
repo_app = ROOT / "memeflow-app"
if not repo_app.is_dir():
    repo_app = app_root

def strip_query_fragment(href):
    return href.split("#",1)[0].split("?",1)[0]

def resolve_css(href):
    raw = strip_query_fragment(href.strip())
    if raw.startswith(("http://", "https://", "//", "data:")):
        return None
    if raw.startswith("/"):
        candidates = [repo_app / raw.lstrip("/"), ROOT / raw.lstrip("/")]
    else:
        candidates = [html_path.parent / raw, repo_app / raw]
    for p in candidates:
        p = p.resolve()
        if p.is_file():
            return p
    return None

css_sources = []
seen = set()

def add_css_file(path, reason="linked"):
    path = path.resolve()
    if path in seen or not path.is_file():
        return
    seen.add(path)
    text = path.read_text(encoding="utf-8", errors="replace")
    css_sources.append((str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path), text, reason))
    # Follow simple local @imports too.
    for m in re.finditer(r'@import\s+(?:url\()?["\']?([^"\'\)\s;]+)', text, flags=re.I):
        imp = strip_query_fragment(m.group(1))
        if imp.startswith(("http://", "https://", "//", "data:")):
            continue
        imp_path = (path.parent / imp).resolve()
        if imp_path.is_file():
            add_css_file(imp_path, reason=f"@import from {path.name}")

for href in parser.stylesheets:
    p = resolve_css(href)
    if p:
        add_css_file(p)

for i, text in enumerate(parser.inline_styles, start=1):
    css_sources.append((f"{html_path.name}::<style #{i}>", text, "inline <style>"))

FONT_PROPS = ("font-size", "line-height", "font-weight", "letter-spacing", "font-family")

def remove_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)

def extract_rules(css, source):
    css = remove_comments(css)
    rows = []

    # Preserve a rough @media stack by walking braces.
    token_re = re.compile(r'([^{}]+)\{([^{}]*)\}')
    # Repeatedly collect leaf blocks. This catches rules within @media too,
    # while a separate pass assigns nearest preceding media context heuristically.
    media_ranges = []
    stack = []
    for m in re.finditer(r'@media\s*([^{]+)\{|[{}]', css, flags=re.I):
        tok = m.group(0)
        if tok.startswith("@media"):
            stack.append(("media", m.start(), m.group(1).strip(), 1))
        elif tok == "{":
            if stack:
                kind, st, val, depth = stack[-1]
                stack[-1] = (kind, st, val, depth + 1)
        elif tok == "}":
            if stack:
                kind, st, val, depth = stack[-1]
                depth -= 1
                if depth <= 0:
                    stack.pop()
                    if kind == "media":
                        media_ranges.append((st, m.end(), val))
                else:
                    stack[-1] = (kind, st, val, depth)

    # More reliable balanced-media parser.
    media_ranges = []
    for mm in re.finditer(r'@media\s*([^{]+)\{', css, flags=re.I):
        depth = 1
        i = mm.end()
        while i < len(css) and depth:
            if css[i] == "{":
                depth += 1
            elif css[i] == "}":
                depth -= 1
            i += 1
        if depth == 0:
            media_ranges.append((mm.start(), i, mm.group(1).strip()))

    for m in token_re.finditer(css):
        selector = " ".join(m.group(1).split())
        if selector.startswith("@"):
            continue
        body = m.group(2)
        decls = {}
        for prop in FONT_PROPS:
            dm = re.search(r'(?<![-\w])' + re.escape(prop) + r'\s*:\s*([^;}{]+)', body, flags=re.I)
            if dm:
                decls[prop] = dm.group(1).strip()
        if not decls:
            continue
        contexts = [cond for a,b,cond in media_ranges if a <= m.start() <= b]
        media = " > ".join(contexts) if contexts else "base"
        rows.append({
            "source": source,
            "media": media,
            "selector": selector,
            **decls,
        })
    return rows

rows = []
for source, text, reason in css_sources:
    rows.extend(extract_rules(text, source))

# Inline style="" attributes.
for ident, style in parser.inline_style_attrs:
    decls = {}
    for prop in FONT_PROPS:
        m = re.search(r'(?<![-\w])' + re.escape(prop) + r'\s*:\s*([^;]+)', style, flags=re.I)
        if m:
            decls[prop] = m.group(1).strip()
    if decls:
        rows.append({
            "source": f"{html_path.name}::style-attr",
            "media": "inline",
            "selector": str(ident),
            **decls,
        })

def normalize_px(value):
    if not value:
        return None
    m = re.fullmatch(r'\s*([0-9]*\.?[0-9]+)px(?:\s*!important)?\s*', value, flags=re.I)
    return float(m.group(1)) if m else None

size_counter = Counter()
for row in rows:
    px = normalize_px(row.get("font-size"))
    if px is not None:
        size_counter[px] += 1

def role_for(selector):
    s = selector.lower()
    roles = []
    tests = [
        ("BRAND", ("brand", "logo-title")),
        ("PAGE_TITLE", (" h1", "h1", "page-title", "hero-title", "vault-title")),
        ("SECTION_TITLE", (" h2", " h3", "h2", "h3", "section-title", "panel-head", "card-title", "group-title")),
        ("LABEL_META", ("eyebrow", "kicker", "label", "meta", "hint", "caption", "small", "subtitle", "sub", "muted")),
        ("BADGE_STATUS", ("badge", "chip", "pill", "status", "state")),
        ("BUTTON", ("button", ".btn", "action")),
        ("FORM", ("input", "select", "textarea", "field")),
        ("NAV", ("nav", "menu")),
    ]
    for role, needles in tests:
        if any(n in s for n in needles):
            roles.append(role)
    return ",".join(dict.fromkeys(roles)) or "OTHER"

by_role = defaultdict(list)
for r in rows:
    by_role[role_for(r["selector"])].append(r)

report = []
report.append("MEMEFLOW SMART VAULT TYPOGRAPHY REPORT")
report.append("=" * 45)
report.append(f"Project root : {ROOT}")
report.append(f"Smart Vault  : {html_path.relative_to(ROOT) if html_path.is_relative_to(ROOT) else html_path}")
report.append("")
report.append("Linked/local CSS sources actually found:")
if css_sources:
    for source, _, reason in css_sources:
        report.append(f"  - {source}  [{reason}]")
else:
    report.append("  (no local stylesheets or inline <style> blocks found)")
report.append("")
report.append("Distinct explicit px font sizes (count of declarations):")
if size_counter:
    for px, count in sorted(size_counter.items()):
        label = int(px) if px.is_integer() else px
        report.append(f"  {label:>5}px : {count}")
else:
    report.append("  (no explicit px font-size declarations found)")
report.append("")

# Focused semantic summary.
report.append("SEMANTIC ROLE SUMMARY")
report.append("-" * 45)
for role in ("BRAND","PAGE_TITLE","SECTION_TITLE","LABEL_META","BADGE_STATUS","BUTTON","FORM","NAV","OTHER"):
    rr = by_role.get(role, [])
    if not rr:
        continue
    sizes = Counter()
    for x in rr:
        if x.get("font-size"):
            sizes[x["font-size"]] += 1
    report.append(f"\n[{role}]")
    if sizes:
        report.append("  font-size values: " + ", ".join(f"{v} ({n}x)" for v,n in sizes.most_common()))
    # Show up to 18 relevant selectors, prioritizing rows with font-size.
    shown = sorted(rr, key=lambda x: (0 if x.get("font-size") else 1, x["selector"]))[:18]
    for x in shown:
        props = "; ".join(f"{p}: {x[p]}" for p in FONT_PROPS if x.get(p))
        report.append(f"  {x['selector']}  =>  {props}  [{x['media']}]  <{x['source']}>")

report.append("")
report.append("ALL TYPOGRAPHY RULES")
report.append("-" * 45)
for x in rows:
    props = "; ".join(f"{p}: {x[p]}" for p in FONT_PROPS if x.get(p))
    report.append(f"[{x['media']}] {x['selector']} {{ {props} }}  <{x['source']}>")

report.append("")
report.append("NOTES")
report.append("-" * 45)
report.append("* This audit is READ-ONLY; it changed no project files.")
report.append("* External CDN stylesheets are intentionally not downloaded.")
report.append("* The final canonical layer should be built from semantic roles, not by forcing every selector to one size.")
report.append("* memeflow-nav.css can remain excluded from the final migration.")

out_dir = repo_app if repo_app.is_dir() else html_path.parent
out = out_dir / "smart-vault-typography-report.txt"
out.write_text("\n".join(report) + "\n", encoding="utf-8")

print()
print("\n".join(report[:120]))
if len(report) > 120:
    print()
    print(f"... full report has {len(report)} lines ...")
print()
print("REPORT SAVED TO:", out.relative_to(ROOT) if out.is_relative_to(ROOT) else out)
print("DONE: Smart Vault typography audit complete.")
PY
