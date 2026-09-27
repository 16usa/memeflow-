MEMEFLOW SYSTEM SETTINGS CLEANUP V191

Purpose
- Remove Public Agent as a feature, not just visually:
  backend runtime/hooks, owner API routes, dry-run/test routes, Settings UI and Public Agent tests.
- Remove Wallet & Smart Vault block from System Settings only.
  Smart Vault itself remains in the project; wallet entry routes to /smart-vault.html.
- Keep Execution & safety on System Settings.
- Replace the large Appearance card with a compact Dark / Light selector inside the
  Platform / AI Policy / Kill Switch meta area.

Install (from existing Replit workspace Shell)
  unzip -o Memflow-System-Settings-Cleanup-V191.zip && bash memeflow_settings_cleanup_v191/install.sh

Rollback
  bash memeflow_settings_cleanup_v191/rollback.sh

The installer never restarts the server/system.
