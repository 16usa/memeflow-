(()=>{if(window.__MF_ACCESS_GATE__)return;window.__MF_ACCESS_GATE__=1;
const P=49.99,L=99.99;
const path=location.pathname;
const isVault=/\/smart-vault\.html$/.test(path);
if(!/\/(settings|trading|smart-vault)\.html$/.test(path))return;

const card=()=>isVault?`<div id="mf-access-gate"><div class="mf-ag-card">
<div class="mf-ag-lock" aria-hidden="true">
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M7 10V8a5 5 0 0 1 10 0v2" />
    <rect x="5" y="10" width="14" height="10" rx="3" />
    <path d="M12 14v2" />
  </svg>
</div>
<div class="mf-ag-kicker">MEMEFLOW ACCESS</div>
<h2>Hold MEMEFLOW<br>to unlock Smart Vault</h2>
<p>Smart Vault is available with LIVE access. Access is based on the current USD value of MEMEFLOW held in your connected wallet. <strong>No payment required.</strong></p>
<div class="mf-ag-tiers">
<div class="mf-ag-tier live"><b>LIVE MODE</b><span>Hold <strong>$${L}+ worth of MEMEFLOW</strong> · Smart Vault & real trading access</span></div>
</div>
<button class="mf-ag-btn" id="mf-ag-wallet-connect" type="button">CONNECT WALLET · CHECK MEMEFLOW BALANCE</button>
<div class="mf-ag-foot">No payment or subscription required. Your tokens stay in your wallet — MEMEFLOW only verifies your holdings.</div>
</div></div>`:`<div id="mf-access-gate"><div class="mf-ag-card">
<div class="mf-ag-lock" aria-hidden="true">
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M7 10V8a5 5 0 0 1 10 0v2" />
    <rect x="5" y="10" width="14" height="10" rx="3" />
    <path d="M12 14v2" />
  </svg>
</div>
<div class="mf-ag-kicker">MEMEFLOW ACCESS</div>
<h2>Hold MEMEFLOW<br>to unlock access</h2>
<p>Access is based on the current USD value of MEMEFLOW held in your connected wallet. <strong>No payment required.</strong></p>
<div class="mf-ag-tiers">
<div class="mf-ag-tier"><b>PEPPER MODE</b><span>Hold <strong>$${P}+ worth of MEMEFLOW</strong> · Training & simulated trading</span></div>
<div class="mf-ag-tier live"><b>LIVE MODE</b><span>Hold <strong>$${L}+ worth of MEMEFLOW</strong> · Real trading & Smart Vault</span></div>
</div>
<a class="mf-ag-btn" href="/smart-vault.html">CONNECT WALLET · CHECK MEMEFLOW BALANCE</a>
<div class="mf-ag-foot">No payment or subscription required. Your tokens stay in your wallet — MEMEFLOW only verifies your holdings.</div>
</div></div>`


function bindVaultConnect(){
 if(!isVault)return;
 const b=document.querySelector('#mf-ag-wallet-connect');
 if(!b||b.dataset.bound)return;
 b.dataset.bound='1';

 b.addEventListener('click',()=>{
   const candidates=[...document.querySelectorAll('button,a')].filter(x=>
     !x.closest('#mf-access-gate') &&
     /connect wallet|connect phantom|use phantom|phantom|solflare/i.test(
       (x.textContent||'').trim()
     )
   );

   const native=candidates.find(x=>!x.disabled);
   if(native){
     native.click();
     return;
   }

   const target=encodeURIComponent(location.href);
   location.href='https://phantom.app/ul/browse/'+target;
 });
}

function locked(){if(!document.querySelector('#mf-access-gate'))document.body.insertAdjacentHTML('beforeend',card());bindVaultConnect()}
function pepper(){document.querySelector('#mf-access-gate')?.remove();if(!document.querySelector('#mf-access-ribbon'))document.body.insertAdjacentHTML('beforeend','<div id="mf-access-ribbon">PEPPER ACTIVE · LIVE LOCKED AT $49.99</div>')}
function live(){document.querySelector('#mf-access-gate')?.remove();document.querySelector('#mf-access-ribbon')?.remove()}

async function sync(){
 try{
  const r=await fetch('/api/access/page',{credentials:'same-origin',cache:'no-store'});
  const s=await r.json();
  if(s.tier==='live')live();else if(s.tier==='pepper'&&!isVault)pepper();else locked();
 }catch{locked()}
}
sync();setInterval(sync,15000);
})();
