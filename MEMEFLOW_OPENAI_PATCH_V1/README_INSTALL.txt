MEMEFLOW OPENAI PATCH V1

Adds:
- Real OpenAI Responses API server integration
- Per-user isolation tied to the authenticated MEMEFLOW session
- ANALYZE, ASSIST, AUTO AI, LEARNING, STRATEGY COACH, AUTO OPTIMIZE enabled by default
- Per-user AI memory, analyses, outcomes, proposals and audit
- Strict hard-risk gate before AUTO AI execution attempts
- Browser UI control center with no MutationObserver and no polling interval
- Server-only OPENAI_API_KEY

Install:
1) Upload/extract this ZIP in Replit.
2) In Shell: cd ~/workspace/memeflow-app
3) Run: python3 <path-to-extracted-folder>/install.py
4) Add OPENAI_API_KEY in Replit Secrets.
5) Restart the project.
6) Open the site and tap the round AI button.

Rollback:
python3 <path-to-extracted-folder>/rollback.py

IMPORTANT:
The GitHub version of MEMEFLOW currently has no verified production wallet signing/execution engine.
AUTO AI is enabled and can analyze/decide/pass risk gates, but real BUY/SELL remains blocked with LIVE_EXECUTION_NOT_READY until that execution layer exists.
