MEMEFLOW SYSTEM SETTINGS CLEANUP V191.3

Purpose
- Fully remove Public Agent runtime/UI/API/test feature even when old source markers were stripped.
- Remove Wallet & Smart Vault block from System Settings only.
- Preserve dedicated Smart Vault page and Execution & safety.
- Move Dark / Light selector into compact top System Settings metadata grid.

Safety
- Creates full backup of every modified/deleted file.
- Automatic rollback on ANY apply/syntax/audit failure.
- No server restart.
- Manual rollback remains available.

Install from existing Replit workspace Shell:
  unzip -o Memflow-System-Settings-Cleanup-V191.3.zip && bash memeflow_settings_cleanup_v191_3/install.sh

Rollback:
  bash memeflow_settings_cleanup_v191_3/rollback.sh

Compatibility note
- Preserves Agent Performance and __mfPublicAgentPerformanceCacheV1; that is a separate feature from the removed Public Agent publisher/entity.

V191.3 audit fix:
- scans only LIVE application sources
- ignores hidden historical rollback folders such as memeflow-app/.memeflow-backups
- keeps those backups intact for safety
- Agent Performance remains preserved and is not treated as Public Agent publisher/entity
