MEMEFLOW OPENAI PATCH V2

V2 fixes the V1 installer failure:
ERROR: route anchor not found

V2 no longer searches for one exact /api/ai/decisions line.
It detects the authenticated API section and inserts /api/openai/* safely after the AUTH_REQUIRED guard.
It also runs node --check automatically and rolls back if syntax validation fails.

INSTALL
cd ~/workspace/memeflow-app
python3 ../MEMEFLOW_OPENAI_PATCH_V2/install.py

Then add OPENAI_API_KEY in Replit Secrets and restart.

ROLLBACK
cd ~/workspace/memeflow-app
python3 ../MEMEFLOW_OPENAI_PATCH_V2/rollback.py
