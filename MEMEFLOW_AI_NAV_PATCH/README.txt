MEMEFLOW — AI BUTTON MOBILE NAV PATCH v1.0

WHAT IT DOES
- Moves the EXISTING AI launcher into the center of the mobile bottom navigation.
- Mobile order becomes: Home · Candidates · AI · Positions · Wallet.
- AI becomes a raised 58x58 premium dark-glass squircle with a subtle cyan accent.
- The original AI element is moved, not replaced, so its existing click handler is preserved.
- The old floating position no longer covers the Primary Candidate card.
- "More" remains accessible from a compact ••• control in the mobile top bar.
- Desktop behavior is restored automatically above 820px.
- No trading, candidate, wallet, chart, scan, or AI-evaluation logic is changed.

INSTALL (AUTOMATIC)
1. Upload/unzip this patch folder into the project.
2. Run: node apply-ai-nav-patch.mjs
3. Restart the app / refresh the preview.

INSTALL (MANUAL)
1. Put ai-bottom-nav-patch.js next to the index.html used by the app.
2. Add this line immediately before </body>:
   <script src="./ai-bottom-nav-patch.js" defer></script>
3. Refresh.

ROLLBACK
- Remove the script tag above from index.html.
- Delete ai-bottom-nav-patch.js.

SAFETY
The installer is idempotent: running it again will not add a duplicate script tag.
