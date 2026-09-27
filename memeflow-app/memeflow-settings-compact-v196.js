(() => {
  if (window.__MEMEFLOW_SETTINGS_COMPACT_V196__) return;
  window.__MEMEFLOW_SETTINGS_COMPACT_V196__ = true;
  function forceExecutionOpen() {
    const group = document.getElementById('mfExecutionSettingsGroup');
    if (!group) return false;
    group.open = true;
    if (!group.dataset.mfV196OpenLock) {
      group.dataset.mfV196OpenLock = '1';
      group.addEventListener('toggle', () => {
        if (!group.open) requestAnimationFrame(() => { group.open = true; });
      });
    }
    return true;
  }
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; forceExecutionOpen(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once:true});
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true});
})();
