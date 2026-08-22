(()=>{
 const root=document.documentElement;
 const btn=document.getElementById('themeToggle');
 // Production release is intentionally locked to the verified dark palette.
 // Ignore and remove theme values saved by older preview builds so a stale
 // Safari localStorage entry cannot create a mixed light/dark interface.
 try{localStorage.removeItem('mf-theme');localStorage.removeItem('mf-theme-v2')}catch(_){ }
 root.dataset.theme='dark';
 const m=document.querySelector('meta[name="color-scheme"]');
 if(m)m.content='dark only';
 if(btn){btn.hidden=true;btn.setAttribute('aria-hidden','true');}
})();
