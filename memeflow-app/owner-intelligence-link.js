(() => {
  'use strict';

  if(window.__mfOwnerIntelligenceLinkV1)return;
  window.__mfOwnerIntelligenceLinkV1=true;

  async function mount(){
    try{
      const response=await fetch(
        '/api/owner/intelligence',
        {
          credentials:'same-origin',
          cache:'no-store'
        }
      );

      if(!response.ok)return;

      const data=await response.json();

      if(data?.owner!==true)return;

      if(
        document.getElementById(
          'ownerIntelligenceBtn'
        )
      ){
        return;
      }

      const host=
        document.querySelector(
          '.topbar .top-actions'
        );

      if(!host)return;

      const link=document.createElement('a');

      link.id='ownerIntelligenceBtn';
      link.href='/owner-intelligence.html';
      link.textContent='OWNER AI';

      const wallet=
        document.getElementById('walletBtn');

      if(wallet?.className){
        link.className=wallet.className;
      }else{
        link.className='wallet-btn';
      }

      link.style.textDecoration='none';
      link.style.display='inline-flex';
      link.style.alignItems='center';
      link.style.justifyContent='center';

      host.insertBefore(
        link,
        host.firstChild
      );

    }catch{}
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',
      mount,
      {once:true}
    );
  }else{
    mount();
  }
})();
