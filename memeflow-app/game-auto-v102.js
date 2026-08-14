(()=>{
  'use strict';

  const AUTO_VERSION='10.4';

  function bootAuto(){
    if(globalThis.__memeflowAutoPlayV104)return;

    const game=
      document.getElementById('game');

    const launchPanel=
      document.querySelector('.launch-panel');

    const start=
      document.getElementById('startBtn');

    const cash=
      document.getElementById('cashoutBtn');

    const playAgain=
      document.getElementById('playAgain');

    const result=
      document.getElementById('result');

    const stateMessage=
      document.getElementById('stateMessage');

    const balanceNode=
      document.getElementById('balanceTop');

    if(
      !game ||
      !launchPanel ||
      !start ||
      !cash ||
      !playAgain ||
      !result
    ){
      setTimeout(bootAuto,180);
      return;
    }

    globalThis.__memeflowAutoPlayV104=true;

    // ========================================================
    // HELPERS
    // ========================================================

    const state=()=>
      game.dataset.state||'idle';

    const money=n=>{
      n=Number(n)||0;

      return new Intl.NumberFormat(
        'en-US',
        {
          style:'currency',
          currency:'USD',
          minimumFractionDigits:2,
          maximumFractionDigits:2
        }
      ).format(n);
    };

    const numberFromText=value=>{
      const n=Number(
        String(value||'')
          .replace(/[^0-9.+-]/g,'')
      );

      return Number.isFinite(n)
        ?n
        :0;
    };

    const escapeHtml=value=>
      String(value??'')
        .replace(
          /[&<>"']/g,
          c=>({
            '&':'&amp;',
            '<':'&lt;',
            '>':'&gt;',
            '"':'&quot;',
            "'":'&#39;'
          }[c])
        );

    const durationText=ms=>{
      const sec=Math.max(
        0,
        Math.round((Number(ms)||0)/1000)
      );

      if(sec<60)
        return `${sec}s`;

      const m=Math.floor(sec/60);
      const s=sec%60;

      return `${m}m ${s}s`;
    };

    // ========================================================
    // AUTO BUTTON
    // ========================================================

    const button=
      document.createElement('button');

    button.id='mfAutoLoopBtn';
    button.type='button';
    button.setAttribute(
      'aria-pressed',
      'false'
    );

    button.innerHTML=`
      <span aria-hidden="true">↻</span>

      <div>
        <b>AUTO</b>
        <small>Continuous rounds</small>
      </div>
    `;

    cash.insertAdjacentElement(
      'afterend',
      button
    );

    // ========================================================
    // FINAL AUTO SESSION SUMMARY
    // ========================================================

    const summary=
      document.createElement('div');

    summary.id='mfAutoSummary';
    summary.hidden=true;

    summary.innerHTML=`
      <div class="mf-auto-summary-card">

        <header class="mf-auto-summary-head">
          <div>
            <small>AUTO SESSION COMPLETE</small>
            <h2>Flight report</h2>
            <p>
              All server-settled paper rounds from this AUTO run.
            </p>
          </div>

          <div
            class="mf-auto-summary-count"
            id="mfAutoSummaryCount"
          >
            0 ROUNDS
          </div>
        </header>

        <section class="mf-auto-summary-hero">
          <small>SESSION P&amp;L</small>

          <strong id="mfAutoSummaryProfit">
            $0.00
          </strong>

          <span id="mfAutoSummaryOutcome">
            AUTO stopped
          </span>
        </section>

        <section class="mf-auto-summary-stats">

          <div>
            <small>ROUNDS</small>
            <b id="mfAutoStatRounds">0</b>
          </div>

          <div>
            <small>WIN RATE</small>
            <b id="mfAutoStatWinRate">—</b>
          </div>

          <div>
            <small>W / L / VOID</small>
            <b id="mfAutoStatRecord">0 / 0 / 0</b>
          </div>

          <div>
            <small>TOTAL STAKED</small>
            <b id="mfAutoStatStake">$0.00</b>
          </div>

          <div>
            <small>TOTAL PAYOUT</small>
            <b id="mfAutoStatPayout">$0.00</b>
          </div>

          <div>
            <small>BEST</small>
            <b id="mfAutoStatBest">—</b>
          </div>

          <div>
            <small>AUTO TIME</small>
            <b id="mfAutoStatTime">—</b>
          </div>

          <div>
            <small>AVG EXIT</small>
            <b id="mfAutoStatAverage">—</b>
          </div>

        </section>

        <section class="mf-auto-deals">

          <div class="mf-auto-deals-head">
            <b>ALL ROUNDS</b>
            <small id="mfAutoDealsMeta"></small>
          </div>

          <div
            class="mf-auto-deals-list"
            id="mfAutoDealsList"
          ></div>

        </section>

        <button
          id="mfAutoSummaryClose"
          class="mf-auto-summary-close"
          type="button"
        >
          BACK TO GAME
        </button>

      </div>
    `;

    document.body.appendChild(summary);

    // ========================================================
    // STYLE
    // ========================================================

    const style=
      document.createElement('style');

    style.id='mfAutoPlayV104Style';

    style.textContent=`

      /* AUTO BUTTON */

      #mfAutoLoopBtn{
        width:100%;
        min-height:40px;
        flex:0 0 40px;

        margin:4px 0 0!important;

        border:
          1px solid
          rgba(109,220,255,.24);

        border-radius:10px;

        background:
          linear-gradient(
            180deg,
            rgba(109,220,255,.075),
            rgba(109,220,255,.025)
          );

        color:#dcebf1;

        display:flex;
        align-items:center;
        justify-content:center;

        gap:9px;

        cursor:pointer;
        text-align:left;
      }

      #mfAutoLoopBtn>span{
        font-size:15px;
        color:#6ddcff;
        line-height:1;
      }

      #mfAutoLoopBtn b{
        display:block;
        font-size:9px;
        letter-spacing:.11em;
      }

      #mfAutoLoopBtn small{
        display:block;
        margin-top:2px;

        font-size:6px;
        color:#74838e;
      }

      #mfAutoLoopBtn.is-active{
        border-color:
          rgba(100,236,169,.44);

        background:
          linear-gradient(
            180deg,
            rgba(100,236,169,.15),
            rgba(100,236,169,.045)
          );

        color:#effff5;
      }

      #mfAutoLoopBtn.is-active>span{
        color:#64eca9;

        animation:
          mfAutoSpin
          1.7s
          linear
          infinite;
      }

      @keyframes mfAutoSpin{
        to{
          transform:rotate(360deg);
        }
      }


      /* ============================================
         AUTO FINAL SUMMARY
         ============================================ */

      #mfAutoSummary{
        position:fixed;
        inset:0;

        z-index:2147483600;

        box-sizing:border-box;

        padding:
          max(
            12px,
            env(safe-area-inset-top)
          )
          max(
            8px,
            env(safe-area-inset-right)
          )
          max(
            12px,
            env(safe-area-inset-bottom)
          )
          max(
            8px,
            env(safe-area-inset-left)
          );

        background:
          radial-gradient(
            circle at 50% 32%,
            rgba(19,45,44,.18),
            transparent 48%
          ),
          rgba(2,5,7,.985);

        display:grid;
        place-items:center;
      }

      #mfAutoSummary[hidden]{
        display:none!important;
      }

      .mf-auto-summary-card{
        width:min(100%,820px);

        max-height:
          calc(
            100dvh
            - max(
                24px,
                env(safe-area-inset-top)
              )
            - max(
                24px,
                env(safe-area-inset-bottom)
              )
          );

        min-height:0;

        display:grid;

        grid-template-rows:
          auto
          auto
          auto
          minmax(120px,1fr)
          auto;

        overflow:hidden;

        border:
          1px solid
          rgba(114,153,165,.24);

        border-radius:24px;

        background:
          linear-gradient(
            180deg,
            rgba(12,22,26,.99),
            rgba(4,8,11,.995)
          );

        box-shadow:
          0 34px 100px
          rgba(0,0,0,.64);
      }

      .mf-auto-summary-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;

        gap:14px;

        padding:
          18px
          20px
          12px;
      }

      .mf-auto-summary-head small{
        color:#71848d;

        font-size:9px;
        font-weight:750;

        letter-spacing:.18em;
      }

      .mf-auto-summary-head h2{
        margin:5px 0 2px;

        color:#f0f7f8;

        font-size:24px;
        line-height:1;

        letter-spacing:-.035em;
      }

      .mf-auto-summary-head p{
        margin:5px 0 0;

        color:#71808a;

        font-size:10px;
      }

      .mf-auto-summary-count{
        flex:none;

        padding:
          7px
          10px;

        border:
          1px solid
          rgba(109,220,255,.20);

        border-radius:999px;

        color:#aeeeff;

        font-size:8px;
        font-weight:800;

        letter-spacing:.10em;
      }

      .mf-auto-summary-hero{
        padding:
          12px
          20px
          18px;

        text-align:center;
      }

      .mf-auto-summary-hero small{
        display:block;

        color:#75858e;

        font-size:9px;
        font-weight:800;

        letter-spacing:.17em;
      }

      .mf-auto-summary-hero strong{
        display:block;

        margin:5px 0 1px;

        color:#f0f6f8;

        font-size:
          clamp(
            42px,
            9vw,
            76px
          );

        line-height:.96;

        letter-spacing:-.065em;
      }

      .mf-auto-summary-hero strong.positive{
        color:#7cefc0;
      }

      .mf-auto-summary-hero strong.negative{
        color:#ff7889;
      }

      .mf-auto-summary-hero span{
        color:#8998a0;
        font-size:11px;
      }


      /* SESSION STAT GRID */

      .mf-auto-summary-stats{
        display:grid;

        grid-template-columns:
          repeat(4,1fr);

        margin:
          0
          20px
          12px;

        overflow:hidden;

        border:
          1px solid
          rgba(122,153,162,.16);

        border-radius:14px;
      }

      .mf-auto-summary-stats>div{
        min-width:0;

        padding:
          10px
          9px;

        border-right:
          1px solid
          rgba(122,153,162,.13);

        border-bottom:
          1px solid
          rgba(122,153,162,.13);

        text-align:center;
      }

      .mf-auto-summary-stats>div:nth-child(4n){
        border-right:0;
      }

      .mf-auto-summary-stats>div:nth-last-child(-n+4){
        border-bottom:0;
      }

      .mf-auto-summary-stats small{
        display:block;

        color:#697982;

        font-size:7px;
        letter-spacing:.12em;
      }

      .mf-auto-summary-stats b{
        display:block;

        margin-top:4px;

        color:#e8f0f2;

        font-size:12px;
      }


      /* ALL DEALS */

      .mf-auto-deals{
        min-height:0;

        margin:
          0
          20px
          12px;

        display:grid;

        grid-template-rows:
          auto
          minmax(0,1fr);

        overflow:hidden;

        border:
          1px solid
          rgba(122,153,162,.16);

        border-radius:14px;

        background:
          rgba(1,5,7,.35);
      }

      .mf-auto-deals-head{
        display:flex;
        justify-content:space-between;
        align-items:center;

        padding:
          9px
          11px;

        border-bottom:
          1px solid
          rgba(122,153,162,.13);
      }

      .mf-auto-deals-head b{
        color:#c7d3d7;

        font-size:8px;
        letter-spacing:.13em;
      }

      .mf-auto-deals-head small{
        color:#687781;
        font-size:7px;
      }

      .mf-auto-deals-list{
        min-height:0;

        overflow-y:auto;

        -webkit-overflow-scrolling:touch;

        overscroll-behavior:contain;
      }

      .mf-auto-deal{
        display:grid;

        grid-template-columns:
          minmax(120px,1.4fr)
          repeat(5,minmax(70px,.65fr));

        min-height:58px;

        border-bottom:
          1px solid
          rgba(122,153,162,.105);
      }

      .mf-auto-deal:last-child{
        border-bottom:0;
      }

      .mf-auto-deal>div{
        min-width:0;

        display:flex;
        flex-direction:column;
        justify-content:center;

        padding:
          7px
          9px;

        border-right:
          1px solid
          rgba(122,153,162,.09);
      }

      .mf-auto-deal>div:last-child{
        border-right:0;
      }

      .mf-auto-deal small{
        color:#64747d;

        font-size:6px;
        letter-spacing:.10em;
      }

      .mf-auto-deal b{
        margin-top:3px;

        overflow:hidden;
        white-space:nowrap;
        text-overflow:ellipsis;

        color:#dde7e9;

        font-size:9px;
      }

      .mf-auto-deal .deal-main b{
        font-size:10px;
      }

      .mf-auto-deal .deal-main span{
        margin-top:2px;

        overflow:hidden;
        white-space:nowrap;
        text-overflow:ellipsis;

        color:#74838b;

        font-size:6px;
      }

      .mf-auto-deal .positive{
        color:#68e8ae;
      }

      .mf-auto-deal .negative{
        color:#ff7888;
      }

      .mf-auto-deal .void{
        color:#a9b3b8;
      }

      .mf-auto-empty{
        height:100%;

        display:grid;
        place-items:center;

        padding:25px;

        color:#687780;

        font-size:10px;
      }


      /* FINAL BUTTON */

      .mf-auto-summary-close{
        height:56px;

        margin:
          0
          20px
          18px;

        border:0;
        border-radius:14px;

        background:
          linear-gradient(
            180deg,
            #effff5,
            #baf4ce
          );

        color:#06110b;

        font-size:12px;
        font-weight:900;

        letter-spacing:.13em;
      }


      /* PORTRAIT */

      @media(
        max-width:700px
      ){

        .mf-auto-summary-card{
          border-radius:18px;
        }

        .mf-auto-summary-head{
          padding:
            13px
            12px
            8px;
        }

        .mf-auto-summary-head h2{
          font-size:19px;
        }

        .mf-auto-summary-head p{
          font-size:8px;
        }

        .mf-auto-summary-hero{
          padding:
            5px
            12px
            10px;
        }

        .mf-auto-summary-hero strong{
          font-size:46px;
        }

        .mf-auto-summary-stats{
          grid-template-columns:
            repeat(4,1fr);

          margin:
            0
            12px
            8px;
        }

        .mf-auto-summary-stats>div{
          padding:
            7px
            3px;
        }

        .mf-auto-summary-stats small{
          font-size:5px;
        }

        .mf-auto-summary-stats b{
          font-size:9px;
        }

        .mf-auto-deals{
          margin:
            0
            12px
            8px;
        }

        .mf-auto-deal{
          grid-template-columns:
            minmax(0,1.4fr)
            repeat(3,minmax(0,.7fr));

          min-height:52px;
        }

        /*
          Keep the most useful four columns on phone:
          TOKEN / P&L / EXIT / PEAK.
        */
        .mf-auto-deal .deal-stake,
        .mf-auto-deal .deal-time{
          display:none;
        }

        .mf-auto-deal>div{
          padding:
            6px
            6px;
        }

        .mf-auto-summary-close{
          height:50px;

          margin:
            0
            12px
            12px;
        }
      }


      /* LANDSCAPE */

      @media(
        max-height:500px
      ){

        .mf-auto-summary-card{
          width:min(92vw,1000px);

          grid-template-columns:
            220px
            minmax(0,1fr);

          grid-template-rows:
            auto
            auto
            minmax(0,1fr)
            auto;
        }

        .mf-auto-summary-head{
          grid-column:1;
          grid-row:1;

          padding:
            12px
            12px
            6px;
        }

        .mf-auto-summary-head p{
          display:none;
        }

        .mf-auto-summary-hero{
          grid-column:1;
          grid-row:2;

          padding:
            3px
            12px
            8px;
        }

        .mf-auto-summary-hero strong{
          font-size:40px;
        }

        .mf-auto-summary-stats{
          grid-column:1;
          grid-row:3;

          grid-template-columns:
            repeat(2,1fr);

          margin:
            0
            10px
            7px;
        }

        .mf-auto-summary-stats>div{
          padding:5px 3px;
        }

        .mf-auto-summary-stats>div:nth-child(4n){
          border-right:
            1px solid
            rgba(122,153,162,.13);
        }

        .mf-auto-summary-stats>div:nth-child(2n){
          border-right:0;
        }

        .mf-auto-summary-stats>div:nth-last-child(-n+4){
          border-bottom:
            1px solid
            rgba(122,153,162,.13);
        }

        .mf-auto-summary-stats>div:nth-last-child(-n+2){
          border-bottom:0;
        }

        .mf-auto-deals{
          grid-column:2;
          grid-row:1 / span 3;

          margin:
            10px
            10px
            7px
            0;
        }

        .mf-auto-summary-close{
          grid-column:
            1 / span 2;

          grid-row:4;

          height:38px;

          margin:
            0
            10px
            9px;
        }
      }


      @media(
        max-width:1000px
      )
      and
      (orientation:landscape){

        #mfAutoLoopBtn{
          min-height:25px!important;
          height:25px!important;

          flex:
            0
            0
            25px!important;

          margin-top:1px!important;

          border-radius:7px!important;
        }

        #mfAutoLoopBtn>span{
          font-size:10px!important;
        }

        #mfAutoLoopBtn b{
          font-size:6px!important;
        }

        #mfAutoLoopBtn small{
          font-size:4.5px!important;
        }
      }

    `;

    document.head.appendChild(style);

    // ========================================================
    // SESSION STATE
    // ========================================================

    let enabled=false;

    /*
      User pressed STOP during LIVE/SETTLING.
      We wait for that final server-settled round and then
      show the one session summary.
    */
    let stopAfterCurrent=false;

    /*
      User pressed STOP while SCANNING.
      Cancel search first, then show summary.
    */
    let summaryAfterCancel=false;

    let sequence=0;
    let timer=null;
    let launchWatch=null;

    let previousState=state();

    let resetPending=false;
    let resetAttempts=0;
    let searchRetryAttempts=0;

    let stoppingSearch=false;

    let sessionStartedAt=0;
    let sessionStartBalance=0;

    let rounds=[];
    let roundIds=new Set();

    let summaryOpen=false;

    // ========================================================
    // DOM SUMMARY REFS
    // ========================================================

    const $=selector=>
      summary.querySelector(selector);

    const summaryCount=
      $('#mfAutoSummaryCount');

    const summaryProfit=
      $('#mfAutoSummaryProfit');

    const summaryOutcome=
      $('#mfAutoSummaryOutcome');

    const statRounds=
      $('#mfAutoStatRounds');

    const statWinRate=
      $('#mfAutoStatWinRate');

    const statRecord=
      $('#mfAutoStatRecord');

    const statStake=
      $('#mfAutoStatStake');

    const statPayout=
      $('#mfAutoStatPayout');

    const statBest=
      $('#mfAutoStatBest');

    const statTime=
      $('#mfAutoStatTime');

    const statAverage=
      $('#mfAutoStatAverage');

    const dealsMeta=
      $('#mfAutoDealsMeta');

    const dealsList=
      $('#mfAutoDealsList');

    const summaryClose=
      $('#mfAutoSummaryClose');

    // ========================================================
    // TIMERS
    // ========================================================

    function clearTimer(){
      if(timer){
        clearTimeout(timer);
        timer=null;
      }
    }

    function clearLaunchWatch(){
      if(launchWatch){
        clearTimeout(launchWatch);
        launchWatch=null;
      }
    }

    function schedule(fn,delay){
      clearTimer();

      const own=sequence;

      timer=setTimeout(
        ()=>{
          timer=null;

          if(
            !enabled ||
            own!==sequence
          ){
            return;
          }

          if(
            document.hidden ||
            navigator.onLine===false
          ){
            schedule(fn,900);
            return;
          }

          fn();
        },
        Math.max(120,delay)
      );
    }

    // ========================================================
    // UI
    // ========================================================

    function message(text){
      if(stateMessage&&text)
        stateMessage.textContent=text;
    }

    function syncButton(){
      const current=state();

      button.classList.toggle(
        'is-active',
        enabled||stopAfterCurrent
      );

      button.setAttribute(
        'aria-pressed',
        enabled?'true':'false'
      );

      game.dataset.autoLoop=
        enabled
          ?'on'
          :stopAfterCurrent
            ?'stopping'
            :'off';

      const title=
        button.querySelector('b');

      const hint=
        button.querySelector('small');

      if(title){
        title.textContent=
          stopAfterCurrent
            ?'STOPPING…'
            :enabled
              ?'STOP AUTO'
              :'AUTO';
      }

      if(hint){

        if(stopAfterCurrent){
          hint.textContent=
            'Waiting for current round';

        }else if(!enabled){
          hint.textContent=
            'Continuous rounds';

        }else if(current==='searching'){
          hint.textContent=
            'Scanning · tap to stop';

        }else if(current==='live'){
          hint.textContent=
            'Next round automatic';

        }else if(current==='settling'){
          hint.textContent=
            'Settling current round';

        }else{
          hint.textContent=
            'Auto play active';
        }
      }
    }

    // ========================================================
    // CAPTURE COMPLETE SERVER ROUND
    // ========================================================

    function captureRound(s){
      if(!s || s.state!=='COMPLETE')
        return null;

      const id=
        String(
          s.id ||
          `${s.completedAt||Date.now()}-${rounds.length}`
        );

      if(roundIds.has(id))
        return null;

      roundIds.add(id);

      const profit=
        Number(s.profit)||0;

      const voided=
        s.voided===true;

      const multiplier=
        Number(s.multiplier)||0;

      const peak=
        Number(s.peak)||1;

      const startedAt=
        Number(s.startedAt)||0;

      const completedAt=
        Number(s.completedAt)||Date.now();

      const durationMs=
        startedAt
          ?Math.max(0,completedAt-startedAt)
          :0;

      const token=
        s.token||{};

      const symbol=
        String(
          token.symbol ||
          token.ticker ||
          token.name ||
          `ROUND ${rounds.length+1}`
        );

      const reason=
        String(
          s.reason||
          'ROUND_COMPLETE'
        ).replaceAll('_',' ');

      const row={
        id,
        index:rounds.length+1,

        symbol,
        reason,

        voided,

        stake:
          Number(s.bet)||0,

        payout:
          Number(s.payout)||0,

        profit,

        multiplier,

        peak,

        drawdown:
          Number(s.maxDrawdownPct)||0,

        adverse:
          Number(s.maxAdverseExcursionPct)||0,

        quality:
          Number(
            token.launchQuality ??
            s.marketShapeAtEntry?.quality
          )||0,

        entryPrice:
          Number(s.entryPrice)||0,

        exitPrice:
          Number(s.currentPrice)||0,

        priceUpdates:
          Number(s.priceUpdateCount)||0,

        durationMs,

        completedAt,

        autoCashout:
          Number(s.autoCashout)||0,

        stopLoss:
          Number(s.stopLoss)||0
      };

      rounds.push(row);

      return row;
    }

    // ========================================================
    // RENDER FINAL SESSION SUMMARY
    // ========================================================

    function renderSummary(){

      const total=
        rounds.length;

      const valid=
        rounds.filter(
          r=>!r.voided
        );

      const wins=
        valid.filter(
          r=>r.profit>0.005
        ).length;

      const losses=
        valid.filter(
          r=>r.profit<-.005
        ).length;

      const pushes=
        valid.length-wins-losses;

      const voids=
        rounds.filter(
          r=>r.voided
        ).length;

      const totalProfit=
        rounds.reduce(
          (sum,r)=>sum+r.profit,
          0
        );

      const totalStake=
        rounds.reduce(
          (sum,r)=>sum+r.stake,
          0
        );

      const totalPayout=
        rounds.reduce(
          (sum,r)=>sum+r.payout,
          0
        );

      const best=
        valid.length
          ?Math.max(
              ...valid.map(
                r=>r.multiplier
              )
            )
          :0;

      const avg=
        valid.length
          ?valid.reduce(
              (sum,r)=>sum+r.multiplier,
              0
            )/valid.length
          :0;

      const winRate=
        wins+losses
          ?wins/(wins+losses)*100
          :0;

      const elapsed=
        sessionStartedAt
          ?Date.now()-sessionStartedAt
          :0;

      summaryCount.textContent=
        `${total} ${total===1?'ROUND':'ROUNDS'}`;

      summaryProfit.textContent=
        `${totalProfit>0?'+':''}${money(totalProfit)}`;

      summaryProfit.className=
        totalProfit>.005
          ?'positive'
          :totalProfit<-.005
            ?'negative'
            :'';

      summaryOutcome.textContent=
        total===0
          ?'No completed rounds'
          :totalProfit>0
            ?'AUTO session finished in profit'
            :totalProfit<0
              ?'AUTO session finished at a loss'
              :'AUTO session finished flat';

      statRounds.textContent=
        String(total);

      statWinRate.textContent=
        wins+losses
          ?`${winRate.toFixed(0)}%`
          :'—';

      statRecord.textContent=
        `${wins} / ${losses} / ${voids}`;

      statStake.textContent=
        money(totalStake);

      statPayout.textContent=
        money(totalPayout);

      statBest.textContent=
        best>0
          ?`${best.toFixed(2)}×`
          :'—';

      statTime.textContent=
        durationText(elapsed);

      statAverage.textContent=
        avg>0
          ?`${avg.toFixed(2)}×`
          :'—';

      const endBalance=
        numberFromText(
          balanceNode?.textContent
        );

      dealsMeta.textContent=
        sessionStartBalance>0 && endBalance>0
          ?`${money(sessionStartBalance)} → ${money(endBalance)}`
          :`${wins} W · ${losses} L${pushes?` · ${pushes} PUSH`:''}`;

      if(!rounds.length){

        dealsList.innerHTML=`
          <div class="mf-auto-empty">
            No completed rounds in this AUTO session.
          </div>
        `;

        return;
      }

      dealsList.innerHTML=
        rounds
          .map(
            r=>{

              const pnlClass=
                r.voided
                  ?'void'
                  :r.profit>.005
                    ?'positive'
                    :r.profit<-.005
                      ?'negative'
                      :'';

              const pnl=
                r.voided
                  ?'VOID'
                  :`${r.profit>0?'+':''}${money(r.profit)}`;

              return `
                <article class="mf-auto-deal">

                  <div class="deal-main">
                    <small>
                      #${r.index} · ${escapeHtml(r.reason)}
                    </small>

                    <b>
                      ${escapeHtml(r.symbol)}
                    </b>

                    <span>
                      ${new Date(r.completedAt)
                        .toLocaleTimeString(
                          [],
                          {
                            hour:'2-digit',
                            minute:'2-digit'
                          }
                        )}
                    </span>
                  </div>

                  <div class="deal-stake">
                    <small>STAKE</small>
                    <b>${money(r.stake)}</b>
                  </div>

                  <div>
                    <small>P&amp;L</small>
                    <b class="${pnlClass}">
                      ${pnl}
                    </b>
                  </div>

                  <div>
                    <small>EXIT</small>
                    <b>
                      ${r.voided
                        ?'VOID'
                        :`${r.multiplier.toFixed(2)}×`
                      }
                    </b>
                  </div>

                  <div>
                    <small>PEAK</small>
                    <b>
                      ${r.peak.toFixed(2)}×
                    </b>
                  </div>

                  <div class="deal-time">
                    <small>FLIGHT</small>
                    <b>
                      ${durationText(r.durationMs)}
                    </b>
                  </div>

                </article>
              `;
            }
          )
          .join('');
    }

    function showSummary(){
      if(summaryOpen)
        return;

      clearTimer();
      clearLaunchWatch();

      summaryOpen=true;

      renderSummary();

      summary.hidden=false;

      game.inert=true;

      requestAnimationFrame(
        ()=>{
          summaryClose.focus({
            preventScroll:true
          });
        }
      );
    }

    async function closeSummary(){
      if(!summaryOpen)
        return;

      summaryOpen=false;
      summary.hidden=true;

      game.inert=false;

      /*
        If STOP AUTO happened while the final round was
        LIVE, server state is COMPLETE behind this summary.
        Reuse the existing authoritative reset operation
        when the user closes the report.
      */
      if(state()==='complete'){

        if(!playAgain.disabled){
          playAgain.click();
        }
      }

      message(
        'AUTO session finished. Ready when you are.'
      );
    }

    // ========================================================
    // AUTO START / RESET
    // ========================================================

    function requestStart(){

      if(
        !enabled ||
        state()!=='idle'
      ){
        return;
      }

      if(
        document.hidden ||
        navigator.onLine===false
      ){
        schedule(
          requestStart,
          900
        );

        return;
      }

      const own=
        sequence;

      clearLaunchWatch();

      start.click();

      launchWatch=
        setTimeout(
          ()=>{

            launchWatch=null;

            if(
              !enabled ||
              own!==sequence
            ){
              return;
            }

            /*
              If the Game is still idle, START was rejected.
            */
            if(state()==='idle'){

              enabled=false;

              clearTimer();

              syncButton();

              message(
                'AUTO stopped · check paper balance, stake or Game status.'
              );
            }

          },
          1400
        );
    }

    function requestReset(){

      if(
        !enabled ||
        state()!=='complete'
      ){
        return;
      }

      if(playAgain.disabled){

        schedule(
          requestReset,
          450
        );

        return;
      }

      resetPending=true;
      resetAttempts++;

      playAgain.click();

      const own=
        sequence;

      setTimeout(
        ()=>{

          if(
            !enabled ||
            own!==sequence
          ){
            return;
          }

          if(state()==='complete'){

            if(resetAttempts<3){

              schedule(
                requestReset,
                850
              );

            }else{

              enabled=false;

              clearTimer();

              syncButton();

              message(
                'AUTO stopped · server reset did not complete.'
              );
            }
          }

        },
        3500
      );
    }

    // ========================================================
    // CANCEL SEARCH RELIABLY
    // ========================================================

    function cancelCurrentSearch(){

      if(state()!=='searching'){

        stoppingSearch=false;

        if(summaryAfterCancel){
          summaryAfterCancel=false;
          showSummary();
        }

        return;
      }

      stoppingSearch=true;

      const attempt=()=>{

        if(state()!=='searching'){

          stoppingSearch=false;

          if(summaryAfterCancel){
            summaryAfterCancel=false;
            showSummary();
          }

          return;
        }

        /*
          Main Game arms CANCEL SEARCH about 700 ms
          after START. Wait until the label is ready.
        */
        if(
          /CANCEL SEARCH/i.test(
            start.textContent||''
          )
        ){

          start.click();

          setTimeout(
            ()=>{
              if(state()==='searching')
                attempt();
            },
            250
          );

        }else{

          setTimeout(
            attempt,
            180
          );
        }
      };

      attempt();
    }

    // ========================================================
    // STOP AUTO
    // ========================================================

    function stopAuto(){

      if(
        !enabled &&
        !stopAfterCurrent
      ){
        return;
      }

      clearTimer();
      clearLaunchWatch();

      const current=
        state();

      /*
        LIVE:
        Do NOT kill the paper round.
        Finish it normally, capture it, then show summary.
      */
      if(
        current==='live' ||
        current==='settling'
      ){

        enabled=false;
        stopAfterCurrent=true;

        sequence++;

        syncButton();

        message(
          'AUTO stopping after the current paper round…'
        );

        return;
      }

      enabled=false;
      sequence++;

      syncButton();

      /*
        SEARCH:
        Cancel only the selector search, then show all
        rounds completed during this AUTO session.
      */
      if(current==='searching'){

        summaryAfterCancel=true;

        message(
          'Stopping AUTO and closing market search…'
        );

        cancelCurrentSearch();

        return;
      }

      /*
        COMPLETE:
        Round was already captured by handleRoundResult.
      */
      if(current==='complete'){

        showSummary();
        return;
      }

      /*
        IDLE:
        AUTO stopped between rounds.
      */
      showSummary();
    }

    // ========================================================
    // START AUTO SESSION
    // ========================================================

    function startAuto(){

      if(enabled || stopAfterCurrent)
        return;

      if(summaryOpen)
        return;

      rounds=[];
      roundIds.clear();

      resetPending=false;
      resetAttempts=0;
      searchRetryAttempts=0;

      summaryAfterCancel=false;
      stoppingSearch=false;

      sessionStartedAt=
        Date.now();

      sessionStartBalance=
        numberFromText(
          balanceNode?.textContent
        );

      enabled=true;
      sequence++;

      syncButton();

      const current=
        state();

      /*
        User can arm AUTO while a manual round is already
        live; that current round becomes round #1 of the
        AUTO session.
      */
      if(current==='live'){

        message(
          'AUTO armed. Current round will be included in the session.'
        );

        return;
      }

      if(current==='settling'){

        message(
          'AUTO armed. Waiting for the current round to settle.'
        );

        return;
      }

      if(current==='searching'){

        message(
          'AUTO armed. Current market search continues.'
        );

        return;
      }

      if(current==='complete'){

        /*
          Existing manual result should remain manual.
          User should close it first.
        */
        enabled=false;

        syncButton();

        message(
          'Close the current round result before starting AUTO.'
        );

        return;
      }

      requestStart();
    }

    function toggleAuto(){

      if(enabled || stopAfterCurrent)
        stopAuto();
      else
        startAuto();
    }

    // ========================================================
    // V10.4 RESULT INTERCEPT
    //
    // Called directly by main game.js BEFORE normal modal.
    // ========================================================

    function handleRoundResult(s){

      /*
        MANUAL MODE:
        Let the existing one-round result screen work
        exactly as before.
      */
      if(
        !enabled &&
        !stopAfterCurrent
      ){
        return false;
      }

      captureRound(s);

      /*
        User previously pressed STOP AUTO during LIVE.
        This is the final round. Suppress its individual
        result screen and show the complete session report.
      */
      if(stopAfterCurrent){

        stopAfterCurrent=false;
        enabled=false;

        clearTimer();
        clearLaunchWatch();

        syncButton();

        setTimeout(
          showSummary,
          80
        );

        return true;
      }

      /*
        Normal AUTO round:
        Never show the individual result window.
        Reset server round and continue.
      */
      if(enabled){

        resetPending=true;

        clearTimer();

        const own=
          sequence;

        timer=setTimeout(
          ()=>{

            timer=null;

            if(
              !enabled ||
              own!==sequence
            ){
              return;
            }

            requestReset();

          },
          450
        );

        return true;
      }

      return false;
    }

    // ========================================================
    // GAME STATE OBSERVER
    // ========================================================

    function onStateChange(){

      const current=
        state();

      if(current===previousState){

        syncButton();
        return;
      }

      const old=
        previousState;

      previousState=
        current;

      clearLaunchWatch();

      syncButton();

      /*
        STOP SEARCH finished.
      */
      if(
        summaryAfterCancel &&
        current==='idle'
      ){

        summaryAfterCancel=false;
        stoppingSearch=false;

        showSummary();
        return;
      }

      if(!enabled)
        return;

      /*
        Server reset finished:
        COMPLETE -> IDLE -> next search.
      */
      if(
        current==='idle' &&
        (
          resetPending ||
          old==='complete' ||
          old==='settling'
        )
      ){

        resetPending=false;
        resetAttempts=0;
        searchRetryAttempts=0;

        schedule(
          requestStart,
          320
        );

        return;
      }

      /*
        Unexpected SEARCHING -> IDLE:
        AUTO stays armed and starts another selector scan.
      */
      if(
        current==='idle' &&
        old==='searching' &&
        !stoppingSearch
      ){

        searchRetryAttempts++;

        const delay=
          Math.min(
            7000,
            650+
            searchRetryAttempts*600
          );

        message(
          'AUTO active · restarting market search…'
        );

        schedule(
          requestStart,
          delay
        );

        return;
      }

      if(current==='live'){

        resetPending=false;
        resetAttempts=0;
        searchRetryAttempts=0;
      }
    }

    const observer=
      new MutationObserver(
        onStateChange
      );

    observer.observe(
      game,
      {
        attributes:true,
        attributeFilter:[
          'data-state'
        ]
      }
    );

    // ========================================================
    // EVENTS
    // ========================================================

    button.addEventListener(
      'click',
      toggleAuto
    );

    summaryClose.addEventListener(
      'click',
      closeSummary
    );

    document.addEventListener(
      'visibilitychange',
      ()=>{

        if(
          !document.hidden &&
          enabled &&
          state()==='idle' &&
          resetPending
        ){

          schedule(
            requestStart,
            250
          );
        }
      }
    );

    addEventListener(
      'online',
      ()=>{

        if(
          enabled &&
          state()==='idle' &&
          resetPending
        ){

          schedule(
            requestStart,
            250
          );
        }
      }
    );

    syncButton();

    // ========================================================
    // PUBLIC BRIDGE USED BY game.js
    // ========================================================

    globalThis.memeflowAutoPlay={
      version:AUTO_VERSION,

      start:startAuto,
      stop:stopAuto,
      toggle:toggleAuto,

      handleRoundResult,

      showSummary,

      get enabled(){
        return enabled;
      },

      get rounds(){
        return [...rounds];
      }
    };

    console.info(
      '[MEMEFLOW AUTO]',
      AUTO_VERSION,
      'SESSION SUMMARY READY'
    );
  }

  if(
    document.readyState==='complete'
  ){

    bootAuto();

  }else{

    addEventListener(
      'load',
      bootAuto,
      {
        once:true
      }
    );
  }

})();
