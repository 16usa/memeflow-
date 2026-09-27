(() => {
  if (window.__MEMEFLOW_EXECUTION_COMPACT_V193__) return;
  window.__MEMEFLOW_EXECUTION_COMPACT_V193__ = true;
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
  const labels=['paper automation','new entries','wallet for paper','live adapter'];
  const actionPattern=/^(review manually|start paper auto|pause paper auto|resume paper auto|pause new entries|resume new entries|emergency entry lock(?:\s*·\s*(?:on|off|active))?|activate entry lock|emergency lock active)$/i;
  const leaf=(root,text)=>[...root.querySelectorAll('*')].find(n=>n.children.length===0&&norm(n.textContent)===text)||null;
  const card=(n,g)=>n?.closest('.mf-account-stat,.mf293-field,.settings-summary > div,.setting-field,[class*="stat"],[class*="field"]')||(n?.parentElement!==g?n?.parentElement:null);
  function findGroup(){
    const direct=document.getElementById('mfExecutionRiskControls'); if(direct)return direct;
    const by=[...document.querySelectorAll('details')].find(d=>/execution\s*&\s*safety/i.test(d.querySelector(':scope > summary')?.textContent||'')); if(by)return by;
    return [...document.querySelectorAll('section,article,div')].find(n=>{const t=norm(n.textContent);return t.includes('execution & safety')&&t.includes('paper automation')&&t.includes('live adapter')})||null;
  }
  function wrap(nodes,cls,itemCls){
    const u=[...new Set(nodes.filter(Boolean))]; if(!u.length)return null;
    if(u[0].parentElement?.classList.contains(cls)){u.forEach(n=>n.classList.add(itemCls));return u[0].parentElement}
    const w=document.createElement('div');w.className=cls;u[0].parentNode.insertBefore(w,u[0]);u.forEach(n=>{n.classList.add(itemCls);w.appendChild(n)});return w;
  }
  function decorate(){
    const g=findGroup(); if(!g)return false; g.classList.add('mf-exec-v193');
    if(g.tagName==='DETAILS'){
      g.open=true;
      if(!g.dataset.mfV193OpenLock){g.dataset.mfV193OpenLock='1';g.addEventListener('toggle',()=>{if(!g.open)requestAnimationFrame(()=>g.open=true)})}
    }
    const cards=[];
    labels.forEach(x=>{const c=card(leaf(g,x),g);if(c&&c!==g)cards.push(c)});
    if(cards.length>=2&&!cards[0].parentElement?.classList.contains('mf-exec-status-grid-v193'))wrap(cards,'mf-exec-status-grid-v193','mf-exec-status-card-v193');
    const actions=[...g.querySelectorAll('button,[role="button"],a')].filter(n=>actionPattern.test(String(n.textContent||'').trim()));
    actions.forEach(n=>{n.classList.add('mf-exec-action-v193');if(/emergency|entry lock/i.test(n.textContent||''))n.classList.add('mf-exec-emergency-v193')});
    if(actions.length>=2&&!actions[0].parentElement?.classList.contains('mf-exec-action-grid-v193'))wrap(actions,'mf-exec-action-grid-v193','mf-exec-action-v193');
    const notes=[];
    [/single server state/i,/emergency entry lock:/i].forEach(rx=>{
      const l=[...g.querySelectorAll('*')].find(n=>rx.test(n.textContent||'')&&![...n.children].some(c=>rx.test(c.textContent||'')));
      const note=l?.closest('.mf-account-note,.mf293-field,.reason,[class*="note"],[class*="info"]')||l?.parentElement;
      if(note&&note!==g)notes.push(note);
    });
    const un=[...new Set(notes)];
    if(un.length&&!un[0].parentElement?.classList.contains('mf-exec-note-grid-v193'))wrap(un,'mf-exec-note-grid-v193','mf-exec-note-v193');
    return true;
  }
  let q=false;const schedule=()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;decorate()})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();