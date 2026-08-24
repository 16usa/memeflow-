// MEMEFLOW_COPY_TRADING_V1
// Mirrors Pump TradeEvents from a configured Solana wallet into the existing
// PAPER engine. LIVE execution remains fail-closed until the verified signing
// adapter exists in app-server.mjs.

const WSOL_MINT='So11111111111111111111111111111111111111112';
const asString=v=>String(v??'').trim();
const num=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f};
const nowIso=()=>new Date().toISOString();

export class CopyTradingManager{
  constructor({store,paper,rpc,logger=console,clock=()=>Date.now()}={}){
    if(!store?.state)throw new TypeError('CopyTradingManager requires store');
    if(!paper)throw new TypeError('CopyTradingManager requires paper engine');
    this.store=store;
    this.paper=paper;
    this.rpc=rpc;
    this.logger=logger;
    this.clock=clock;
    this.shadowBalances=new Map();
    this.reliableShadow=new Set();
    this.ensureState();
  }

  ensureState(){
    this.store.state.copyTradingEvents ||= {};
    this.store.state.copyTradingMetrics ||= {
      matched:0,buys:0,sells:0,rejected:0,errors:0,lastEventAt:null
    };
  }

  save(){this.ensureState();this.store.save?.()}

  enabledUsers(wallet){
    const target=asString(wallet);
    if(!target)return [];
    const out=[];
    for(const user of Object.values(this.store.state.users||{})){
      const s=user?.settings||{};
      if(s.copyTradingEnabled!==true)continue;
      if(asString(s.copyTradingWallet)!==target)continue;
      out.push({user,settings:s});
    }
    return out;
  }

  async onTradeEvent(event,token){
    this.ensureState();
    const wallet=asString(event?.user),mint=asString(event?.mint);
    if(!wallet||!mint||mint===WSOL_MINT)return {matched:0};
    const matches=this.enabledUsers(wallet);
    if(!matches.length)return {matched:0};

    this.store.state.copyTradingMetrics.matched+=matches.length;
    this.store.state.copyTradingMetrics.lastEventAt=this.clock();

    let sellInfo=null;
    if(event.isBuy!==true){
      const wantsSell=matches.some(x=>x.settings.copyTradingMirrorSells!==false);
      if(wantsSell)sellInfo=await this.resolveSellInfo(wallet,mint,event);
    }

    const results=[];
    for(const {user,settings} of matches){
      try{
        const result=await this.processUser(user,settings,event,token,sellInfo);
        results.push({userId:user.id,...result});
      }catch(error){
        this.store.state.copyTradingMetrics.errors++;
        this.record(user.id,event,'ERROR',{code:'COPY_TRADING_ERROR',message:String(error?.message||error)});
        this.logger?.warn?.('[copy-trading]',error?.message||error);
        results.push({userId:user.id,ok:false,code:'COPY_TRADING_ERROR'});
      }
    }

    this.updateShadow(wallet,mint,event,sellInfo);
    this.save();
    return {matched:matches.length,results};
  }

  async processUser(user,settings,event,token,sellInfo){
    if(user?.killSwitch===true)return this.reject(user.id,event,'KILL_SWITCH');
    if(String(settings.tradingEnvironment||'paper').toLowerCase()!=='paper'){
      return this.reject(user.id,event,'LIVE_EXECUTION_NOT_READY');
    }

    if(event.isBuy===true)return this.mirrorBuy(user.id,settings,event,token);
    if(settings.copyTradingMirrorSells===false)return {ok:true,action:'SELL_IGNORED'};
    if(!sellInfo?.fraction||sellInfo.fraction<=0)return this.reject(user.id,event,'SELL_FRACTION_UNKNOWN');
    return this.mirrorSell(user.id,settings,event,token,sellInfo.fraction);
  }

  reject(userId,event,code){
    this.store.state.copyTradingMetrics.rejected++;
    this.record(userId,event,'REJECTED',{code});
    return {ok:false,code};
  }

  mirrorBuy(userId,settings,event,token){
    const size=num(settings.copyTradingBuyAmountSol,0);
    const price=num(token?.priceSol,NaN);
    if(!(size>0))return this.reject(userId,event,'INVALID_COPY_BUY_SIZE');
    if(!(price>0))return this.reject(userId,event,'INVALID_PRICE');

    const existing=this.paper.openForMint?.(userId,event.mint)||null;
    if(existing){
      const maxPosition=num(settings.maxPositionSize,Infinity);
      const nextInitial=num(existing.initialSizeSol)+size;
      if(nextInitial>maxPosition+1e-12)return this.reject(userId,event,'MAX_POSITION_SIZE');

      const spent=num(this.paper.dailySpent?.(userId),0);
      if(num(settings.dailySpendLimit,0)>0&&spent+size>num(settings.dailySpendLimit)+1e-12){
        return this.reject(userId,event,'DAILY_SPEND_LIMIT');
      }

      const open=this.paper.userPositions?.(userId,'OPEN')||[];
      const deployed=open.reduce((sum,p)=>sum+num(p.remainingSizeSol),0);
      if(num(settings.tradingCapital,0)>0&&deployed+size>num(settings.tradingCapital)+1e-12){
        return this.reject(userId,event,'PAPER_CAPITAL_LIMIT');
      }

      const oldQty=num(existing.remainingTokenQuantity);
      const addQty=size/price;
      const oldCost=oldQty*num(existing.entryPriceSol,price);
      const newQty=oldQty+addQty;
      const weighted=newQty>0?(oldCost+size)/newQty:price;

      existing.entryPriceSol=weighted;
      existing.currentPriceSol=price;
      existing.initialSizeSol=nextInitial;
      existing.remainingSizeSol=num(existing.remainingSizeSol)+size;
      existing.initialTokenQuantity=num(existing.initialTokenQuantity)+addQty;
      existing.remainingTokenQuantity=newQty;
      existing.highestPriceSol=Math.max(num(existing.highestPriceSol,price),price);
      existing.strategySource='copy-trading';
      existing.copyTradingWallet=settings.copyTradingWallet;
      existing.settingsSnapshot={...existing.settingsSnapshot,...settings};
      this.paper.recordTrade(existing,'BUY',addQty,price,0,'COPY TRADING BUY');
      this.store.state.copyTradingMetrics.buys++;
      this.record(userId,event,'SCALED_IN',{positionId:existing.id,sizeSol:size,priceSol:price});
      this.paper.save?.();
      return {ok:true,action:'SCALED_IN',position:existing};
    }

    const copySettings={...settings,positionSize:size};
    const freshToken={
      ...(token||{}),mint:event.mint,priceSol:price,
      holderFresh:true,updatedAt:this.clock(),lastPriceAt:this.clock()
    };
    const decision={
      id:`copy:${settings.copyTradingWallet}:${event.mint}:${this.clock()}`,
      state:'BUY READY',score:null,confidence:null,
      primaryReason:`Mirrored BUY from ${settings.copyTradingWallet}`
    };
    const result=this.paper.openPosition(
      userId,freshToken,decision,copySettings,
      `copy:${settings.copyTradingWallet}:${event.mint}:${this.clock()}`
    );
    if(!result?.ok)return this.reject(userId,event,result?.code||'PAPER_ENTRY_REJECTED');

    result.position.strategySource='copy-trading';
    result.position.copyTradingWallet=settings.copyTradingWallet;
    result.position.copyTradingSource='pump-trade-event';
    this.store.state.copyTradingMetrics.buys++;
    this.record(userId,event,'OPENED',{positionId:result.position.id,sizeSol:size,priceSol:price});
    this.paper.save?.();
    return {ok:true,action:'OPENED',position:result.position};
  }

  mirrorSell(userId,settings,event,token,fraction){
    const position=this.paper.openForMint?.(userId,event.mint)||null;
    if(!position)return {ok:true,action:'NO_POSITION'};
    const price=num(token?.priceSol,position.currentPriceSol||position.entryPriceSol);
    if(!(price>0))return this.reject(userId,event,'INVALID_PRICE');

    const clipped=Math.max(0,Math.min(1,num(fraction)));
    const quantity=num(position.remainingTokenQuantity)*clipped;
    if(!(quantity>0))return {ok:true,action:'NO_POSITION'};

    this.paper.partialExit(position,quantity,price,'COPY TRADING SELL');
    this.store.state.copyTradingMetrics.sells++;
    this.record(userId,event,'SOLD',{
      positionId:position.id,sellFraction:clipped,quantity,priceSol:price
    });
    this.paper.save?.();
    return {ok:true,action:'SOLD',position,sellFraction:clipped};
  }

  async resolveSellInfo(wallet,mint,event){
    const soldFromEvent=BigInt(event?.tokenAmount??0);
    if(soldFromEvent<=0n)return null;

    // Best path: the Pump WS feed carries the confirmed transaction signature.
    // Read that exact transaction and calculate the target wallet's pre/post
    // raw token balance. This is immune to a later trade racing our RPC call.
    if(this.rpc?.call&&event?.signature){
      try{
        const tx=await this.rpc.call('getTransaction',[
          event.signature,
          {encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}
        ]);
        const meta=tx?.meta;
        const sumOwner=(rows=[])=>rows.reduce((sum,row)=>{
          if(row?.mint!==mint||row?.owner!==wallet)return sum;
          const raw=row?.uiTokenAmount?.amount;
          return raw==null?sum:sum+BigInt(raw);
        },0n);
        const pre=sumOwner(meta?.preTokenBalances||[]);
        const post=sumOwner(meta?.postTokenBalances||[]);
        if(pre>0n&&post<=pre){
          const sold=pre-post;
          if(sold>0n){
            const million=1_000_000n;
            const fraction=Number((sold*million)/pre)/1_000_000;
            return {fraction:Math.max(0,Math.min(1,fraction)),postRaw:post,source:'transaction'};
          }
        }
      }catch(error){
        this.logger?.warn?.('[copy-trading] exact transaction lookup fallback',error?.message||error);
      }
    }

    // Secondary path: after the confirmed sell, ask Solana for the wallet's
    // current remaining balance. pre = post + event sold amount.
    if(this.rpc?.call){
      try{
        const result=await this.rpc.call('getTokenAccountsByOwner',[
          wallet,{mint},{encoding:'jsonParsed',commitment:'confirmed'}
        ]);
        let post=0n;
        for(const row of result?.value||[]){
          const raw=row?.account?.data?.parsed?.info?.tokenAmount?.amount;
          if(raw!=null)post+=BigInt(raw);
        }
        const pre=post+soldFromEvent;
        if(pre>0n){
          const million=1_000_000n;
          const fraction=Number((soldFromEvent*million)/pre)/1_000_000;
          return {fraction:Math.max(0,Math.min(1,fraction)),postRaw:post,source:'account-balance'};
        }
      }catch(error){
        this.logger?.warn?.('[copy-trading] sell fraction balance fallback',error?.message||error);
      }
    }

    // Final fail-closed fallback: only use a shadow balance after it has
    // previously been anchored by an exact RPC result. Never guess from an
    // unverified local balance.
    const key=`${wallet}:${mint}`;
    const before=this.shadowBalances.get(key);
    if(this.reliableShadow.has(key)&&typeof before==='bigint'&&before>0n){
      const clipped=soldFromEvent>before?before:soldFromEvent;
      const million=1_000_000n;
      const fraction=Number((clipped*million)/before)/1_000_000;
      return {fraction:Math.max(0,Math.min(1,fraction)),postRaw:before-clipped,source:'shadow'};
    }
    return null;
  }

  updateShadow(wallet,mint,event,sellInfo){
    const key=`${wallet}:${mint}`;
    if(event.isBuy===true){
      if(this.reliableShadow.has(key)){
        const prev=this.shadowBalances.get(key)||0n;
        this.shadowBalances.set(key,prev+BigInt(event?.tokenAmount??0));
      }
      return;
    }
    if(sellInfo&&typeof sellInfo.postRaw==='bigint'){
      this.shadowBalances.set(key,sellInfo.postRaw);
      this.reliableShadow.add(key);
    }
  }

  record(userId,event,result,extra={}){
    this.ensureState();
    const id=`${this.clock()}:${Math.random().toString(36).slice(2,10)}`;
    this.store.state.copyTradingEvents[id]={
      id,userId,at:this.clock(),atIso:nowIso(),result,
      trackedWallet:event?.user||null,mint:event?.mint||null,
      side:event?.isBuy===true?'BUY':'SELL',
      sourceSolAmount:event?.solAmount!=null?String(event.solAmount):null,
      sourceTokenAmount:event?.tokenAmount!=null?String(event.tokenAmount):null,
      ...extra
    };
    const ids=Object.keys(this.store.state.copyTradingEvents);
    for(const old of ids.slice(0,Math.max(0,ids.length-2000)))delete this.store.state.copyTradingEvents[old];
  }

  status(userId){
    const user=this.store.state.users?.[userId]||null;
    const s=user?.settings||{};
    return {
      enabled:s.copyTradingEnabled===true,
      wallet:s.copyTradingWallet||'',
      buyAmountSol:num(s.copyTradingBuyAmountSol,0),
      mirrorSells:s.copyTradingMirrorSells!==false,
      environment:s.tradingEnvironment||'paper',
      liveExecutionReady:false,
      pumpTradesOnly:true,
      recent:Object.values(this.store.state.copyTradingEvents||{})
        .filter(x=>x.userId===userId).sort((a,b)=>b.at-a.at).slice(0,25),
      metrics:{...(this.store.state.copyTradingMetrics||{})}
    };
  }
}
