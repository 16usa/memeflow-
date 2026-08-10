MEMEFLOW NATIVE AI STABLE V46

Why V45 could lag
-----------------
1. V45 changed startup to:
   node --import ./native-ai-bootstrap.mjs app-server.mjs
   If you start manually with `node app-server.mjs`, V45 server routes are not loaded.

2. V45 monkey-patched fs.createReadStream and http.createServer.
   That was unnecessary for this project because GitHub app-server.mjs is directly editable.

3. V45 did not remove the old V30 AI runtime tag.
   Old V30 and new V45 could both manipulate the AI button/sheet.

4. V45 installed a capture handler for ALL mobile navigation buttons.
   V46 binds only the AI button.

5. V45 called OpenAI status immediately at page load and used a global native-nav override.
   V46 checks status only when needed.

V46
---
- patches the real app-server.mjs directly
- restores normal console startup: node app-server.mjs
- removes V45 bootstrap
- removes old V30/V24 AI runtime script tags
- keeps V26/V44 Wallet + responsive layout layers
- preserves Home / Candidates / Positions / Wallet / More native sheets
- creates MEMEFLOW OpenAI as a true .mobile-sheet
- keeps the center AI button id compatible with V44
- no permanent MutationObserver / no recurring interval

INSTALL (DOES NOT START SERVER)
-------------------------------
cd ~/workspace
unzip -o MEMEFLOW_NATIVE_AI_STABLE_V46.zip
node MEMEFLOW_NATIVE_AI_STABLE_V46/apply-native-ai-v46.mjs
node MEMEFLOW_NATIVE_AI_STABLE_V46/verify-native-ai-v46.mjs

Expected:
V46 INSTALL OK: 7/7
V46 VERIFY OK: 12/12

After that you can start manually with:
node memeflow-app/app-server.mjs
(or cd memeflow-app && node app-server.mjs)

OPENAI_API_KEY must be present in Replit Secrets for AI responses.
