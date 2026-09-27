MEMEFLOW GLOBAL TERMINAL FONT V207.2

Purpose
- make IBM Plex Mono the terminal-style font across the entire Memflow site
- font family only

What V207.2 fixes
V207.1 passed the shadow audit but its REAL backup diff guard falsely rejected
multiline font-family stacks such as:

  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "SF Pro Display",
    sans-serif;

The old guard checked one changed line at a time, so continuation lines such as
"Inter," or "ui-sans-serif," looked like unrelated changes.

V207.2 uses a semantic diff guard instead:
- masks the COMPLETE font-family declaration, even when it spans many lines
- masks only font-family custom properties, HTML font-family attributes,
  explicit JS fontFamily values, and this patch's loader block
- then requires the rest of each backed-up file to be byte-equivalent

This keeps the safety goal while removing the false positive.

Preserved
- all font sizes
- weights
- line heights
- letter spacing
- colors
- spacing / geometry
- cards / borders / backgrounds
- responsive rules
- scanner / trading / API / data logic
- icon fonts
- inherit / inherit!important

Font loading
- existing local IBM Plex Mono WOFF2 if found
- otherwise Google Fonts
- system monospace fallbacks remain

Safety
1. copy CURRENT site into a temporary shadow
2. apply V207.2 to shadow
3. audit shadow
4. real workspace remains untouched until shadow PASS
5. exact real backup
6. apply to real site
7. semantic exact-backup diff audit
8. git diff --check
9. automatic rollback on real failure
10. no server restart
11. no automatic git push

Install
  unzip -o Memflow-Global-Terminal-Font-V207.2.zip && bash memeflow_global_terminal_font_v207_2/install.sh

Rollback
  bash memeflow_global_terminal_font_v207_2/rollback.sh
