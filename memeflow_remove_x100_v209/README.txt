MEMEFLOW REMOVE X100 ECONOMIC MODEL PAGE V209

Removes the page shown as:
  X100 NETWORK · ECONOMIC MODEL
  One token. One economic system.
  Draft economic model

The installer:
- identifies the production X100 page (normally memeflow-app/x100.html)
- first runs on a shadow copy
- removes active links/routes that point to the retired page
- deletes the page file
- deletes X100/economic-specific local assets only when they were referenced by
  that page and are not referenced by any other active production file
- audits the active production graph after removal
- automatically rolls back if any live X100 route/link remains
- does not touch trading, settings, API or backend logic
- does not restart the server
- does not git push

Install:
  unzip -o Memflow-Remove-X100-Page-V209.zip
  bash memeflow_remove_x100_v209/install.sh

Rollback:
  bash memeflow_remove_x100_v209/rollback.sh

Push after you visually verify:
  git add -A
  git commit -m "remove X100 economic model page"
  git push
