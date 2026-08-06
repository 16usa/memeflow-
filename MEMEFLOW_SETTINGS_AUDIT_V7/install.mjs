import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const files={
 settings:path.join(appDir,'src','settings.mjs'),
 evaluate:path.join(appDir,'src','evaluate.mjs'),
 paper:path.join(appDir,'src','paper-engine.mjs'),
 store:path.join(appDir,'src','store.mjs'),
 server:path.join(appDir,'app-server.mjs'),
 index:path.join(appDir,'index.html')
};
for(const [name,p] of Object.entries(files)){
 if(!fs.existsSync(p)){console.error('ABORT: missing '+name+' at '+p);process.exit(1)}
 const b=p+'.before-settings-audit-v7';
 if(!fs.existsSync(b))fs.copyFileSync(p,b);
}
function write(p,s){fs.writeFileSync(p,s,'utf8');console.log('Changed:',p)}
function once(s,a,b,label){
 if(s.includes(b))return s;
 if(!s.includes(a))throw new Error('ABORT: anchor not found: '+label);
 return s.replace(a,b);
}

// 1) Canonical, server-authoritative settings schema and validation.
const SETTINGS = "const PLATFORMS=['pump'];\nconst nullableNumbers=[\n'minBondingCurvePct','maxBondingCurvePct','minMarketCapUsd','maxMarketCapUsd','minTotalFeesSol','maxTotalFeesSol',\n'minVolume24hUsd','maxVolume24hUsd','minBuyTransactions','maxBuyTransactions','minSellTransactions','maxSellTransactions',\n'minTotalTransactions','maxTotalTransactions','minHolders','maxHolders','minBundlePct','maxBundlePct',\n'minTokenAgeMinutes','maxTokenAgeMinutes','minTop10Pct','maxTop10Pct','minDeveloperPct','maxDeveloperPct',\n'minSniperPct','maxSniperPct'\n];\nconst booleans=[\n'requireTwitter','requireWebsite','requireTelegram','requireAnySocial','requireFreshHolderSnapshot','requireWebsiteOrX',\n'adaptiveProfile','ownerApproval','shadowValidation','changeLog','exitOnWeakBuyPressure'\n];\nconst finite=(v)=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));\nconst cleanText=v=>String(v??'').trim();\nconst bool=(v,fallback=false)=>{\n if(v===undefined||v===null||v==='')return fallback;\n if(typeof v==='boolean')return v;\n if(typeof v==='number')return v!==0;\n const s=String(v).trim().toLowerCase();\n if(['true','1','yes','on'].includes(s))return true;\n if(['false','0','no','off'].includes(s))return false;\n return fallback;\n};\nexport function defaultSettings(){return {\n operatingMode:'observe',tradingEnvironment:'paper',profile:'balanced',\n tradingCapital:0,dailySpendLimit:0,positionSize:0.1,maxPositionSize:0.5,maxOpenPositions:4,maxDailyEntries:10,dailyLossLimit:0,feeReserve:0.05,\n minScore:72,minConfidence:70,minLiquidityUsd:0,minBuyPressure:1.2,requireFreshHolderSnapshot:true,requireWebsiteOrX:false,\n launchPlatforms:['pump'],includeKeywords:'',excludeKeywords:'',\n minBondingCurvePct:null,maxBondingCurvePct:null,minMarketCapUsd:null,maxMarketCapUsd:null,minTotalFeesSol:null,maxTotalFeesSol:null,\n minVolume24hUsd:null,maxVolume24hUsd:null,minBuyTransactions:null,maxBuyTransactions:null,minSellTransactions:null,maxSellTransactions:null,minTotalTransactions:null,maxTotalTransactions:null,\n minHolders:30,maxHolders:null,minBundlePct:null,maxBundlePct:null,minTokenAgeMinutes:0,maxTokenAgeMinutes:180,minTop10Pct:null,maxTop10Pct:25,minDeveloperPct:null,maxDeveloperPct:20,minSniperPct:null,maxSniperPct:null,\n developerBlacklistWallets:[],requireTwitter:false,requireWebsite:false,requireTelegram:false,requireAnySocial:false,\n hardStopPct:25,trailingStopPct:15,tp1Pct:100,tp1SellPct:50,tp2Pct:200,tp2SellPct:25,runnerPct:25,maxHoldMinutes:1440,\n exitBuyPressure:1.0,exitOnWeakBuyPressure:true,\n adaptiveProfile:false,ownerApproval:true,shadowValidation:true,changeLog:true,\n aiChangePolicy:'propose',decisionFreshnessSec:60\n}}\nexport function normalizeSettings(raw={}){\n const d=defaultSettings(),o={...d,...raw};\n\n // Legacy UI-key migrations from builds that persisted view names directly.\n if(raw.paperBeforeChange!==undefined&&raw.shadowValidation===undefined)o.shadowValidation=bool(raw.paperBeforeChange,d.shadowValidation);\n if(raw.auditSettings!==undefined&&raw.changeLog===undefined)o.changeLog=bool(raw.auditSettings,d.changeLog);\n if(raw.decisionFreshness!==undefined&&raw.decisionFreshnessSec===undefined&&finite(raw.decisionFreshness))o.decisionFreshnessSec=Number(raw.decisionFreshness);\n if(raw.exitWeakPressure!==undefined&&raw.exitOnWeakBuyPressure===undefined)o.exitOnWeakBuyPressure=bool(raw.exitWeakPressure,d.exitOnWeakBuyPressure);\n\n o.operatingMode=String(o.operatingMode||d.operatingMode).trim().toLowerCase();\n o.tradingEnvironment=String(o.tradingEnvironment||d.tradingEnvironment).trim().toLowerCase();\n o.profile=String(o.profile||d.profile).trim().toLowerCase();\n o.aiChangePolicy='propose'; // AI may propose/explain; it cannot mutate owner policy automatically in this build.\n\n for(const k of nullableNumbers)o[k]=Object.prototype.hasOwnProperty.call(raw,k)&&!finite(raw[k])?null:(finite(o[k])?Number(o[k]):null);\n for(const k of booleans)o[k]=bool(o[k],d[k]);\n\n const requestedPlatforms=Array.isArray(o.launchPlatforms)\n   ? [...new Set(o.launchPlatforms.map(x=>cleanText(x).toLowerCase()).filter(Boolean))]\n   : [];\n // Current discovery backend is Pump.fun only. Do not expose a pretend multi-launchpad filter.\n o.launchPlatforms=['pump'];\n\n o.includeKeywords=cleanText(o.includeKeywords);o.excludeKeywords=cleanText(o.excludeKeywords);\n o.developerBlacklistWallets=Array.isArray(o.developerBlacklistWallets)\n   ? [...new Set(o.developerBlacklistWallets.map(cleanText).filter(Boolean))]\n   : cleanText(o.developerBlacklistWallets).split(/[\\s,]+/).filter(Boolean);\n\n for(const k of [\n   'minScore','minConfidence','minLiquidityUsd','minBuyPressure','tradingCapital','dailySpendLimit','positionSize','maxPositionSize',\n   'maxOpenPositions','maxDailyEntries','dailyLossLimit','feeReserve','hardStopPct','trailingStopPct','tp1Pct','tp1SellPct',\n   'tp2Pct','tp2SellPct','runnerPct','maxHoldMinutes','exitBuyPressure','decisionFreshnessSec'\n ])if(finite(o[k]))o[k]=Number(o[k]);else o[k]=d[k];\n\n // Drop legacy view-only keys so GET /api/settings stays canonical and understandable.\n delete o.paperBeforeChange;delete o.auditSettings;delete o.decisionFreshness;delete o.exitWeakPressure;\n return o;\n}\nexport function validateSettings(raw={}){\n const s=normalizeSettings(raw),errors=[];\n const ranges=[\n  ['Bonding curve',s.minBondingCurvePct,s.maxBondingCurvePct],['Market cap',s.minMarketCapUsd,s.maxMarketCapUsd],\n  ['Total fees',s.minTotalFeesSol,s.maxTotalFeesSol],['24h volume',s.minVolume24hUsd,s.maxVolume24hUsd],\n  ['Buy transactions',s.minBuyTransactions,s.maxBuyTransactions],['Sell transactions',s.minSellTransactions,s.maxSellTransactions],\n  ['Total transactions',s.minTotalTransactions,s.maxTotalTransactions],['Holders',s.minHolders,s.maxHolders],\n  ['Bundle',s.minBundlePct,s.maxBundlePct],['Token age',s.minTokenAgeMinutes,s.maxTokenAgeMinutes],\n  ['Top 10',s.minTop10Pct,s.maxTop10Pct],['Developer share',s.minDeveloperPct,s.maxDeveloperPct],\n  ['Sniper share',s.minSniperPct,s.maxSniperPct]\n ];\n for(const [name,min,max] of ranges)if(min!==null&&max!==null&&min>max)errors.push(`${name}: minimum cannot exceed maximum.`);\n for(const k of nullableNumbers)if(s[k]!==null&&s[k]<0)errors.push(`${k} cannot be negative.`);\n for(const k of ['minBondingCurvePct','maxBondingCurvePct','minBundlePct','maxBundlePct','minTop10Pct','maxTop10Pct','minDeveloperPct','maxDeveloperPct','minSniperPct','maxSniperPct'])\n   if(s[k]!==null&&s[k]>100)errors.push(`${k} cannot exceed 100%.`);\n\n if(s.minScore<0||s.minScore>100)errors.push('Minimum AI score must be between 0 and 100.');\n if(s.minConfidence<0||s.minConfidence>100)errors.push('Minimum confidence must be between 0 and 100.');\n if(s.minLiquidityUsd<0)errors.push('Minimum liquidity cannot be negative.');\n if(s.minBuyPressure<0)errors.push('Minimum buy pressure cannot be negative.');\n\n for(const k of ['tradingCapital','dailySpendLimit','positionSize','maxPositionSize','dailyLossLimit','feeReserve','trailingStopPct','tp1Pct','tp1SellPct','tp2Pct','tp2SellPct','runnerPct','exitBuyPressure'])\n   if(!Number.isFinite(s[k])||s[k]<0)errors.push(`${k} must be a non-negative number.`);\n if(!(s.positionSize>0))errors.push('Default position must be greater than 0 SOL.');\n if(!(s.maxPositionSize>0))errors.push('Maximum position must be greater than 0 SOL.');\n if(s.positionSize>s.maxPositionSize)errors.push('Default position cannot exceed maximum position.');\n if(s.tradingCapital>0&&s.maxPositionSize>s.tradingCapital)errors.push('Maximum position cannot exceed trading capital when a capital cap is enabled.');\n if(s.tradingCapital>0&&s.dailySpendLimit>s.tradingCapital)errors.push('Daily spending limit cannot exceed trading capital when a capital cap is enabled.');\n if(s.dailySpendLimit>0&&s.positionSize>s.dailySpendLimit)errors.push('Default position cannot exceed the daily spending limit.');\n if(s.tradingCapital>0&&s.feeReserve>=s.tradingCapital)errors.push('Fee reserve must be below trading capital when a capital cap is enabled.');\n if(s.tradingCapital>0&&s.dailyLossLimit>s.tradingCapital)errors.push('Daily loss limit cannot exceed trading capital.');\n\n for(const k of ['maxOpenPositions','maxDailyEntries'])if(!Number.isInteger(s[k])||s[k]<0)errors.push(`${k} must be a whole number of 0 or greater.`);\n if(!(s.hardStopPct>0&&s.hardStopPct<=100))errors.push('Hard stop must be greater than 0% and no more than 100%.');\n if(s.trailingStopPct>100)errors.push('Trailing stop cannot exceed 100%.');\n if(!(s.tp1Pct>0))errors.push('TP1 must be greater than 0%.');\n if(!(s.tp2Pct>s.tp1Pct))errors.push('TP2 must be greater than TP1.');\n for(const k of ['tp1SellPct','tp2SellPct','runnerPct'])if(s[k]>100)errors.push(`${k} cannot exceed 100%.`);\n const allocation=s.tp1SellPct+s.tp2SellPct+s.runnerPct;\n if(Math.abs(allocation-100)>0.001)errors.push(`Exit allocation must total 100% (currently ${allocation}%).`);\n if(!(s.maxHoldMinutes>=1))errors.push('Maximum hold must be at least 1 minute.');\n if(!(s.decisionFreshnessSec>=5&&s.decisionFreshnessSec<=3600))errors.push('Decision freshness must be between 5 and 3600 seconds.');\n\n const VALID_MODES=['observe','assist','automate'],VALID_ENVS=['paper','live'],VALID_PROFILES=['conservative','balanced','aggressive'];\n if(!VALID_MODES.includes(s.operatingMode))errors.push('Invalid operatingMode: must be observe, assist or automate.');\n if(!VALID_ENVS.includes(s.tradingEnvironment))errors.push('Invalid tradingEnvironment: must be paper or live.');\n if(!VALID_PROFILES.includes(s.profile))errors.push('Invalid profile: must be conservative, balanced or aggressive.');\n if(s.aiChangePolicy!=='propose')errors.push('AI change policy is currently restricted to propose-only.');\n if(!Array.isArray(s.launchPlatforms)||s.launchPlatforms.length!==1||s.launchPlatforms[0]!=='pump')errors.push('Current discovery supports Pump.fun only.');\n\n return {ok:errors.length===0,errors,settings:s};\n}\n";
write(files.settings,SETTINGS);

// 2) Make every visible decision gate actually affect evaluate().
{
 let s=fs.readFileSync(files.evaluate,'utf8');
 s=once(s,
  " range(num(token,'bondingCurvePct','curveProgressPct'),s.minBondingCurvePct,s.maxBondingCurvePct,'Bonding curve','%',10);\n range(num(token,'marketCapUsd','marketCapUSD'),s.minMarketCapUsd,s.maxMarketCapUsd,'Market cap','',12);",
  " range(num(token,'bondingCurvePct','curveProgressPct'),s.minBondingCurvePct,s.maxBondingCurvePct,'Bonding curve','%',10);\n range(num(token,'liquidityUsd'),s.minLiquidityUsd,null,'Liquidity','$',14);\n range(num(token,'marketCapUsd','marketCapUSD'),s.minMarketCapUsd,s.maxMarketCapUsd,'Market cap','$',12);",
  'minimum liquidity gate'
 );
 s=once(s,
  " if(s.requireTwitter)need(twitter,'Twitter/X required',8);if(s.requireWebsite)need(website,'Website required',8);if(s.requireTelegram)need(telegram,'Telegram required',8);if(s.requireAnySocial)need(twitter||website||telegram,'At least one social link required',8);",
  " if(s.requireTwitter)need(twitter,'Twitter/X required',8);if(s.requireWebsite)need(website,'Website required',8);if(s.requireTelegram)need(telegram,'Telegram required',8);if(s.requireWebsiteOrX)need(twitter||website,'Website or Twitter/X required',8);if(s.requireAnySocial)need(twitter||website||telegram,'At least one social link required',8);",
  'website-or-x gate'
 );
 s=once(s,
  " const state=waiting?'WAITING':blocked?'BLOCKED':score>=Number(s.minScore||0)&&confidence>=Number(s.minConfidence||0)?'BUY READY':'WATCH';",
  " const state=blocked?'BLOCKED':waiting?'WAITING':score>=Number(s.minScore||0)&&confidence>=Number(s.minConfidence||0)?'BUY READY':'WATCH';",
  'blocked precedence'
 );
 write(files.evaluate,s);
}

// 3) PAPER engine: zero-limit semantics stay deliberate, owner approval is enforced,
// decision/proposal freshness is real, and weak-pressure exit has a true on/off switch.
{
 let s=fs.readFileSync(files.paper,'utf8');
 s=once(s,
  "      exitBuyPressure: Math.max(0, num(settings.exitBuyPressure, 1.0)),\n",
  "      exitBuyPressure: Math.max(0, num(settings.exitBuyPressure, 1.0)),\n      exitOnWeakBuyPressure: settings.exitOnWeakBuyPressure !== false,\n      decisionFreshnessSec: Math.max(5, num(settings.decisionFreshnessSec, 60)),\n",
  'paper settings extras'
 );
 s=once(s,
  "    if (this.openForMint(userId, token.mint)) return { ok: false, code: 'POSITION_EXISTS' };",
  "    const tokenUpdatedAt = Number(token?.updatedAt || token?.lastPriceAt || 0);\n    if (s.decisionFreshnessSec > 0 && tokenUpdatedAt > 0 && this.clock() - tokenUpdatedAt > s.decisionFreshnessSec * 1000) return { ok: false, code: 'STALE_DECISION' };\n    if (this.openForMint(userId, token.mint)) return { ok: false, code: 'POSITION_EXISTS' };",
  'freshness entry gate'
 );
 s=once(s,
  "    if (settings.operatingMode === 'assist') {",
  "    if (settings.operatingMode === 'assist' || (settings.operatingMode === 'automate' && settings.ownerApproval === true)) {",
  'owner approval proposal gate'
 );
 s=once(s,
  "    const user = this.store.state.users[userId];\n    const liveToken = token || this.store.state.tokens[proposal.mint];",
  "    const user = this.store.state.users[userId];\n    const settings = this.settings(user?.settings || {});\n    if (settings.decisionFreshnessSec > 0 && this.clock() - Number(proposal.createdAtMs || 0) > settings.decisionFreshnessSec * 1000) {\n      proposal.status = 'EXPIRED';proposal.resolvedAt = nowIso();this.save();return { ok: false, code: 'STALE_PROPOSAL' };\n    }\n    const liveToken = token || this.store.state.tokens[proposal.mint];",
  'proposal freshness'
 );
 s=s.replace("    }, user?.settings || {}, proposal.idempotencyKey);","    }, settings, proposal.idempotencyKey);");
 s=once(s,
  "    if (Number.isFinite(pressure) && pressure < settings.exitBuyPressure) {",
  "    if (settings.exitOnWeakBuyPressure && Number.isFinite(pressure) && pressure < settings.exitBuyPressure) {",
  'weak pressure toggle'
 );
 write(files.paper,s);
}

// 4) Append-only settings audit + real settings versions.
{
 let s=fs.readFileSync(files.store,'utf8');
 s=once(s,
  "paperMetrics:{entries:0,exits:0,errors:0}};",
  "paperMetrics:{entries:0,exits:0,errors:0},settingsAudit:{}};",
  'settings audit state'
 );
 s=once(s,
  "  setSettings(id,s){this.user(id).settings=normalizeSettings({...this.settings(id),...s});this.save();return this.user(id).settings}\n",
  "  setSettings(id,s){const u=this.user(id);u.settings=normalizeSettings({...this.settings(id),...s});u.settingsVersion=Date.now();this.save();return u.settings}\n  recordSettingsChange(id,before,after,meta={}){this.state.settingsAudit||={};this.state.settingsAudit[id]||=[];this.state.settingsAudit[id].push({at:Date.now(),actor:meta.actor||id,source:meta.source||'user',before,after});this.save();return this.state.settingsAudit[id].at?.(-1)||null}\n  settingsHistory(id,limit=100){return (this.state.settingsAudit?.[id]||[]).slice(-Math.max(1,Math.min(500,Number(limit)||100))).reverse()}\n",
  'audit methods'
 );
 write(files.store,s);
}

// 5) Server: GET always normalizes legacy settings, server-side shadow validation,
// audit trail, real versioning, reset re-evaluation, and RPC status means HTTP RPC.
{
 let s=fs.readFileSync(files.server,'utf8');
 s=once(s,
  "function reevaluateUser(uid){const s=store.settings(uid);const tokens=store.tokens();let count=0;",
  "function shadowValidateSettings(settings,limit=50){const rows=store.tokens().slice(0,Math.max(1,Math.min(200,limit)));const counts={WAITING:0,WATCH:0,'BUY READY':0,BLOCKED:0,EXPIRED:0};const errors=[];for(const token of rows){try{const d=evaluate(token,settings);counts[d.state]=(counts[d.state]||0)+1}catch(e){errors.push({mint:token.mint||null,message:e.message})}}return {tested:rows.length,counts,errors};}\nfunction reevaluateUser(uid){const s=store.settings(uid);const tokens=store.tokens();let count=0;",
  'shadow settings validator'
 );
 s=once(s,
  "      ok:operational,\n      commitment:",
  "      ok:primaryOk,\n      discoveryConnected:wsLive,\n      commitment:",
  'RPC status semantics'
 );
 const oldRoutes=" if(url.pathname==='/api/settings'&&req.method==='GET')return json(res,200,{settings:u.settings,version:u.updatedAt||1,killSwitchActive:u.killSwitch,capabilities:{liveAutomation:hasLiveEntitlement(u),paperAutomation:true}});\n if(url.pathname==='/api/settings'&&req.method==='PUT'){const b=await body(req);const checked=validateSettings(b.settings||{});if(!checked.ok)return json(res,400,{error:'INVALID_SETTINGS',message:checked.errors.join(' '),errors:checked.errors});if(checked.settings.tradingEnvironment==='live'&&!hasLiveEntitlement(u))return json(res,403,{error:'LIVE_ENTITLEMENT_REQUIRED',message:'LIVE trading environment requires an active Pro subscription or owner entitlement.'});const saved=store.setSettings(u.id,checked.settings);const decisionsReevaluated=reevaluateUser(u.id);return json(res,200,{settings:saved,version:Date.now(),decisionsReevaluated})}\n if(url.pathname==='/api/settings/defaults'&&req.method==='POST')return json(res,200,{settings:store.setSettings(u.id,defaults())});";
 const newRoutes=" if(url.pathname==='/api/settings'&&req.method==='GET'){const settings=store.settings(u.id);return json(res,200,{settings,version:u.settingsVersion||1,killSwitchActive:u.killSwitch,capabilities:{liveAutomation:hasLiveEntitlement(u),paperAutomation:true,discoveryPlatforms:['pump'],adaptiveProfile:false}})}\n if(url.pathname==='/api/settings/audit'&&req.method==='GET')return json(res,200,{history:store.settingsHistory(u.id,Number(url.searchParams.get('limit')||100))});\n if(url.pathname==='/api/settings'&&req.method==='PUT'){const b=await body(req);const checked=validateSettings(b.settings||{});if(!checked.ok)return json(res,400,{error:'INVALID_SETTINGS',message:checked.errors.join(' '),errors:checked.errors});if(checked.settings.tradingEnvironment==='live'&&!hasLiveEntitlement(u))return json(res,403,{error:'LIVE_ENTITLEMENT_REQUIRED',message:'LIVE trading environment requires an active Pro subscription or owner entitlement.'});if(b.version!=null&&Number(b.version)!==Number(u.settingsVersion||1))return json(res,409,{error:'SETTINGS_VERSION_CONFLICT',message:'Settings changed on the server. Reload before saving again.',version:u.settingsVersion||1});const before=JSON.parse(JSON.stringify(store.settings(u.id)));const shadow=checked.settings.shadowValidation?shadowValidateSettings(checked.settings,50):null;if(shadow?.errors?.length)return json(res,400,{error:'SHADOW_VALIDATION_FAILED',message:'Proposed settings could not be evaluated safely.',shadowValidation:shadow});const saved=store.setSettings(u.id,checked.settings);if(saved.changeLog!==false)store.recordSettingsChange(u.id,before,saved,{actor:u.id,source:'settings_put'});const decisionsReevaluated=reevaluateUser(u.id);return json(res,200,{settings:saved,version:u.settingsVersion,decisionsReevaluated,shadowValidation:shadow})}\n if(url.pathname==='/api/settings/defaults'&&req.method==='POST'){const before=JSON.parse(JSON.stringify(store.settings(u.id)));const saved=store.setSettings(u.id,defaults());if(saved.changeLog!==false)store.recordSettingsChange(u.id,before,saved,{actor:u.id,source:'restore_defaults'});const decisionsReevaluated=reevaluateUser(u.id);return json(res,200,{settings:saved,version:u.settingsVersion,decisionsReevaluated})}";
 s=once(s,oldRoutes,newRoutes,'settings routes');
 write(files.server,s);
}

// 6) Frontend: repair wrong server↔UI mappings, hide fake "attention" banner,
// prevent unsupported controls from pretending to work, fix Calculate impact.
{
 let s=fs.readFileSync(files.index,'utf8');
 s=s.replace('class="settings-error" id="settingsErrors"','class="settings-errors" id="settingsErrors"');

 const mapRe=/const S2H=\{minScore:'minAiScore'[\s\S]*?profile:'strategyProfile'\};/;
 if(!mapRe.test(s))throw new Error('ABORT: settings S2H map not found');
 s=s.replace(mapRe,"const S2H={minScore:'minAiScore',minLiquidityUsd:'minLiquidity',minMarketCapUsd:'minMarketCap',maxMarketCapUsd:'maxMarketCap',minTop10Pct:'minTop10',maxTop10Pct:'maxTop10',minDeveloperPct:'minDeveloper',maxDeveloperPct:'maxDeveloper',minTokenAgeMinutes:'minTokenAge',maxTokenAgeMinutes:'maxTokenAge',hardStopPct:'stopLoss',trailingStopPct:'trailingStop',tp1Pct:'tp1',tp1SellPct:'tp1Sell',tp2Pct:'tp2',tp2SellPct:'tp2Sell',runnerPct:'runnerSize',exitOnWeakBuyPressure:'exitWeakPressure',requireFreshHolderSnapshot:'requireFreshHolders',shadowValidation:'paperBeforeChange',changeLog:'auditSettings',decisionFreshnessSec:'decisionFreshness',profile:'strategyProfile'};");

 s=once(s,
  "const setEnabled=enabled=>{controls.forEach(el=>{if(el.id==='settingsReload'||el.id==='modeAutomate')return;el.disabled=!enabled});updateAutomateEligibility()};",
  "const setEnabled=enabled=>{controls.forEach(el=>{if(el.id==='settingsReload'||el.id==='modeAutomate'||el.id==='adaptiveProfile'||el.id==='aiChangePolicy'||(el.matches?.('[data-platform]')&&el.dataset.platform!=='pump'))return;el.disabled=!enabled});updateAutomateEligibility()};",
  'unsupported settings controls'
 );

 s=once(s,
  "$('#settingsSimulate')?.addEventListener('click',()=>{const o=read(),effective=Math.min(Math.floor(n(o,'dailySpendLimit')/Math.max(n(o,'positionSize'),.0001)),n(o,'maxDailyEntries'));window.MEMEFLOW_CORE?.toast?.(`Maximum capital capacity: ${effective} entries/day before market gates`)});",
  "$('#settingsSimulate')?.addEventListener('click',()=>{const o=read(),daily=n(o,'dailySpendLimit'),size=Math.max(n(o,'positionSize'),.0001),entryLimit=n(o,'maxDailyEntries');const bySpend=daily>0?Math.floor(daily/size):Infinity;const effective=Math.min(bySpend,entryLimit);window.MEMEFLOW_CORE?.toast?.(`Capital/risk capacity: ${Number.isFinite(effective)?effective:entryLimit} entries/day before market gates`)});",
  'calculate impact zero-limit semantics'
 );

 const HELP_SCRIPT = String.raw`
<script id="memeflow-settings-help-v7">
(()=>{
 const $=s=>document.querySelector(s);
 const help={
  tradingCapital:'Maximum total SOL this account may deploy. 0 disables this PAPER capital cap; LIVE execution is still protected by separate server gates.',
  dailySpendLimit:'Maximum SOL allowed for new entries per UTC day. 0 disables the daily spending cap.',
  positionSize:'Default SOL size used for each new PAPER position or Assist proposal.',
  maxPositionSize:'Hard ceiling for a single position. The default position size cannot exceed it.',
  maxOpenPositions:'Maximum simultaneous open positions. 0 blocks all new entries.',
  maxDailyEntries:'Maximum new entries per UTC day. 0 blocks all new entries.',
  dailyLossLimit:'Stops new entries after realized losses reach this amount for the day. 0 disables this loss cap.',
  feeReserve:'SOL kept outside position sizing for fees and execution overhead. PAPER trading does not spend real fees.',
  minAiScore:'Minimum 0–100 decision score required for BUY READY. Higher values are more selective.',
  minConfidence:'Minimum 0–100 evidence confidence required for BUY READY. Missing evidence can keep a token in WAITING.',
  minLiquidity:'Minimum verified USD liquidity. 0 disables this filter. If enabled but USD liquidity is unavailable, the token stays WAITING.',
  minBuyPressure:'Minimum buying-to-selling pressure ratio. 1.2× means buying pressure must be at least 20% stronger than selling pressure.',
  includeKeywords:'Optional comma-separated words that must appear in token name, symbol, URI or description. Leave blank to disable.',
  excludeKeywords:'Comma-separated words that immediately reject matching token metadata. Leave blank to disable.',
  minBondingCurvePct:'Minimum bonding-curve progress. Leave blank to disable. Missing curve data keeps the token WAITING when this filter is enabled.',
  maxBondingCurvePct:'Maximum bonding-curve progress. Leave blank to disable.',
  minMarketCap:'Minimum verified market cap in USD. Leave blank to disable; missing data causes WAITING when enabled.',
  maxMarketCap:'Maximum verified market cap in USD. Leave blank to disable.',
  minTotalFeesSol:'Minimum observed protocol fees in SOL. Leave blank to disable; early tokens may not expose this metric.',
  maxTotalFeesSol:'Maximum observed protocol fees in SOL. Leave blank to disable.',
  minVolume24hUsd:'Minimum 24-hour USD volume. New launches may not have this metric yet; enabled limits keep them WAITING until data exists.',
  maxVolume24hUsd:'Maximum 24-hour USD volume. Leave blank to disable.',
  minBuyTransactions:'Minimum observed buy transaction count. Missing data keeps the token WAITING when enabled.',
  maxBuyTransactions:'Maximum observed buy transaction count. Leave blank to disable.',
  minSellTransactions:'Minimum observed sell transaction count. Missing data keeps the token WAITING when enabled.',
  maxSellTransactions:'Maximum observed sell transaction count. Leave blank to disable.',
  minTotalTransactions:'Minimum total observed transaction count. Missing data keeps the token WAITING when enabled.',
  maxTotalTransactions:'Maximum total observed transaction count. Leave blank to disable.',
  minHolders:'Minimum current holder count. The anti-rug layer also requires fresh holder evidence before a fast entry.',
  maxHolders:'Optional maximum holder count. Leave blank unless you intentionally want only very early launches.',
  minBundlePct:'Minimum bundled ownership percentage. Usually leave blank; enabling a limit requires bundle data to exist.',
  maxBundlePct:'Maximum bundled ownership percentage. Lower values are stricter against concentrated bundled supply.',
  minTokenAge:'Additional minimum token age in minutes. 0 leaves timing to the built-in anti-rug confirmation (45/90/180 seconds).',
  maxTokenAge:'Maximum candidate age in minutes. Older tokens become EXPIRED and cannot become Primary Candidate.',
  minTop10:'Optional minimum share held by the Top-10 holders. Usually leave blank.',
  maxTop10:'Maximum supply share held by the Top-10 holders. Lower values require broader distribution.',
  minDeveloper:'Optional minimum developer share. Usually leave blank.',
  maxDeveloper:'Maximum percentage of supply held by the developer/creator. Lower values are stricter.',
  minSniperPct:'Optional minimum sniper ownership. Usually leave blank.',
  maxSniperPct:'Maximum sniper ownership. Enable only when sniper data is available; otherwise candidates remain WAITING.',
  developerBlacklistWallets:'Creator/developer wallet addresses that must always be rejected. Separate addresses with commas or new lines.',
  stopLoss:'Hard loss limit from entry. At this drawdown the PAPER position is closed.',
  trailingStop:'Once price rises, the stop follows the highest price by this percentage. 0 disables trailing stop.',
  tp1:'First profit target measured from entry price.',
  tp1Sell:'Percentage of the original position sold when TP1 is reached.',
  tp2:'Second profit target. It must be above TP1.',
  tp2Sell:'Percentage of the original position sold when TP2 is reached.',
  runnerSize:'Percentage intentionally left after TP1/TP2. TP1 sell + TP2 sell + runner must equal 100%.',
  maxHoldMinutes:'Maximum position lifetime. The PAPER position closes when this time is reached.',
  decisionFreshness:'Maximum age of an Assist proposal/decision before fresh evaluation is required. Default: 60 seconds.',
  aiChangePolicy:'AI cannot change owner settings automatically in this build. Propose-only is enforced server-side.',
 };
 for(const [id,msg] of Object.entries(help)){
  const el=$('#'+id);const field=el?.closest('.setting-field');if(!field||field.querySelector('.mf-setting-help'))continue;
  const small=document.createElement('small');small.className='mf-setting-help';small.textContent=msg;field.appendChild(small);
 }
 const addToggleHelp=(id,msg)=>{
  const input=$('#'+id),copy=input?.closest('.toggle-row')?.querySelector('.toggle-copy');if(!copy)return;
  let span=copy.querySelector('span');if(!span){span=document.createElement('span');copy.appendChild(span)}
  if(!span.textContent.trim())span.textContent=msg;
 };
 addToggleHelp('requireTwitter','Require a Twitter/X link in token metadata. Missing links block the token when enabled.');
 addToggleHelp('requireWebsite','Require a project website in token metadata.');
 addToggleHelp('requireTelegram','Require a Telegram link in token metadata.');
 addToggleHelp('requireAnySocial','Require at least one of Twitter/X, website or Telegram.');
 addToggleHelp('adaptiveProfile','Not active in the current execution build. Explicit filters and owner hard limits remain authoritative.');
 addToggleHelp('ownerApproval','When enabled, even Automate mode creates a proposal and waits for explicit owner approval before a PAPER entry.');
 addToggleHelp('exitWeakPressure','When enabled, an open PAPER position closes if verified buy pressure drops below the internal 1.0× exit threshold.');
 addToggleHelp('paperBeforeChange','Before saving settings, the server evaluates the proposed policy against recent cached tokens and rejects evaluation errors.');
 addToggleHelp('auditSettings','Append every settings change to a read-only server audit history with timestamp, previous values and new values.');

 const protocols=document.querySelector('[data-filter-pane="protocols"] .platform-grid');
 if(protocols&&!protocols.nextElementSibling?.classList?.contains('mf-protocol-note')){
  const note=document.createElement('small');note.className='mf-protocol-note';
  note.textContent='Discovery source: Pump.fun. Other launchpads shown below are disabled until a real backend listener is connected; they are not simulated.';
  protocols.insertAdjacentElement('afterend',note);
 }
 document.querySelectorAll('[data-platform]').forEach(x=>{
  if(x.dataset.platform==='pump'){x.checked=true;return}
  x.checked=false;x.disabled=true;
  const span=x.nextElementSibling;if(span){span.style.opacity='.45';span.title='Discovery backend not connected'}
 });
 const ai=$('#aiChangePolicy');if(ai){ai.innerHTML='<option value="propose">Propose only</option>';ai.value='propose';ai.disabled=true}
 const adapt=$('#adaptiveProfile');if(adapt){adapt.checked=false;adapt.disabled=true}
})();
</script>`;
 if(!s.includes('memeflow-settings-help-v7'))s=s.replace('</body>',HELP_SCRIPT+'\n</body>');
 write(files.index,s);
}

console.log('');
console.log('Installed MEMEFLOW SETTINGS AUDIT V7.');
console.log('Run self-test.mjs. Restart only after ALL V7 SELF-TESTS PASSED.');
