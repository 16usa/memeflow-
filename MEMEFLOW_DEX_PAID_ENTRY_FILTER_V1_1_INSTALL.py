#!/usr/bin/env python3
from pathlib import Path
import subprocess, re, json

MARK='MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1'
root=Path.cwd()
if (root/'memeflow-app').is_dir(): app=root/'memeflow-app'
elif (root/'app-server.mjs').is_file() and (root/'src').is_dir(): app=root
else: raise SystemExit('ERROR: memeflow-app not found. Run from the Replit project root.')

paths={
 'app':app/'app-server.mjs',
 'settings':app/'src'/'settings.mjs',
 'gate':app/'src'/'settings-gate.mjs',
 'settings_page':app/'settings-page.js',
 'settings_html':app/'settings.html',
 'system':app/'system.js',
 'system_html':app/'system.html',
 'tokens':app/'system-tokens.js',
 'tokens_html':app/'system-tokens.html',
 'pkg':app/'package.json',
 'arch_test':app/'tests'/'settings-architecture-v2.mjs',
 'old_source':app/'src'/'dex-view-filter.mjs',
 'old_test':app/'tests'/'dex-view-filter.mjs',
 'new_source':app/'src'/'dex-paid.mjs',
 'new_test':app/'tests'/'dex-paid.mjs'
}
required=('app','settings','gate','settings_page','settings_html','system','tokens','pkg','arch_test','old_source','old_test')
for k in required:
    if not paths[k].exists(): raise SystemExit(f'ERROR: missing {paths[k]}')

def run(cmd,cwd=None):
    print('+',' '.join(map(str,cmd)))
    subprocess.run(cmd,cwd=cwd,check=True)

def replace_once(text,old,new,label):
    n=text.count(old)
    if n!=1: raise RuntimeError(f'PATCH ERROR [{label}]: expected exactly 1 anchor, found {n}')
    return text.replace(old,new,1)

def sub_once(text,pattern,repl,label,flags=re.S):
    out,n=re.subn(pattern,repl,text,count=1,flags=flags)
    if n!=1: raise RuntimeError(f'PATCH ERROR [{label}]: expected exactly 1 regex anchor, found {n}')
    return out

touch_existing=[k for k in required]
for optional in ('system_html','tokens_html'):
    if paths[optional].exists(): touch_existing.append(optional)
if paths['new_source'].exists(): touch_existing.append('new_source')
if paths['new_test'].exists(): touch_existing.append('new_test')
rel=[str(paths[k].relative_to(root)) for k in touch_existing]
dirty=subprocess.run(['git','status','--porcelain','--',*rel],cwd=root,text=True,capture_output=True,check=True).stdout.strip()
if dirty:
    print('ERROR: target files already have local changes:')
    print(dirty)
    print('Nothing was changed.')
    raise SystemExit(1)

originals={k:paths[k].read_text(encoding='utf-8') for k in touch_existing if paths[k].exists()}
new_source_existed=paths['new_source'].exists()
new_test_existed=paths['new_test'].exists()

DEX_MODULE='// MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1\n// One purpose only: verify a paid DEX Screener order for a Solana mint.\n// No pair/pool/liquidity/volume logic belongs here.\n\nconst CONFIRMED_STATUSES = new Set([\n  \'processing\',\n  \'on-hold\',\n  \'approved\'\n]);\n\nconst sleep = ms => new Promise(resolve => setTimeout(resolve, ms));\n\nfunction cleanMint(value) {\n  return String(value || \'\').trim();\n}\n\nfunction cleanStatus(value) {\n  return String(value || \'\').trim().toLowerCase();\n}\n\nfunction paymentTimestamp(value) {\n  const n = Number(value);\n  return Number.isFinite(n) && n > 0 ? n : null;\n}\n\nexport function isConfirmedDexPaidOrder(order = {}) {\n  const paidAt = paymentTimestamp(order?.paymentTimestamp);\n  const status = cleanStatus(order?.status);\n\n  // The official /orders endpoint is specifically "Check paid orders".\n  // We still require a real payment timestamp and reject terminal\n  // cancelled/rejected orders. processing/on-hold/approved count as paid.\n  return paidAt !== null && CONFIRMED_STATUSES.has(status);\n}\n\nexport function summarizeDexPaidOrders(orders) {\n  const rows = Array.isArray(orders) ? orders : [];\n  const confirmed = rows\n    .filter(isConfirmedDexPaidOrder)\n    .sort(\n      (a, b) =>\n        (paymentTimestamp(b?.paymentTimestamp) || 0) -\n        (paymentTimestamp(a?.paymentTimestamp) || 0)\n    );\n\n  const best = confirmed[0] || null;\n  const statuses = [\n    ...new Set(\n      rows\n        .map(row => cleanStatus(row?.status))\n        .filter(Boolean)\n    )\n  ];\n\n  return {\n    confirmed: confirmed.length > 0,\n    confirmedCount: confirmed.length,\n    totalOrders: rows.length,\n    status: best ? cleanStatus(best.status) : (statuses[0] || \'none\'),\n    paymentTimestamp: best ? paymentTimestamp(best.paymentTimestamp) : null,\n    orderType: best ? String(best.type || \'\').trim() || null : null,\n    statuses\n  };\n}\n\nexport function createDexPaidVerifier({\n  fetchImpl = globalThis.fetch,\n  endpointBase = \'https://api.dexscreener.com/orders/v1/solana\',\n  timeoutMs = 6000,\n  minIntervalMs = 1100,\n  positiveTtlMs = 15 * 60 * 1000,\n  negativeTtlMs = 20 * 1000,\n  errorTtlMs = 5 * 1000\n} = {}) {\n  if (typeof fetchImpl !== \'function\') {\n    throw new Error(\'DEX Paid verifier requires fetch\');\n  }\n\n  const cache = new Map();\n  const inflight = new Map();\n\n  let nextSlotAt = 0;\n  let rateTail = Promise.resolve();\n\n  const stats = {\n    requests: 0,\n    cacheHits: 0,\n    positives: 0,\n    negatives: 0,\n    errors: 0,\n    lastRequestAt: null,\n    lastError: null,\n    lastErrorAt: null\n  };\n\n  function peek(mint, now = Date.now()) {\n    mint = cleanMint(mint);\n    if (!mint) return null;\n\n    const row = cache.get(mint);\n    if (!row) return null;\n\n    if (Number(row.expiresAt || 0) <= now) {\n      cache.delete(mint);\n      return null;\n    }\n\n    return row;\n  }\n\n  async function reserveRateSlot() {\n    const previous = rateTail;\n    let release;\n    rateTail = new Promise(resolve => {\n      release = resolve;\n    });\n\n    await previous;\n\n    try {\n      const waitMs = Math.max(0, nextSlotAt - Date.now());\n      if (waitMs > 0) await sleep(waitMs);\n      nextSlotAt = Date.now() + Math.max(1000, Number(minIntervalMs) || 1100);\n    } finally {\n      release();\n    }\n  }\n\n  async function requestOrders(mint) {\n    await reserveRateSlot();\n\n    const controller = new AbortController();\n    const timer = setTimeout(\n      () => controller.abort(),\n      Math.max(1000, Number(timeoutMs) || 6000)\n    );\n    timer.unref?.();\n\n    try {\n      stats.requests += 1;\n      stats.lastRequestAt = Date.now();\n\n      const response = await fetchImpl(\n        `${endpointBase}/${encodeURIComponent(mint)}`,\n        {\n          method: \'GET\',\n          headers: {accept: \'application/json\'},\n          signal: controller.signal\n        }\n      );\n\n      if (!response?.ok) {\n        const error = new Error(`DEX Paid HTTP ${response?.status || 0}`);\n        error.status = Number(response?.status || 0);\n        throw error;\n      }\n\n      const body = await response.json();\n\n      if (!Array.isArray(body)) {\n        throw new Error(\'Invalid DEX Paid response\');\n      }\n\n      return body;\n    } finally {\n      clearTimeout(timer);\n    }\n  }\n\n  async function check(mint, {force = false} = {}) {\n    mint = cleanMint(mint);\n    if (!mint) {\n      return {\n        confirmed: null,\n        degraded: true,\n        error: \'mint required\',\n        checkedAt: Date.now(),\n        expiresAt: Date.now() + errorTtlMs\n      };\n    }\n\n    if (!force) {\n      const cached = peek(mint);\n      if (cached) {\n        stats.cacheHits += 1;\n        return cached;\n      }\n    }\n\n    const active = inflight.get(mint);\n    if (active) return active;\n\n    const task = (async () => {\n      try {\n        const orders = await requestOrders(mint);\n        const summary = summarizeDexPaidOrders(orders);\n        const now = Date.now();\n\n        const row = {\n          ...summary,\n          degraded: false,\n          error: null,\n          checkedAt: now,\n          expiresAt:\n            now +\n            (\n              summary.confirmed\n                ? positiveTtlMs\n                : negativeTtlMs\n            )\n        };\n\n        cache.set(mint, row);\n\n        if (row.confirmed) stats.positives += 1;\n        else stats.negatives += 1;\n\n        return row;\n      } catch (error) {\n        stats.errors += 1;\n        stats.lastError = String(error?.message || error).slice(0, 240);\n        stats.lastErrorAt = Date.now();\n\n        const previous = cache.get(mint);\n        if (previous?.confirmed === true) {\n          const preserved = {\n            ...previous,\n            degraded: true,\n            error: stats.lastError,\n            expiresAt: Date.now() + errorTtlMs\n          };\n          cache.set(mint, preserved);\n          return preserved;\n        }\n\n        const now = Date.now();\n        const row = {\n          confirmed: null,\n          confirmedCount: 0,\n          totalOrders: 0,\n          status: \'unavailable\',\n          paymentTimestamp: null,\n          orderType: null,\n          statuses: [],\n          degraded: true,\n          error: stats.lastError,\n          checkedAt: now,\n          expiresAt: now + errorTtlMs\n        };\n\n        cache.set(mint, row);\n        return row;\n      } finally {\n        inflight.delete(mint);\n      }\n    })();\n\n    inflight.set(mint, task);\n    return task;\n  }\n\n  function drop(mint) {\n    mint = cleanMint(mint);\n    if (!mint) return;\n    cache.delete(mint);\n    inflight.delete(mint);\n  }\n\n  return {\n    check,\n    peek,\n    drop,\n    stats,\n    cache,\n    inflight\n  };\n}\n'
DEX_TEST="import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nimport {\n  isConfirmedDexPaidOrder,\n  summarizeDexPaidOrders,\n  createDexPaidVerifier\n} from '../src/dex-paid.mjs';\n\nimport {\n  ENTRY_ADMISSION_KEYS,\n  LOGIC_DECISION_KEYS,\n  PREOPEN_RPC_KEYS,\n  evaluateEntryAdmission\n} from '../src/settings-gate.mjs';\n\nimport {\n  defaultSettings,\n  normalizeSettings\n} from '../src/settings.mjs';\n\nassert.equal(\n  isConfirmedDexPaidOrder({\n    status:'approved',\n    paymentTimestamp:123\n  }),\n  true\n);\n\nassert.equal(\n  isConfirmedDexPaidOrder({\n    status:'processing',\n    paymentTimestamp:123\n  }),\n  true\n);\n\nassert.equal(\n  isConfirmedDexPaidOrder({\n    status:'on-hold',\n    paymentTimestamp:123\n  }),\n  true\n);\n\nassert.equal(\n  isConfirmedDexPaidOrder({\n    status:'cancelled',\n    paymentTimestamp:123\n  }),\n  false\n);\n\nassert.equal(\n  isConfirmedDexPaidOrder({\n    status:'rejected',\n    paymentTimestamp:123\n  }),\n  false\n);\n\nassert.equal(\n  isConfirmedDexPaidOrder({\n    status:'approved',\n    paymentTimestamp:null\n  }),\n  false\n);\n\nconst summary=summarizeDexPaidOrders([\n  {type:'tokenProfile',status:'rejected',paymentTimestamp:10},\n  {type:'tokenAd',status:'approved',paymentTimestamp:20}\n]);\n\nassert.equal(summary.confirmed,true);\nassert.equal(summary.confirmedCount,1);\nassert.equal(summary.orderType,'tokenAd');\nassert.equal(summary.paymentTimestamp,20);\n\nlet fetchCount=0;\nconst verifier=createDexPaidVerifier({\n  minIntervalMs:1,\n  positiveTtlMs:60_000,\n  fetchImpl:async()=>({\n    ok:true,\n    status:200,\n    async json(){\n      fetchCount++;\n      return [\n        {\n          type:'tokenProfile',\n          status:'approved',\n          paymentTimestamp:999\n        }\n      ];\n    }\n  })\n});\n\nconst first=await verifier.check('MintPaid111');\nconst second=await verifier.check('MintPaid111');\nassert.equal(first.confirmed,true);\nassert.equal(second.confirmed,true);\nassert.equal(fetchCount,1,'positive DEX Paid result must be cached');\n\nassert.equal(ENTRY_ADMISSION_KEYS.includes('requireDexPaid'),true);\nassert.equal(LOGIC_DECISION_KEYS.includes('requireDexPaid'),false);\nassert.equal(PREOPEN_RPC_KEYS.includes('requireDexPaid'),false);\n\nconst base={\n  ...defaultSettings(),\n  requireDexPaid:false,\n  minLiquidityUsd:0,\n  minHolders:null,\n  maxHolders:null,\n  minTokenAgeMinutes:null,\n  maxTokenAgeMinutes:null,\n  minMarketCapUsd:null,\n  maxMarketCapUsd:null,\n  minBondingCurvePct:null,\n  maxBondingCurvePct:null,\n  minTotalFeesSol:null,\n  maxTotalFeesSol:null,\n  minVolume24hUsd:null,\n  maxVolume24hUsd:null,\n  minBuyTransactions:null,\n  maxBuyTransactions:null,\n  minSellTransactions:null,\n  maxSellTransactions:null,\n  minTotalTransactions:null,\n  maxTotalTransactions:null,\n  minTop10Pct:null,\n  maxTop10Pct:null,\n  minDeveloperPct:null,\n  maxDeveloperPct:null,\n  minBundlePct:null,\n  maxBundlePct:null,\n  minSniperPct:null,\n  maxSniperPct:null,\n  requireTwitter:false,\n  requireWebsite:false,\n  requireTelegram:false,\n  requireAnySocial:false,\n  includeKeywords:'',\n  excludeKeywords:'',\n  developerBlacklistWallets:[]\n};\n\nconst token={\n  mint:'PaidGate111',\n  launchPlatform:'pump',\n  discoveredAt:Date.now()\n};\n\nassert.equal(\n  evaluateEntryAdmission(token,base).admitted,\n  true,\n  'DEX Paid OFF must not change scanner admission'\n);\n\nconst waiting=evaluateEntryAdmission(\n  token,\n  {...base,requireDexPaid:true}\n);\nassert.equal(waiting.admitted,false);\nassert.equal(waiting.waitingGates.some(g=>g.key==='requireDexPaid'),true);\n\nconst rejected=evaluateEntryAdmission(\n  {...token,dexPaidConfirmed:false},\n  {...base,requireDexPaid:true}\n);\nassert.equal(rejected.admitted,false);\nassert.equal(rejected.failedGates.some(g=>g.key==='requireDexPaid'),true);\nassert.equal(\n  rejected.failedGates.find(g=>g.key==='requireDexPaid')?.retryable,\n  true\n);\n\nconst admitted=evaluateEntryAdmission(\n  {...token,dexPaidConfirmed:true},\n  {...base,requireDexPaid:true}\n);\nassert.equal(admitted.admitted,true);\n\nassert.equal(normalizeSettings({requireDexPaid:true}).requireDexPaid,true);\nassert.equal(normalizeSettings({requireDexPaid:false}).requireDexPaid,false);\n\nconst app=fs.readFileSync(\n  new URL('../app-server.mjs',import.meta.url),\n  'utf8'\n);\nassert.match(app,/createDexPaidVerifier/);\nassert.match(app,/__mfDexPaidSweepTimer/);\nassert.match(app,/dexPaidConfirmed/);\nassert.doesNotMatch(app,/MEMEFLOW_DEX_POOL_VIEW_FILTER_V1/);\nassert.doesNotMatch(app,/dexViewRequested/);\nassert.doesNotMatch(app,/dexPool:_dexPaid/);\nassert.doesNotMatch(app,/mfDexFilterRowsByPaid/);\n\nconst settingsPage=fs.readFileSync(\n  new URL('../settings-page.js',import.meta.url),\n  'utf8'\n);\nassert.match(settingsPage,/mf293DexPaidFilter/);\nassert.match(settingsPage,/next\\.requireDexPaid=dexPaid\\.checked/);\nassert.doesNotMatch(settingsPage,/memeflow:dex-pool-filter/);\nassert.doesNotMatch(settingsPage,/mf293DexPoolFilterEnabled/);\nassert.doesNotMatch(settingsPage,/mf293DexQuerySuffix/);\n\nconst systemTokens=fs.readFileSync(\n  new URL('../system-tokens.js',import.meta.url),\n  'utf8'\n);\nassert.doesNotMatch(systemTokens,/memeflow:dex-pool-filter/);\nassert.doesNotMatch(systemTokens,/DEX_POOL_FILTER_KEY/);\n\nconsole.log('dex paid entry filter v1 ok');\n"
DEX_SCHEDULER="// MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1\n// DEX Paid is a TRUE Entry Filter now:\n//   OFF -> it has zero effect.\n//   ON  -> token remains hidden until a paid DEX Screener order is confirmed.\n// We only query DEX Screener after all OTHER Entry Filters pass, which keeps\n// the official 60 req/min orders endpoint out of the raw Pump hot path.\nconst __mfDexPaidNextCheckAt=new Map();\nlet __mfDexPaidWorkerBusy=false;\n\nfunction __mfDexPaidRequiredEntries(now=Date.now()){\n  try{\n    return settingsGateContext(now).entries\n      .filter(entry=>entry?.settings?.requireDexPaid===true);\n  }catch{\n    return [];\n  }\n}\n\nfunction __mfDexPaidPassesOtherEntryFilters(token,entry,now=Date.now()){\n  if(!token||!entry)return false;\n\n  const settings={\n    ...(entry.settings||{}),\n    requireDexPaid:false\n  };\n\n  return evaluateEntryAdmission(\n    token,\n    settings,\n    {now}\n  )?.admitted===true;\n}\n\nfunction __mfDexPaidCandidate(token,entries,now=Date.now()){\n  if(!token?.mint)return false;\n  if(token?.dead===true)return false;\n  if(token?.dexPaidConfirmed===true)return false;\n\n  const due=Number(\n    __mfDexPaidNextCheckAt.get(token.mint) ||\n    token.dexPaidNextCheckAt ||\n    0\n  );\n\n  if(due>now)return false;\n\n  return entries.some(\n    entry=>__mfDexPaidPassesOtherEntryFilters(token,entry,now)\n  );\n}\n\nasync function __mfRunDexPaidCheck(){\n  if(__mfDexPaidWorkerBusy)return;\n\n  const now=Date.now();\n  const entries=__mfDexPaidRequiredEntries(now);\n  if(!entries.length)return;\n\n  const candidates=__mfLiveScannerTokens(now)\n    .filter(token=>__mfDexPaidCandidate(token,entries,now))\n    .sort((a,b)=>{\n      const aChecked=Number(a?.dexPaidCheckedAt||0);\n      const bChecked=Number(b?.dexPaidCheckedAt||0);\n\n      // Never-checked candidates first.\n      if(Boolean(aChecked)!==Boolean(bChecked)){\n        return aChecked?1:-1;\n      }\n\n      // Stronger live candidates first, then older unchecked candidate.\n      const aOpp=Number(a?.opportunityScore||0);\n      const bOpp=Number(b?.opportunityScore||0);\n      if(aOpp!==bOpp)return bOpp-aOpp;\n\n      return aChecked-bChecked;\n    });\n\n  const token=candidates[0];\n  if(!token)return;\n\n  __mfDexPaidWorkerBusy=true;\n\n  try{\n    const result=await dexPaidVerifier.check(token.mint);\n    const confirmed=\n      result?.confirmed===true\n        ? true\n        : result?.confirmed===false\n          ? false\n          : null;\n\n    const nextAt=\n      confirmed===true\n        ? null\n        : Number(result?.expiresAt||0) || (Date.now()+5000);\n\n    if(nextAt){\n      __mfDexPaidNextCheckAt.set(token.mint,nextAt);\n    }else{\n      __mfDexPaidNextCheckAt.delete(token.mint);\n    }\n\n    const updated=store.setToken(\n      token.mint,\n      {\n        dexPaidConfirmed:confirmed,\n        dexPaidStatus:result?.status||null,\n        dexPaidPaymentTimestamp:result?.paymentTimestamp||null,\n        dexPaidOrderType:result?.orderType||null,\n        dexPaidCheckedAt:result?.checkedAt||Date.now(),\n        dexPaidNextCheckAt:nextAt,\n        dexPaidSource:'dexscreener-paid-orders',\n        dexPaidError:result?.error||null\n      }\n    ) || token;\n\n    if(confirmed===true){\n      try{settingsGateClear(updated)}catch{}\n    }\n\n    try{\n      await Promise.resolve(evaluateAll(updated));\n    }catch{}\n\n    try{publish(token.mint)}catch{}\n  }finally{\n    __mfDexPaidWorkerBusy=false;\n  }\n}\n\nconst __mfDexPaidSweepTimer=setInterval(\n  ()=>{void __mfRunDexPaidCheck().catch(()=>{})},\n  Math.max(500,Number(process.env.DEX_PAID_SWEEP_MS||1000))\n);\n__mfDexPaidSweepTimer.unref?.();\n"

try:
    app_text=originals['app']
    settings=originals['settings']
    gate=originals['gate']
    page=originals['settings_page']
    system=originals['system']
    tokens=originals['tokens']
    pkg=originals['pkg']
    arch=originals['arch_test']
    settings_html=originals['settings_html']
    system_html=originals.get('system_html','')
    tokens_html=originals.get('tokens_html','')

    if MARK in app_text or MARK in gate:
        print('Patch is already installed.'); raise SystemExit(0)

    # 1. Canonical setting.
    settings=replace_once(settings,
      "'requireTwitter','requireWebsite','requireTelegram','requireAnySocial','requireFreshHolderSnapshot','requireWebsiteOrX',",
      "'requireTwitter','requireWebsite','requireTelegram','requireAnySocial','requireFreshHolderSnapshot','requireWebsiteOrX','requireDexPaid',",
      'settings/boolean')
    settings=replace_once(settings,
      "minScore:72,minConfidence:70,minLiquidityUsd:0,minBuyPressure:1.2,requireFreshHolderSnapshot:true,requireWebsiteOrX:false,",
      "minScore:72,minConfidence:70,minLiquidityUsd:0,minBuyPressure:1.2,requireFreshHolderSnapshot:true,requireWebsiteOrX:false,requireDexPaid:false,",
      'settings/default')

    # 2. Entry gate: DEX Paid is admission, not Logic and not final wallet RPC.
    gate=replace_once(gate,
      "  range('Sniper share','sniperPct','minSniperPct','maxSniperPct');\n\n  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1",
      "  range('Sniper share','sniperPct','minSniperPct','maxSniperPct');\n\n  if(settings.requireDexPaid===true){\n    const confirmed=\n      token?.dexPaidConfirmed===true\n        ? true\n        : token?.dexPaidConfirmed===false\n          ? false\n          : null;\n\n    add(\n      'DEX Paid confirmation',\n      confirmed,\n      'confirmed DEX Paid order is required',\n      {\n        key:'requireDexPaid',\n        value:confirmed,\n        threshold:true,\n        operator:'===',\n        retryable:true,\n        source:'dexPaidConfirmed'\n      }\n    );\n  }\n\n  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1",
      'gate/dex-paid')
    gate=replace_once(gate,
      "  'launchPlatforms',\n  'includeKeywords',",
      "  'launchPlatforms',\n  'requireDexPaid',\n  'includeKeywords',",
      'gate/entry-key')

    # 3. Replace every legacy DEX pool/view implementation with one verifier service.
    app_text=replace_once(app_text,
      "import {candidateFeed,candidateVisibilityCounts} from './src/candidate-visibility.mjs';import {dexViewRequested,dexViewMint,dexPresenceFromPairs,filterRowsByDexPresence} from './src/dex-view-filter.mjs';",
      "import {candidateFeed,candidateVisibilityCounts} from './src/candidate-visibility.mjs';\nimport {createDexPaidVerifier} from './src/dex-paid.mjs'; // MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1",
      'app/import')
    app_text=replace_once(app_text,
      "solUsdOracle.start();",
      "solUsdOracle.start();\nconst dexPaidVerifier=createDexPaidVerifier({\n  minIntervalMs:Math.max(1000,Number(process.env.DEX_PAID_MIN_INTERVAL_MS||1100)),\n  timeoutMs:Math.max(1000,Number(process.env.DEX_PAID_TIMEOUT_MS||6000))\n}); // MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1",
      'app/verifier-init')
    app_text=sub_once(app_text,
      r"/\* MEMEFLOW_DEX_POOL_VIEW_FILTER_V1[\s\S]*?\n\s*/\* MEMEFLOW_AI_STANDALONE_V49_ROUTE_BEGIN \*/",
      "/* MEMEFLOW_AI_STANDALONE_V49_ROUTE_BEGIN */",
      'app/remove-legacy-dex-view')

    # Old query-string display filtering disappears completely.
    app_text=replace_once(app_text,"  const _dexPaid=dexViewRequested(url.searchParams);\n",'', 'app/remove-decision-query')
    app_text=replace_once(app_text,
      "  const _all=_dexPaid?await mfDexFilterRowsByPaid(_raw):_raw;",
      "  const _all=_raw;",
      'app/decision-feed')
    app_text=sub_once(app_text,
      r",\n\s*viewFilter:\{\n\s*dexPaid:_dexPaid,\n\s*dexPool:_dexPaid,\n\s*semantics:_dexPaid\?'dex-paid':'pump'\n\s*\}",
      '',
      'app/remove-view-filter-response')
    app_text=sub_once(app_text,
      r"\n\s*if\(dexViewRequested\(url\.searchParams\)\)\{\n\s*pumpTokens=await mfDexFilterRowsByPaid\(pumpTokens\);\n\s*\}\n",
      '\n',
      'app/remove-token-query-filter')

    # Surface confirmation in canonical candidate/debug payloads.
    app_text=replace_once(app_text,
      "    opportunityTrendHealthy:t.opportunityTrendHealthy===true,",
      "    opportunityTrendHealthy:t.opportunityTrendHealthy===true,\n    dexPaidConfirmed:t.dexPaidConfirmed===true,\n    dexPaidStatus:t.dexPaidStatus||null,\n    dexPaidCheckedAt:t.dexPaidCheckedAt||null,",
      'app/candidate-dex-fields')

    # Clean verifier cache when scanner token is pruned.
    app_text=replace_once(app_text,
      "  try{opportunityEngine?.dropMint?.(mint)}catch{}",
      "  try{opportunityEngine?.dropMint?.(mint)}catch{}\n  try{dexPaidVerifier?.drop?.(mint)}catch{}",
      'app/drop-dex-cache')

    # Add rate-limited admission-aware DEX Paid sweeper after the normal pre-admission timer.
    anchor="__mfPreAdmissionSweepTimer.unref?.();\n/* MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT */"
    app_text=replace_once(app_text,anchor,"__mfPreAdmissionSweepTimer.unref?.();\n"+DEX_SCHEDULER+"\n/* MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT */",'app/dex-scheduler')

    # 4. Standalone Settings: top DEX Paid switch becomes a persisted server setting.
    page=sub_once(page,
      r"\nconst MF293_DEX_POOL_FILTER_KEY = 'memeflow:dex-pool-filter';[\s\S]*?function mf293ApplyProfilePreset\(profile\) \{",
      "\nfunction mf293ApplyProfilePreset(profile) {",
      'page/remove-local-dex-view')
    page=replace_once(page,
      "for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults', 'mf293DexPoolFilter'])",
      "for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults', 'mf293DexPaidFilter'])",
      'page/disable-id')
    page=replace_once(page,
      "<label class=\"mf293-dex-filter-meta\" title=\"Show only Pump.fun tokens that already have a DEX Paid\">\n        <div>DEX<strong>Paid</strong></div>\n        <span class=\"mf293-switch\">\n          <input id=\"mf293DexPoolFilter\" type=\"checkbox\" aria-label=\"DEX Paid filter\">",
      "<label class=\"mf293-dex-filter-meta\" title=\"Require a confirmed DEX Paid order for scanner visibility and BUY READY\">\n        <div>DEX<strong>Paid</strong></div>\n        <span class=\"mf293-switch\">\n          <input id=\"mf293DexPaidFilter\" type=\"checkbox\" aria-label=\"Require confirmed DEX Paid\">",
      'page/meta-switch')
    page=sub_once(page,
      r"  document\.getElementById\('mf293DexPoolFilter'\)\?\.addEventListener\('change', event => \{[\s\S]*?\n  \}\);\n\n  document\.querySelector\('\[data-setting-key=\"profile\"\]'\)",
      "  document.getElementById('mf293DexPaidFilter')?.addEventListener('change', event => {\n    MF293.dirty = true;\n    mf293ClearError();\n    mf293Status(`DEX Paid · ${event.currentTarget?.checked === true ? 'Required' : 'Off'} · Unsaved`, 'dirty');\n  });\n\n  document.querySelector('[data-setting-key=\"profile\"]')",
      'page/switch-listener')
    page=sub_once(page,
      r"  const dexFilter = document\.getElementById\('mf293DexPoolFilter'\);\n  if \(dexFilter\) \{\n    dexFilter\.checked = mf293DexPoolFilterEnabled\(\);\n  \}\n",
      "  const dexPaid = document.getElementById('mf293DexPaidFilter');\n  if (dexPaid) {\n    dexPaid.checked = MF293.settings.requireDexPaid === true;\n  }\n",
      'page/populate')
    page=replace_once(page,
      "  // Discovery remains Pump.fun only. DEX is a browser-side VIEW filter and\n  // never changes evaluation settings or triggers decision re-evaluation.\n  next.launchPlatforms = ['pump'];",
      "  // Discovery remains Pump.fun only. DEX Paid is a REAL Entry Filter.\n  const dexPaid = document.getElementById('mf293DexPaidFilter');\n  if (dexPaid) next.requireDexPaid=dexPaid.checked;\n  next.launchPlatforms = ['pump'];",
      'page/collect')

    # 5. Legacy System settings engine: remove browser-side DEX pool view semantics too.
    system=system.replace("${mf293DexQuerySuffix()}","")
    system=sub_once(system,
      r"\nconst MF293_DEX_POOL_FILTER_KEY = 'memeflow:dex-pool-filter';[\s\S]*?function mf293ApplyProfilePreset\(profile\) \{",
      "\nfunction mf293ApplyProfilePreset(profile) {",
      'system/remove-local-dex-view')
    system=system.replace("'mf293DexPoolFilter'","'mf293DexPaidFilter'")
    system=replace_once(system,
      "<label class=\"mf293-dex-filter-meta\" title=\"Show only Pump.fun tokens that already have a DEX Paid\">\n        <div>DEX<strong>Paid</strong></div>\n        <span class=\"mf293-switch\">\n          <input id=\"mf293DexPoolFilter\" type=\"checkbox\" aria-label=\"DEX Paid filter\">",
      "<label class=\"mf293-dex-filter-meta\" title=\"Require a confirmed DEX Paid order for scanner visibility and BUY READY\">\n        <div>DEX<strong>Paid</strong></div>\n        <span class=\"mf293-switch\">\n          <input id=\"mf293DexPaidFilter\" type=\"checkbox\" aria-label=\"Require confirmed DEX Paid\">",
      'system/meta-switch')
    system=sub_once(system,
      r"  document\.getElementById\('mf293DexPaidFilter'\)\?\.addEventListener\('change', event => \{[\s\S]*?\n  \}\);\n\n  document\.querySelector\('\[data-setting-key=\"profile\"\]'\)",
      "  document.getElementById('mf293DexPaidFilter')?.addEventListener('change', event => {\n    MF293.dirty = true;\n    mf293ClearError();\n    mf293Status(`DEX Paid · ${event.currentTarget?.checked === true ? 'Required' : 'Off'} · Unsaved`, 'dirty');\n  });\n\n  document.querySelector('[data-setting-key=\"profile\"]')",
      'system/switch-listener')
    system=sub_once(system,
      r"  const dexFilter = document\.getElementById\('mf293DexPaidFilter'\);\n  if \(dexFilter\) \{\n    dexFilter\.checked = mf293DexPoolFilterEnabled\(\);\n  \}\n",
      "  const dexPaid = document.getElementById('mf293DexPaidFilter');\n  if (dexPaid) dexPaid.checked = MF293.settings.requireDexPaid === true;\n",
      'system/populate')
    system=replace_once(system,
      "  // Discovery remains Pump.fun only. DEX is a browser-side VIEW filter and\n  // never changes evaluation settings or triggers decision re-evaluation.\n  next.launchPlatforms = ['pump'];",
      "  // Discovery remains Pump.fun only. DEX Paid is a REAL Entry Filter.\n  const dexPaid = document.getElementById('mf293DexPaidFilter');\n  if (dexPaid) next.requireDexPaid=dexPaid.checked;\n  next.launchPlatforms = ['pump'];",
      'system/collect')

    # 6. Token feed no longer has a device-local DEX view switch.
    tokens=sub_once(tokens,
      r"\nconst DEX_POOL_FILTER_KEY = 'memeflow:dex-pool-filter';\n\nfunction dexPaidFilterEnabled\(\) \{[\s\S]*?\n\}\n\n",
      '\n',
      'tokens/remove-local-filter')

    # 7. Cache bust UI scripts.
    settings_html=re.sub(r'/settings-page\.js\?v=[^\"\']+','/settings-page.js?v=dex-paid-entry-v1',settings_html,count=1)
    if system_html:
        system_html=re.sub(r'/system\.js\?v=[^\"\']+','/system.js?v=dex-paid-entry-v1',system_html,count=1)
    if tokens_html:
        tokens_html=re.sub(r'/system-tokens\.js\?v=[^\"\']+','/system-tokens.js?v=dex-paid-entry-v1',tokens_html,count=1)

    # Existing settings architecture test follows the new cache version.
    arch=arch.replace("settings-page\\.js\\?v=settings-architecture-v2","settings-page\\.js\\?v=dex-paid-entry-v1")

    # 8. Replace obsolete pool test/module with DEX Paid verifier test/module.
    paths['new_source'].write_text(DEX_MODULE.rstrip()+'\n',encoding='utf-8')
    paths['new_test'].write_text(DEX_TEST.rstrip()+'\n',encoding='utf-8')
    pkg=replace_once(pkg,
      'node tests/dex-view-filter.mjs && ',
      'node tests/dex-paid.mjs && ',
      'package/test')

    # Write patched files.
    paths['app'].write_text(app_text.rstrip()+'\n',encoding='utf-8')
    paths['settings'].write_text(settings.rstrip()+'\n',encoding='utf-8')
    paths['gate'].write_text(gate.rstrip()+'\n',encoding='utf-8')
    paths['settings_page'].write_text(page.rstrip()+'\n',encoding='utf-8')
    paths['settings_html'].write_text(settings_html.rstrip()+'\n',encoding='utf-8')
    paths['system'].write_text(system.rstrip()+'\n',encoding='utf-8')
    if paths['system_html'].exists(): paths['system_html'].write_text(system_html.rstrip()+'\n',encoding='utf-8')
    paths['tokens'].write_text(tokens.rstrip()+'\n',encoding='utf-8')
    if paths['tokens_html'].exists(): paths['tokens_html'].write_text(tokens_html.rstrip()+'\n',encoding='utf-8')
    paths['pkg'].write_text(pkg.rstrip()+'\n',encoding='utf-8')
    paths['arch_test'].write_text(arch.rstrip()+'\n',encoding='utf-8')

    paths['old_source'].unlink()
    paths['old_test'].unlink()

    # Static guarantee: no pool-view/filter implementation survives.
    forbidden=[
      'memeflow:dex-pool-filter',
      'MF_DEX_VIEW_CACHE',
      'MEMEFLOW_DEX_POOL_VIEW_FILTER_V1',
      'dexViewRequested',
      'dexPresenceFromPairs',
      'filterRowsByDexPresence',
      "from './src/dex-view-filter.mjs'"
    ]
    scan_files=[paths['app'],paths['settings_page'],paths['system'],paths['tokens'],paths['gate'],paths['settings']]
    for p in scan_files:
        txt=p.read_text(encoding='utf-8')
        for needle in forbidden:
            if needle in txt: raise RuntimeError(f'Legacy DEX pool/view code remains in {p}: {needle}')

    print('=== Syntax checks ===')
    for p in [paths['app'],paths['settings'],paths['gate'],paths['settings_page'],paths['system'],paths['tokens'],paths['new_source'],paths['new_test']]:
        run(['node','--check',str(p)],cwd=root)

    print('=== DEX Paid regression ===')
    run(['node','tests/dex-paid.mjs'],cwd=app)

    print('=== Full test suite ===')
    run(['npm','test'],cwd=app)

    print('=== 500-user/performance benchmark ===')
    run(['npm','run','benchmark'],cwd=app)

    print('=== Diff validation ===')
    run(['git','diff','--check'],cwd=root)

except BaseException as error:
    print(f'ERROR: {error}')
    print('Rolling back local patch changes...')
    for k,content in originals.items():
        paths[k].parent.mkdir(parents=True,exist_ok=True)
        paths[k].write_text(content,encoding='utf-8')
    if not new_source_existed:
        try: paths['new_source'].unlink()
        except FileNotFoundError: pass
    if not new_test_existed:
        try: paths['new_test'].unlink()
        except FileNotFoundError: pass
    print('Rollback complete. No commit/push was made.')
    raise

print('=== Commit + push ===')
changed=[
 paths['app'],paths['settings'],paths['gate'],paths['settings_page'],paths['settings_html'],
 paths['system'],paths['tokens'],paths['pkg'],paths['arch_test'],
 paths['new_source'],paths['new_test'],paths['old_source'],paths['old_test']
]
if paths['system_html'].exists(): changed.append(paths['system_html'])
if paths['tokens_html'].exists(): changed.append(paths['tokens_html'])
rel=[str(p.relative_to(root)) for p in changed]
run(['git','add','-A','--',*rel],cwd=root)
run(['git','commit','-m','[MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1] Make DEX Paid a real scanner and buy filter'],cwd=root)
run(['git','push','origin','HEAD'],cwd=root)

print()
print('='*68)
print(' MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1 INSTALLED SUCCESSFULLY')
print('='*68)
print('Restart the Replit backend/deployment.')
print()
print('DEX Paid OFF: no effect on scanner or buying.')
print('DEX Paid ON : only confirmed paid-order tokens are visible/eligible.')
print('Legacy DEX Pool/device-local/query-string filters were removed.')
print('DEX Paid verification is rate-limited and runs only after other Entry Filters pass.')
