#!/usr/bin/env python3
from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: transform.py <memeflow-app-dir>")

APP = Path(sys.argv[1])
SOURCE = APP / "memeflow-x-canonical-v180.css"
TARGET = APP / "memeflow-x-canonical-v183.css"

PAGES = [
    "index.html","system.html","how-it-works.html","smart-vault.html",
    "trading.html","settings.html","system-tokens.html","x100.html",
    "agent-performance.html","owner-intelligence.html","system-source.html",
]

if not SOURCE.exists():
    raise SystemExit("ERROR: V180 canonical not found")

TEXT_PROPS = {
    "color",
    "font",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "font-stretch",
    "font-variant",
    "font-variant-caps",
    "font-variant-ligatures",
    "font-variant-numeric",
    "font-feature-settings",
    "font-variation-settings",
    "font-optical-sizing",
    "font-kerning",
    "font-synthesis",
    "line-height",
    "letter-spacing",
    "word-spacing",
    "text-transform",
    "text-decoration",
    "text-decoration-line",
    "text-decoration-color",
    "text-decoration-style",
    "text-decoration-thickness",
    "text-shadow",
    "text-rendering",
    "text-size-adjust",
    "-webkit-text-size-adjust",
    "-webkit-font-smoothing",
    "-moz-osx-font-smoothing",
    "-webkit-text-fill-color",
    "-webkit-text-stroke",
    "-webkit-text-stroke-color",
    "-webkit-text-stroke-width",
    "text-emphasis",
    "text-emphasis-color",
    "text-emphasis-style",
}

SKIP_AT_BLOCKS = (
    "@font-face",
    "@keyframes",
    "@-webkit-keyframes",
    "@property",
    "@page",
    "@counter-style",
)

def is_text_prop(prop):
    return prop.lower() in TEXT_PROPS

def skip_ws_comments(text, i):
    n = len(text)
    while i < n:
        if text[i].isspace():
            i += 1
            continue
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            return n if j < 0 else skip_ws_comments(text, j + 2)
        break
    return i

def find_control(text, i, controls):
    n = len(text)
    quote = None
    esc = False
    par = br = 0
    while i < n:
        if text.startswith("/*", i) and not quote:
            j = text.find("*/", i + 2)
            if j < 0:
                return n, None
            i = j + 2
            continue
        ch = text[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "(":
            par += 1
        elif ch == ")":
            par = max(0, par - 1)
        elif ch == "[":
            br += 1
        elif ch == "]":
            br = max(0, br - 1)
        elif par == 0 and br == 0 and ch in controls:
            return i, ch
        i += 1
    return n, None

def find_matching_brace(text, open_i):
    n = len(text)
    depth = 1
    quote = None
    esc = False
    i = open_i + 1
    while i < n:
        if text.startswith("/*", i) and not quote:
            j = text.find("*/", i + 2)
            if j < 0:
                raise ValueError("Unclosed CSS comment")
            i = j + 2
            continue
        ch = text[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("Unclosed CSS block")

def split_declarations(body):
    parts = []
    start = 0
    quote = None
    esc = False
    par = br = 0
    i = 0
    while i < len(body):
        if body.startswith("/*", i) and not quote:
            j = body.find("*/", i + 2)
            if j < 0:
                j = len(body) - 2
            i = j + 2
            continue
        ch = body[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "(":
            par += 1
        elif ch == ")":
            par = max(0, par - 1)
        elif ch == "[":
            br += 1
        elif ch == "]":
            br = max(0, br - 1)
        elif ch == ";" and par == 0 and br == 0:
            parts.append(body[start:i+1])
            start = i + 1
        i += 1
    if start < len(body):
        parts.append(body[start:])
    return parts

def parse_decl(segment):
    raw = segment.strip()
    if not raw:
        return None
    if raw.endswith(";"):
        raw = raw[:-1]
    i, ctrl = find_control(raw, 0, {":"})
    if ctrl != ":":
        return None
    prop = raw[:i].strip()
    value = raw[i+1:].strip()
    if not prop:
        return None
    important = bool(re.search(r'!\s*important\s*$', value, re.I))
    return prop, value, important

def split_selector_list(selector):
    out = []
    start = 0
    quote = None
    esc = False
    par = br = 0
    i = 0
    while i < len(selector):
        ch = selector[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "(":
            par += 1
        elif ch == ")":
            par = max(0, par - 1)
        elif ch == "[":
            br += 1
        elif ch == "]":
            br = max(0, br - 1)
        elif ch == "," and par == 0 and br == 0:
            out.append(selector[start:i].strip())
            start = i + 1
        i += 1
    out.append(selector[start:].strip())
    return [x for x in out if x]

def selector_key(selector):
    parts = []
    for s in split_selector_list(selector):
        s = re.sub(r'\s+', ' ', s).strip()
        parts.append(s)
    return " , ".join(sorted(parts))

def page_scope_from_html(html, page):
    m = re.search(r'<body\b[^>]*class=["\']([^"\']*)["\']', html, re.I)
    if not m:
        raise SystemExit(f"ERROR: no body class on {page}")
    classes = m.group(1).split()
    candidates = [c for c in classes if c.startswith("mf-page-")]
    if not candidates:
        raise SystemExit(f"ERROR: no mf-page-* class on {page}")
    return candidates[-1]

def scope_one_selector(selector, page_class):
    s = selector.strip()
    if not s:
        return s

    if page_class in s:
        return s

    # :root variables/styles become page-scoped on body while keeping :root specificity.
    if s.startswith(":root"):
        tail = s[len(":root"):].strip()
        if tail:
            return f":root :where(body.{page_class}) {tail}"
        return f":root :where(body.{page_class})"

    # Preserve html/theme selectors and inject the page body after html prefix.
    if re.match(r'^html\b|^html(?=[.#:\[])', s, re.I):
        body_match = re.search(r'\bbody\b', s)
        if body_match:
            start = body_match.start()
            end = body_match.end()
            return s[:end] + f":where(.{page_class})" + s[end:]
        # html selector without body: append page body
        m = re.match(r'^(html(?:[^\s>+~]*))(\s+|$)(.*)$', s)
        if m:
            head, sep, rest = m.groups()
            rest = rest.strip()
            return f"{head} :where(body.{page_class})" + (f" {rest}" if rest else "")

    # Preserve body type specificity, adding only zero-specificity page filter.
    if re.match(r'^body\b|^body(?=[.#:\[])', s, re.I):
        return re.sub(r'^body', f'body:where(.{page_class})', s, count=1, flags=re.I)

    # Generic selector: zero-specificity page scope.
    return f":where(body.{page_class}) {s}"

def scope_selector(selector, page_class):
    return ", ".join(scope_one_selector(s, page_class) for s in split_selector_list(selector))

def wrap_context(rule_text, context):
    text = rule_text
    for header in reversed(context):
        text = f"{header}{{\n{text}\n}}"
    return text

def extract_text_props(css, context=()):
    """
    Return cleaned CSS and records:
      {context, selector, declarations}
    Text properties are physically removed from the source.
    """
    out = []
    records = []
    n = len(css)
    i = 0

    while i < n:
        # Preserve whitespace/comments verbatim.
        if css[i].isspace():
            j = i + 1
            while j < n and css[j].isspace():
                j += 1
            out.append(css[i:j])
            i = j
            continue

        if css.startswith("/*", i):
            j = css.find("*/", i + 2)
            if j < 0:
                out.append(css[i:])
                break
            out.append(css[i:j+2])
            i = j + 2
            continue

        ctrl_i, ctrl = find_control(css, i, {";", "{"})
        if ctrl is None:
            out.append(css[i:])
            break

        header = css[i:ctrl_i].strip()

        if ctrl == ";":
            out.append(css[i:ctrl_i+1])
            i = ctrl_i + 1
            continue

        close = find_matching_brace(css, ctrl_i)
        inner = css[ctrl_i+1:close]

        if header.startswith("@"):
            low = header.lower()
            if any(low.startswith(x) for x in SKIP_AT_BLOCKS):
                out.append(css[i:close+1])
            else:
                cleaned, sub = extract_text_props(inner, context + (header,))
                records.extend(sub)
                if cleaned.strip():
                    out.append(header + "{" + cleaned + "}")
            i = close + 1
            continue

        selector = header
        kept = []
        moved = []

        for seg in split_declarations(inner):
            parsed = parse_decl(seg)
            if not parsed:
                kept.append(seg)
                continue
            prop, value, important = parsed
            if is_text_prop(prop):
                moved.append((prop, value))
            else:
                kept.append(seg)

        if moved:
            records.append({
                "context": context,
                "selector": selector,
                "declarations": moved,
            })

        body = "".join(kept)
        if body.strip():
            out.append(selector + "{" + body + "}")

        i = close + 1

    return "".join(out), records

def records_to_css(records, page_class):
    chunks = []
    for rec in records:
        selector = scope_selector(rec["selector"], page_class)
        decls = " ".join(f"{p}: {v};" for p, v in rec["declarations"])
        rule = f"{selector}{{{decls}}}"
        chunks.append(wrap_context(rule, rec["context"]))
    return "\n".join(chunks)

# -------------------------------------------------------------------
# Discover each production page and active stylesheet order.
# -------------------------------------------------------------------
page_data = {}
css_to_records = {}
external_css_order = []

for page in PAGES:
    p = APP / page
    html = p.read_text(encoding="utf-8")
    scope = page_scope_from_html(html, page)
    links = [
        x.split("?",1)[0].lstrip("/")
        for x in re.findall(
            r'<link\b[^>]*href=["\']([^"\']+\.css(?:\?[^"\']*)?)',
            html,
            re.I,
        )
    ]
    page_data[page] = {"scope": scope, "links": links, "html": html}
    for name in links:
        if name == SOURCE.name:
            continue
        if (APP / name).exists() and name not in external_css_order:
            external_css_order.append(name)

# -------------------------------------------------------------------
# Strip text ownership from every active external stylesheet once.
# -------------------------------------------------------------------
for name in external_css_order:
    p = APP / name
    original = p.read_text(encoding="utf-8")
    cleaned, records = extract_text_props(original)
    p.write_text(cleaned, encoding="utf-8")
    css_to_records[name] = records
    moved_count = sum(len(r["declarations"]) for r in records)
    if moved_count:
        print(f"MOVED {moved_count} TEXT DECLARATIONS FROM {name}")

# -------------------------------------------------------------------
# Build canonical prelude in each page's original external CSS order.
# -------------------------------------------------------------------
prelude_chunks = []

for page in PAGES:
    info = page_data[page]
    page_chunks = []

    for name in info["links"]:
        if name == SOURCE.name:
            continue
        records = css_to_records.get(name, [])
        if records:
            page_chunks.append(records_to_css(records, info["scope"]))

    if page_chunks:
        prelude_chunks.append(
            f"/* V182 EXTERNAL TEXT OWNERSHIP: {page} */\n" +
            "\n".join(page_chunks)
        )

# -------------------------------------------------------------------
# Strip typography/color ownership from inline <style> blocks.
# Preserve whether it was before/after the canonical link.
# -------------------------------------------------------------------
epilogue_chunks = []
inline_prelude_chunks = []

style_re = re.compile(r'<style\b([^>]*)>([\s\S]*?)</style>', re.I)

for page in PAGES:
    p = APP / page
    html = p.read_text(encoding="utf-8")
    scope = page_data[page]["scope"]
    canon_pos = html.find("memeflow-x-canonical-v180.css")

    replacements = []
    for m in style_re.finditer(html):
        attrs = m.group(1)
        body = m.group(2)
        cleaned, records = extract_text_props(body)

        if not records:
            continue

        moved_css = records_to_css(records, scope)
        if m.start() < canon_pos or canon_pos < 0:
            inline_prelude_chunks.append(
                f"/* V182 INLINE-BEFORE: {page} */\n{moved_css}"
            )
        else:
            epilogue_chunks.append(
                f"/* V182 INLINE-AFTER: {page} */\n{moved_css}"
            )

        replacements.append((m.start(2), m.end(2), cleaned))

    # Replace from the back to keep offsets stable.
    for start, end, cleaned in reversed(replacements):
        html = html[:start] + cleaned + html[end:]

    # Move text appearance out of style="" attributes too.
    # Non-text inline geometry (margin/width/etc.) stays in the element.
    # Text declarations move to a unique ID selector at the END of canonical.
    tag_re = re.compile(r'<(?!/|!|\?)([A-Za-z][\w:-]*)([^<>]*?)>', re.S)
    inline_attr_rules = []
    tag_replacements = []
    generated_counter = 0

    for tm in tag_re.finditer(html):
        full_tag = tm.group(0)
        attrs_text = tm.group(2)
        sm = re.search(r'\bstyle\s*=\s*(["\'])(.*?)\1', attrs_text, re.I | re.S)
        if not sm:
            continue

        style_value = sm.group(2)
        kept_segments = []
        moved_decls = []

        for seg in split_declarations(style_value):
            parsed = parse_decl(seg)
            if parsed and is_text_prop(parsed[0]):
                moved_decls.append((parsed[0], parsed[1]))
            else:
                kept_segments.append(seg)

        if not moved_decls:
            continue

        idm = re.search(r'\bid\s*=\s*(["\'])(.*?)\1', attrs_text, re.I | re.S)
        new_tag = full_tag

        if idm and idm.group(2).strip():
            element_id = idm.group(2).strip()
        else:
            generated_counter += 1
            base = re.sub(r'[^a-z0-9]+', '-', page.lower()).strip('-').replace('.html','')
            element_id = f"mf-text-v182-{base}-{generated_counter}"
            while re.search(rf'\bid\s*=\s*["\']{re.escape(element_id)}["\']', html, re.I):
                generated_counter += 1
                element_id = f"mf-text-v182-{base}-{generated_counter}"
            new_tag = re.sub(
                r'^<([A-Za-z][\w:-]*)',
                rf'<\1 id="{element_id}"',
                new_tag,
                count=1,
            )

        style_match = re.search(r'\bstyle\s*=\s*(["\'])(.*?)\1', new_tag, re.I | re.S)
        if not style_match:
            raise SystemExit(f"ERROR: style attribute disappeared unexpectedly in {page}")

        kept_style = ''.join(kept_segments).strip()
        if kept_style:
            quote = style_match.group(1)
            replacement = f'style={quote}{kept_style}{quote}'
            new_tag = new_tag[:style_match.start()] + replacement + new_tag[style_match.end():]
        else:
            a = style_match.start()
            b = style_match.end()
            while a > 0 and new_tag[a-1].isspace():
                a -= 1
            new_tag = new_tag[:a] + new_tag[b:]

        decl_text = ' '.join(f"{prop}: {value};" for prop, value in moved_decls)
        inline_attr_rules.append(
            f":where(body.{scope}) #{element_id}{{{decl_text}}}"
        )
        tag_replacements.append((tm.start(), tm.end(), new_tag))
        print(
            f"MOVED {len(moved_decls)} INLINE TEXT DECLARATIONS "
            f"FROM {page} #{element_id}"
        )

    for a, b, new_tag in reversed(tag_replacements):
        html = html[:a] + new_tag + html[b:]

    if inline_attr_rules:
        epilogue_chunks.append(
            f"/* V182 INLINE-ATTRIBUTE: {page} */\n" + '\n'.join(inline_attr_rules)
        )

    p.write_text(html, encoding="utf-8")


# -------------------------------------------------------------------
# V183: eliminate runtime text-style ownership from inline scripts.
# Semantic state is expressed as data-mf-tone; canonical CSS owns color.
# Runtime typography writes are removed so V180 size/weight/line-height wins.
# -------------------------------------------------------------------

RUNTIME_TEXT_DIRECT_PROPS = (
    "fontSize","fontWeight","fontStyle","fontFamily","fontStretch",
    "fontVariant","fontFeatureSettings","fontVariationSettings",
    "fontOpticalSizing","fontKerning","fontSynthesis","lineHeight",
    "letterSpacing","wordSpacing","textTransform","textDecoration",
    "textDecorationLine","textDecorationColor","textDecorationStyle",
    "textDecorationThickness","textShadow","textRendering",
    "webkitFontSmoothing","MozOsxFontSmoothing","webkitTextFillColor",
    "webkitTextStroke","webkitTextStrokeColor","webkitTextStrokeWidth",
)

RUNTIME_TEXT_CUSTOM_PROP_RE = re.compile(
    r'--[\w-]*(?:font|line-height|line-h|letter-spacing|word-spacing|'
    r'text-transform|text-decoration|text-shadow|text-rendering)[\w-]*',
    re.I,
)

def find_js_assignment_end(code, start):
    quote=None
    esc=False
    par=br=cur=0
    i=start
    while i < len(code):
        ch=code[i]
        if quote:
            if esc:
                esc=False
            elif ch=="\\":
                esc=True
            elif ch==quote:
                quote=None
            i+=1
            continue
        if ch in ("'", '"', '`'):
            quote=ch
        elif ch=="(":
            par+=1
        elif ch==")":
            par=max(0,par-1)
        elif ch=="[":
            br+=1
        elif ch=="]":
            br=max(0,br-1)
        elif ch=="{":
            cur+=1
        elif ch=="}":
            if par==0 and br==0 and cur==0:
                return i
            cur=max(0,cur-1)
        elif ch==";" and par==0 and br==0 and cur==0:
            return i
        i+=1
    return len(code)

def replace_style_color_assignments(code):
    pat=re.compile(r'\.style\.color\s*=')
    out=[]
    last=0
    count=0
    for m in list(pat.finditer(code)):
        if m.start() < last:
            continue
        rhs_start=m.end()
        rhs_end=find_js_assignment_end(code,rhs_start)
        expr=code[rhs_start:rhs_end].strip()
        if not expr:
            continue
        out.append(code[last:m.start()])
        out.append('.dataset.mfTone = window.MF_TEXT_TONE_KEY(' + expr + ')')
        last=rhs_end
        count+=1
    out.append(code[last:])
    return "".join(out),count

def remove_direct_runtime_typography(code):
    count=0
    for prop in RUNTIME_TEXT_DIRECT_PROPS:
        pat=re.compile(
            r'(?P<recv>(?:[A-Za-z_$][\w$]*|(?:\$\([^;{}]+?\))))'
            r'\.style\.'+re.escape(prop)+r'\s*='
        )
        while True:
            m=pat.search(code)
            if not m:
                break
            start=m.start()
            end=find_js_assignment_end(code,m.end())
            if end < len(code) and code[end]==";":
                end+=1
            code=code[:start]+code[end:]
            count+=1
    return code,count

def remove_runtime_text_setproperty(code):
    pat=re.compile(
        r'(?P<recv>[A-Za-z_$][\w$]*)\.style\.setProperty\(\s*'
        r'(?P<q>["\'])(?P<name>--[\w-]+)(?P=q)\s*,',
        re.I
    )
    count=0
    while True:
        found=None
        for m in pat.finditer(code):
            if RUNTIME_TEXT_CUSTOM_PROP_RE.fullmatch(m.group("name")):
                found=m
                break
        if not found:
            break
        start=found.start()
        end=find_js_assignment_end(code,found.end())
        if end < len(code) and code[end]==";":
            end+=1
        code=code[:start]+code[end:]
        count+=1
    return code,count

TONE_HELPER = '''
<script id="MF_TEXT_TONE_RUNTIME_V183">
(()=> {
  'use strict';
  if (window.MF_TEXT_TONE_KEY) return;
  window.MF_TEXT_TONE_KEY = value => {
    const s = String(value ?? '').trim().toLowerCase();
    const map = {
      'var(--green)': 'green',
      'var(--red)': 'red',
      'var(--yellow)': 'yellow',
      'var(--blue)': 'blue',
      'var(--cyan)': 'cyan',
      'var(--muted)': 'muted',
      'var(--mf-neutral-text-1)': 'strong',
      'var(--mf-neutral-text-2)': 'primary',
      'var(--mf-neutral-text-3)': 'muted',
      'var(--mf-neutral-text-4)': 'faint',
      '#fff': 'strong',
      '#ffffff': 'strong',
      'white': 'strong'
    };
    return map[s] || '';
  };
})();
</script>
'''

runtime_color_moves=0
runtime_type_removals=0
runtime_custom_removals=0

for page in PAGES:
    p=APP/page
    html=p.read_text(encoding="utf-8")

    counts=[0,0,0]

    def script_sub(m):
        attrs=m.group(1)
        body=m.group(2)
        if re.search(r'\bsrc\s*=',attrs,re.I):
            return m.group(0)
        new_body,c1=replace_style_color_assignments(body)
        new_body,c2=remove_direct_runtime_typography(new_body)
        new_body,c3=remove_runtime_text_setproperty(new_body)
        counts[0]+=c1
        counts[1]+=c2
        counts[2]+=c3
        return "<script"+attrs+">"+new_body+"</script>"

    html=re.sub(r'<script\b([^>]*)>([\s\S]*?)</script>',script_sub,html,flags=re.I)

    if counts[0] and "MF_TEXT_TONE_RUNTIME_V183" not in html:
        if "</head>" not in html:
            raise SystemExit(f"ERROR: no </head> while adding tone helper to {page}")
        html=html.replace("</head>",TONE_HELPER+"\n</head>",1)

    p.write_text(html,encoding="utf-8")
    runtime_color_moves += counts[0]
    runtime_type_removals += counts[1]
    runtime_custom_removals += counts[2]

print("RUNTIME COLOR WRITES MOVED TO data-mf-tone:",runtime_color_moves)
print("RUNTIME DIRECT TYPOGRAPHY WRITES REMOVED:",runtime_type_removals)
print("RUNTIME TYPOGRAPHY CUSTOM-PROP WRITES REMOVED:",runtime_custom_removals)


# -------------------------------------------------------------------
# Assemble V182 canonical: external/inline-before PRELUDE, existing V180,
# inline-after EPILOGUE. Then dedupe exact text conflicts by context.
# -------------------------------------------------------------------
canonical = SOURCE.read_text(encoding="utf-8")

canonical = re.sub(
    r'/\* MEMEFLOW_TEXT_CANONICAL_V182_START \*/[\s\S]*?'
    r'/\* MEMEFLOW_TEXT_CANONICAL_V182_END \*/',
    '',
    canonical,
)


RUNTIME_CANONICAL_CSS = r'''
/* V183 RUNTIME TEXT STATE: canonical owns all runtime text appearance */
:where([data-mf-tone="green"]){color:var(--green)!important;}
:where([data-mf-tone="red"]){color:var(--red)!important;}
:where([data-mf-tone="yellow"]){color:var(--yellow)!important;}
:where([data-mf-tone="blue"]){color:var(--blue)!important;}
:where([data-mf-tone="cyan"]){color:var(--cyan)!important;}
:where([data-mf-tone="strong"]){color:var(--mf-neutral-text-1)!important;}
:where([data-mf-tone="primary"]){color:var(--mf-neutral-text-2)!important;}
:where([data-mf-tone="muted"]){color:var(--mf-neutral-text-3)!important;}
:where([data-mf-tone="faint"]){color:var(--mf-neutral-text-4)!important;}

:where(body.mf-page-index) #primaryMeta,
:where(body.mf-page-index) .mf-primary-v21-scorecaption{
  font-size:var(--mf-size-11);
  line-height:1.4;
  font-weight:500;
  letter-spacing:normal;
}
:where(body.mf-page-index) #primaryTokenLogo{
  color:var(--mf-neutral-text-3);
  font-size:var(--mf-size-14);
  font-weight:900;
}
'''
prelude_chunks.append(RUNTIME_CANONICAL_CSS)

prelude = "\n\n".join(prelude_chunks + inline_prelude_chunks)
epilogue = "\n\n".join(epilogue_chunks)

assembled = (
    "/* MEMEFLOW_TEXT_CANONICAL_V182_START */\n"
    "/* External and inline text ownership moved here. */\n"
    + prelude
    + "\n/* MEMEFLOW_TEXT_CANONICAL_V182_END */\n\n"
    + canonical.strip()
    + ("\n\n" + epilogue if epilogue.strip() else "")
    + "\n"
)

# -------------------------------------------------------------------
# Context-aware exact-selector dedupe.
# Keep the real CSS cascade winner:
#   important beats normal; otherwise the later declaration wins.
# Different @media/@supports contexts remain independent.
# -------------------------------------------------------------------
def dedupe_context(css):
    items = []
    n = len(css)
    i = 0

    while i < n:
        if css[i].isspace():
            j = i + 1
            while j < n and css[j].isspace():
                j += 1
            items.append({"kind":"raw","text":css[i:j]})
            i = j
            continue

        if css.startswith("/*", i):
            j = css.find("*/", i + 2)
            if j < 0:
                items.append({"kind":"raw","text":css[i:]})
                break
            items.append({"kind":"raw","text":css[i:j+2]})
            i = j + 2
            continue

        ctrl_i, ctrl = find_control(css, i, {";", "{"})
        if ctrl is None:
            items.append({"kind":"raw","text":css[i:]})
            break

        header = css[i:ctrl_i].strip()

        if ctrl == ";":
            items.append({"kind":"raw","text":css[i:ctrl_i+1]})
            i = ctrl_i + 1
            continue

        close = find_matching_brace(css, ctrl_i)
        inner = css[ctrl_i+1:close]

        if header.startswith("@"):
            low = header.lower()
            if any(low.startswith(x) for x in SKIP_AT_BLOCKS):
                items.append({"kind":"raw","text":css[i:close+1]})
            else:
                items.append({
                    "kind":"at",
                    "header":header,
                    "inner":dedupe_context(inner),
                })
            i = close + 1
            continue

        decls = []
        for seg in split_declarations(inner):
            parsed = parse_decl(seg)
            decls.append({
                "raw": seg,
                "parsed": parsed,
                "keep": True,
            })

        items.append({
            "kind":"rule",
            "selector":header,
            "selector_key":selector_key(header),
            "decls":decls,
        })
        i = close + 1

    # Identify true winner of each text property for exact selector in this context.
    winners = {}
    for ii, item in enumerate(items):
        if item["kind"] != "rule":
            continue
        for di, d in enumerate(item["decls"]):
            parsed = d["parsed"]
            if not parsed:
                continue
            prop, value, important = parsed
            if not is_text_prop(prop):
                continue

            key = (item["selector_key"], prop.lower())
            prev = winners.get(key)
            cur = (ii, di, important)

            if prev is None:
                winners[key] = cur
            else:
                _, _, prev_important = prev
                if important and not prev_important:
                    winners[key] = cur
                elif important == prev_important:
                    winners[key] = cur
                # earlier important beats later normal: keep previous.

    removed = 0

    for ii, item in enumerate(items):
        if item["kind"] != "rule":
            continue
        for di, d in enumerate(item["decls"]):
            parsed = d["parsed"]
            if not parsed:
                continue
            prop, value, important = parsed
            if not is_text_prop(prop):
                continue
            key = (item["selector_key"], prop.lower())
            win = winners.get(key)
            if win and (ii, di) != (win[0], win[1]):
                d["keep"] = False
                removed += 1

    out = []
    for item in items:
        if item["kind"] == "raw":
            out.append(item["text"])
        elif item["kind"] == "at":
            inner_text, sub_removed = item["inner"]
            removed += sub_removed
            if inner_text.strip():
                out.append(item["header"] + "{" + inner_text + "}")
        elif item["kind"] == "rule":
            body = "".join(d["raw"] for d in item["decls"] if d["keep"])
            if body.strip():
                out.append(item["selector"] + "{" + body + "}")

    return "".join(out), removed


def normalize_at_context(header):
    s=re.sub(r'\s+',' ',header.strip().lower())
    s=re.sub(r'\s*([():,><=])\s*',r'\1',s)
    return s

def build_ast(css, context=(), order_box=None):
    if order_box is None:
        order_box=[0]
    nodes=[]
    n=len(css); i=0
    while i<n:
        if css[i].isspace():
            j=i+1
            while j<n and css[j].isspace(): j+=1
            nodes.append({"kind":"raw","text":css[i:j]}); i=j; continue
        if css.startswith("/*",i):
            j=css.find("*/",i+2)
            if j<0:
                nodes.append({"kind":"raw","text":css[i:]}); break
            nodes.append({"kind":"raw","text":css[i:j+2]}); i=j+2; continue

        ctrl_i,ctrl=find_control(css,i,{";","{"})
        if ctrl is None:
            nodes.append({"kind":"raw","text":css[i:]}); break
        header=css[i:ctrl_i].strip()

        if ctrl==";":
            nodes.append({"kind":"raw","text":css[i:ctrl_i+1]}); i=ctrl_i+1; continue

        close=find_matching_brace(css,ctrl_i)
        inner=css[ctrl_i+1:close]

        if header.startswith("@"):
            low=header.lower()
            if any(low.startswith(x) for x in SKIP_AT_BLOCKS):
                nodes.append({"kind":"raw","text":css[i:close+1]})
            else:
                ctx=context+(normalize_at_context(header),)
                nodes.append({
                    "kind":"at","header":header,
                    "context":ctx,
                    "children":build_ast(inner,ctx,order_box)
                })
            i=close+1; continue

        decls=[]
        for seg in split_declarations(inner):
            parsed=parse_decl(seg)
            order_box[0]+=1
            decls.append({
                "raw":seg,"parsed":parsed,"keep":True,
                "order":order_box[0]
            })
        nodes.append({
            "kind":"rule","selector":header,
            "selector_key":selector_key(header),
            "context":context,"decls":decls
        })
        i=close+1
    return nodes

def walk_rules(nodes):
    for node in nodes:
        if node["kind"]=="rule":
            yield node
        elif node["kind"]=="at":
            yield from walk_rules(node["children"])

def render_ast(nodes):
    out=[]
    for node in nodes:
        if node["kind"]=="raw":
            out.append(node["text"])
        elif node["kind"]=="at":
            inner=render_ast(node["children"])
            if inner.strip():
                out.append(node["header"]+"{"+inner+"}")
        elif node["kind"]=="rule":
            body="".join(d["raw"] for d in node["decls"] if d["keep"])
            if body.strip():
                out.append(node["selector"]+"{"+body+"}")
    return "".join(out)

def dedupe_global_contexts(css):
    nodes=build_ast(css)
    winners={}
    removed=0

    for rule in walk_rules(nodes):
        for d in rule["decls"]:
            parsed=d["parsed"]
            if not parsed: continue
            prop,value,important=parsed
            if not is_text_prop(prop): continue
            key=(rule["context"],rule["selector_key"],prop.lower())
            prev=winners.get(key)
            cur=(d,important,d["order"])
            if prev is None:
                winners[key]=cur
            else:
                _,prev_imp,prev_order=prev
                if important and not prev_imp:
                    winners[key]=cur
                elif important==prev_imp and d["order"]>prev_order:
                    winners[key]=cur

    for rule in walk_rules(nodes):
        for d in rule["decls"]:
            parsed=d["parsed"]
            if not parsed: continue
            prop,value,important=parsed
            if not is_text_prop(prop): continue
            key=(rule["context"],rule["selector_key"],prop.lower())
            win=winners.get(key)
            if win and d is not win[0]:
                d["keep"]=False
                removed+=1

    return render_ast(nodes),removed

deduped, removed_count = dedupe_global_contexts(assembled)
deduped2, removed_second = dedupe_global_contexts(deduped)
if removed_second:
    deduped = deduped2
    removed_count += removed_second

TARGET.write_text(deduped, encoding="utf-8")
print("CANONICAL DUPLICATE TEXT DECLARATIONS REMOVED:", removed_count)
print("GLOBAL SAME-CONTEXT DEDUPE SECOND PASS:", removed_second)

# Replace canonical link everywhere and remove V180 file.
for page in PAGES:
    p = APP / page
    html = p.read_text(encoding="utf-8")
    html = re.sub(
        r'<link\b[^>]*href=["\']/memeflow-x-canonical-v180\.css[^"\']*["\'][^>]*>',
        '<link rel="stylesheet" href="/memeflow-x-canonical-v183.css?v=text-canonical-v183-20260922">',
        html,
        flags=re.I,
    )

    if "memeflow-x-canonical-v183.css" not in html:
        if "</head>" not in html:
            raise SystemExit(f"ERROR: no </head> in {page}")
        html = html.replace(
            "</head>",
            '  <link rel="stylesheet" href="/memeflow-x-canonical-v183.css?v=text-canonical-v183-20260922">\n</head>',
            1,
        )

    p.write_text(html, encoding="utf-8")

SOURCE.unlink()
print("CREATED", TARGET)
print("REMOVED", SOURCE)
