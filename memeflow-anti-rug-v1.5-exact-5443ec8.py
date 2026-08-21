#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_ANTI_RUG_V1_5_EXACT"
EXPECTED_HEAD = "5443ec8abf39bbcb2b4c8c35ab0afcaa55ba4baf"
NEW_TEST = "src/anti-rug-v1_5-exact.test.mjs"
NEW_NUMERIC = (
    "maxSuspectedRiskyWalletsPct",
    "maxInsidersPct",
    "maxDeveloperRugHistoryPct",
    "maxDeveloperExitPct",
)
NEW_BOOLEAN = ("requireDevMigrated", "requireTokenLogo")
NEW_KEYS = NEW_NUMERIC + NEW_BOOLEAN


def log(msg: str) -> None:
    print(f"[V1.5] {msg}", flush=True)


def run(args, cwd: Path, *, capture=False):
    p = subprocess.run(args, cwd=cwd, text=True, capture_output=capture)
    if p.returncode:
        detail = (p.stderr or p.stdout or "").strip() if capture else ""
        raise RuntimeError(
            f"Command failed ({p.returncode}): {' '.join(map(str,args))}"
            + (f"\n{detail}" if detail else "")
        )
    return p


def root_dir() -> Path:
    cwd = Path.cwd().resolve()
    candidates = [
        cwd,
        cwd / "memeflow-app",
        cwd.parent / "memeflow-app",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
        Path("/workspace/memeflow-app"),
    ]
    seen = set()
    for r in candidates:
        try:
            r = r.resolve()
        except Exception:
            continue
        if r in seen:
            continue
        seen.add(r)
        if (r / "app-server.mjs").is_file() and (r / "src/evaluate.mjs").is_file() and (r / "src/settings.mjs").is_file():
            return r
    raise RuntimeError("MEMEFLOW app root not found. Run from repo root or memeflow-app.")


def clean_for(root: Path, paths: list[Path]) -> None:
    for p in paths:
        rel = str(p.relative_to(root))
        run(["git", "diff", "--quiet", "--", rel], root)
        run(["git", "diff", "--cached", "--quiet", "--", rel], root)


def discover_ui(root: Path) -> list[tuple[Path, str]]:
    found = []
    seen = set()
    for name in ("system.js", "index.html", "settings.html"):
        for prefix in ("", "public", "web", "static", "client"):
            p = root / prefix / name if prefix else root / name
            if not p.is_file():
                continue
            p = p.resolve()
            if p in seen:
                continue
            seen.add(p)
            low = p.name.lower()
            if "backup" in low or ".before-" in low:
                continue
            t = p.read_text(encoding="utf-8", errors="replace")
            if p.name == "system.js" and all(x in t for x in ("MF293_GROUPS", "maxTop10Pct", "maxDeveloperPct", "/api/settings")):
                found.append((p, "mf293"))
            elif p.suffix == ".html" and all(x in t for x in ('id="aiSettingsForm"', 'id="maxTop10"', 'id="maxDeveloper"', "ai-trading-settings-js", "/api/settings")):
                found.append((p, "html"))
    if not found:
        raise RuntimeError("Could not safely identify Settings frontend (MF293 system.js or aiSettingsForm HTML). Nothing changed.")
    return found


def patch_settings(text: str) -> str:
    if PATCH_ID in text:
        raise RuntimeError("V1.5 already installed in settings.mjs")
    for public, base in (
        ("defaultSettings", "__mfV15BaseDefaultSettings"),
        ("normalizeSettings", "__mfV15BaseNormalizeSettings"),
        ("validateSettings", "__mfV15BaseValidateSettings"),
    ):
        pat = rf"export\s+function\s+{public}\s*\("
        n = len(re.findall(pat, text))
        if n != 1:
            raise RuntimeError(f"settings.mjs expected one export function {public}(), found {n}")
        text = re.sub(pat, f"function {base}(", text, count=1)

    wrapper = r'''
// MEMEFLOW_ANTI_RUG_V1_5_EXACT
// Explicit evidence only. Disabled values are inert; no risk percentage is synthesized.
const __mfV15NumericKeys=Object.freeze([
  'maxSuspectedRiskyWalletsPct','maxInsidersPct',
  'maxDeveloperRugHistoryPct','maxDeveloperExitPct'
]);
const __mfV15BooleanKeys=Object.freeze(['requireDevMigrated','requireTokenLogo']);
function __mfV15Object(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
function __mfV15Strip(raw){const o={...__mfV15Object(raw)};for(const k of [...__mfV15NumericKeys,...__mfV15BooleanKeys])delete o[k];return o}
function __mfV15Pct(v){if(v===''||v===null||v===undefined)return null;const n=Number(v);return Number.isFinite(n)?n:null}
function __mfV15Bool(v,f=false){if(v===undefined||v===null||v==='')return Boolean(f);if(typeof v==='boolean')return v;if(typeof v==='string'){const x=v.trim().toLowerCase();if(['true','1','yes','on'].includes(x))return true;if(['false','0','no','off'].includes(x))return false}return Boolean(v)}

export function defaultSettings(){
  return {...__mfV15BaseDefaultSettings(),
    maxSuspectedRiskyWalletsPct:null,maxInsidersPct:null,requireDevMigrated:false,
    maxDeveloperRugHistoryPct:null,maxDeveloperExitPct:null,requireTokenLogo:false};
}
export function normalizeSettings(raw={}){
  const input=__mfV15Object(raw),base=__mfV15BaseNormalizeSettings(__mfV15Strip(input)),out={...base};
  for(const k of __mfV15NumericKeys)out[k]=__mfV15Pct(Object.prototype.hasOwnProperty.call(input,k)?input[k]:null);
  for(const k of __mfV15BooleanKeys)out[k]=__mfV15Bool(Object.prototype.hasOwnProperty.call(input,k)?input[k]:false,false);
  return out;
}
export function validateSettings(raw={}){
  const input=__mfV15Object(raw),base=__mfV15BaseValidateSettings(__mfV15Strip(input));
  const errors=Array.isArray(base?.errors)?[...base.errors]:[];
  for(const k of __mfV15NumericKeys){
    if(!Object.prototype.hasOwnProperty.call(input,k))continue;
    const v=input[k];if(v===''||v===null||v===undefined)continue;
    const n=Number(v);if(!Number.isFinite(n))errors.push(`${k} must be a number or blank.`);else if(n<0||n>100)errors.push(`${k} must be between 0 and 100.`);
  }
  for(const k of __mfV15BooleanKeys){
    if(!Object.prototype.hasOwnProperty.call(input,k))continue;
    const v=input[k],valid=typeof v==='boolean'||(typeof v==='string'&&['true','false','1','0','yes','no','on','off'].includes(v.trim().toLowerCase()));
    if(!valid)errors.push(`${k} must be boolean.`);
  }
  return {...(base&&typeof base==='object'?base:{}),ok:errors.length===0,errors,settings:normalizeSettings(input)};
}
'''
    return text.rstrip() + "\n\n" + wrapper.strip() + "\n"


def patch_evaluate(text: str) -> str:
    if PATCH_ID in text:
        raise RuntimeError("V1.5 already installed in evaluate.mjs")
    pat = r"export\s+function\s+evaluate\s*\("
    n = len(re.findall(pat, text))
    if n != 1:
        raise RuntimeError(f"evaluate.mjs expected one exported evaluate(), found {n}")
    text = re.sub(pat, "function __mfV15BaseEvaluate(", text, count=1)
    wrapper = r'''
// MEMEFLOW_ANTI_RUG_V1_5_EXACT
// Evidence-only wrapper around canonical V1.4.2. No DEX price/quote/pool-price inputs.
export function evaluate(token={},s={}){
  const base=__mfV15BaseEvaluate(token,s);
  const originalState=String(base?.state||'WAITING').toUpperCase();
  const gates=Array.isArray(base?.settingsEvaluation?.gates)?[...base.settingsEvaluation.gates]:[];
  const reasons=Array.isArray(base?.reasons)?[...base.reasons]:[];
  let blocked=false,waiting=false,primary=null;
  const finite=v=>{if(v===''||v===null||v===undefined)return null;const n=Number(v);return Number.isFinite(n)?n:null};
  const push=(name,status,reason,detail={})=>{
    gates.push({name,status,pass:status==='PASS',...detail});
    if(status==='FAIL'){blocked=true;if(reason)reasons.push(reason);if(!primary&&reason)primary=reason}
    else if(status==='WAITING'){waiting=true;const r=reason?.startsWith('Waiting: ')?reason:`Waiting: ${reason||name+' evidence pending'}`;reasons.push(r);if(!primary)primary=r}
  };
  const maxGate=(name,settingKey,tokenKey,pending,failLabel)=>{
    const threshold=finite(s?.[settingKey]);if(threshold===null)return;
    const value=finite(token?.[tokenKey]);
    if(value===null)return push(name,'WAITING',pending,{value:null,threshold,operator:'<='});
    if(value>threshold)return push(name,'FAIL',`${failLabel} ${value}% above configured maximum ${threshold}%`,{value,threshold,operator:'<='});
    push(name,'PASS',null,{value,threshold,operator:'<='});
  };
  maxGate('Suspected risky wallets','maxSuspectedRiskyWalletsPct','suspectedRiskyWalletsPct','suspected risky wallets evidence pending','suspected risky wallets');
  maxGate('Insiders','maxInsidersPct','insidersPct','insider evidence pending','insiders');
  maxGate('Developer rug history','maxDeveloperRugHistoryPct','developerRugHistoryPct','developer rug history evidence pending','developer rug history');
  maxGate('Developer exit','maxDeveloperExitPct','developerExitPct','developer exit evidence pending','developer exit');
  if(s?.requireDevMigrated===true){
    if(typeof token?.devMigrated!=='boolean')push('Developer migrated','WAITING','developer migration evidence pending',{value:null,required:true});
    else if(token.devMigrated!==true)push('Developer migrated','FAIL','developer migration requirement failed',{value:false,required:true});
    else push('Developer migrated','PASS',null,{value:true,required:true});
  }
  if(s?.requireTokenLogo===true){
    const logo=typeof token?.imageUrl==='string'&&token.imageUrl.trim()?token.imageUrl.trim():null;
    const resolved=token?.metadataResolved===true||token?.metadataReady===true||token?.metadataFetched===true||Boolean(token?.metadataFetchedAt&&!token?.metadataError);
    if(logo)push('Token logo','PASS',null,{value:logo,required:true});
    else if(resolved)push('Token logo','FAIL','token logo is required',{value:null,required:true});
    else push('Token logo','WAITING','token logo metadata pending',{value:null,required:true});
  }
  let state=originalState;if(blocked)state='BLOCKED';else if(waiting&&originalState!=='BLOCKED')state='WAITING';
  const preservePrimary=originalState==='BLOCKED'&&!blocked;
  return {...base,state,reasons,primaryReason:preservePrimary?base?.primaryReason:(primary||base?.primaryReason||reasons[0]||null),settingsEvaluation:{...(base?.settingsEvaluation||{}),gates},antiRugEvidenceVersion:'V1.5'};
}
'''
    return text.rstrip() + "\n\n" + wrapper.strip() + "\n"


def patch_mf293(text: str) -> str:
    if PATCH_ID in text:
        return text
    fields = """    ['maxSuspectedRiskyWalletsPct', 'Maximum suspected risky wallets %', 'nullable', 0, 100, 0.1],
    ['maxInsidersPct', 'Maximum insiders %', 'nullable', 0, 100, 0.1],
    ['maxDeveloperRugHistoryPct', 'Maximum developer rug history %', 'nullable', 0, 100, 0.1],
    ['maxDeveloperExitPct', 'Maximum developer exit %', 'nullable', 0, 100, 0.1],
    ['requireDevMigrated', 'Require dev migrated', 'boolean'],
    ['requireTokenLogo', 'Require token logo', 'boolean'],"""
    for pat in (r"(?m)^(\s*\['maxSniperPct'[^\n]*\],\s*)$", r"(?m)^(\s*\['maxDeveloperPct'[^\n]*\],\s*)$"):
        m = list(re.finditer(pat, text))
        if len(m) == 1:
            x = m[0]
            return text[:x.start()] + x.group(0) + "\n" + fields + text[x.end():] + f"\n/* {PATCH_ID} */\n"
    raise RuntimeError("system.js could not find unique maxSniperPct/maxDeveloperPct MF293 anchor")


def patch_html(text: str) -> str:
    if PATCH_ID in text:
        return text
    old = '<div class="setting-field"><label for="maxDeveloper">Maximum developer · %</label><input id="maxDeveloper" min="0" max="100" step="0.1" type="number" disabled/></div>'
    if text.count(old) != 1:
        raise RuntimeError(f"Settings HTML maxDeveloper field anchor count={text.count(old)}")
    extra = old + (
        '<div class="setting-field"><label for="maxSuspectedRiskyWalletsPct">Maximum suspected risky wallets · %</label><input id="maxSuspectedRiskyWalletsPct" min="0" max="100" step="0.1" type="number" disabled/><small>Blank disables this gate. Unknown enabled evidence waits.</small></div>'
        '<div class="setting-field"><label for="maxInsidersPct">Maximum insiders · %</label><input id="maxInsidersPct" min="0" max="100" step="0.1" type="number" disabled/><small>Explicit evidence only; no synthetic percentage.</small></div>'
        '<div class="setting-field"><label for="maxDeveloperRugHistoryPct">Maximum developer rug history · %</label><input id="maxDeveloperRugHistoryPct" min="0" max="100" step="0.1" type="number" disabled/></div>'
        '<div class="setting-field"><label for="maxDeveloperExitPct">Maximum developer exit · %</label><input id="maxDeveloperExitPct" min="0" max="100" step="0.1" type="number" disabled/></div>'
    )
    text = text.replace(old, extra, 1)
    social = '<div class="toggle-row"><div class="toggle-copy"><b>Use optional website/X metadata</b><span>Informational enrichment only; it cannot be the sole LIVE execution gate.</span></div><label class="switch"><input id="requireSocial" type="checkbox" disabled/><i></i></label></div>'
    if text.count(social) != 1:
        raise RuntimeError(f"Settings HTML requireSocial anchor count={text.count(social)}")
    toggles = (
        '<div class="toggle-row"><div class="toggle-copy"><b>Require dev migrated</b><span>Unknown migration evidence stays WAITING; confirmed false is BLOCKED.</span></div><label class="switch"><input id="requireDevMigrated" type="checkbox" disabled/><i></i></label></div>'
        '<div class="toggle-row"><div class="toggle-copy"><b>Require token logo</b><span>Waits for metadata resolution before treating a missing logo as a failure.</span></div><label class="switch"><input id="requireTokenLogo" type="checkbox" disabled/><i></i></label></div>'
        + social
    )
    text = text.replace(social, toggles, 1)
    pat = re.compile(r"const ids=\[(?P<body>[^\n]+)\];")
    matches = list(pat.finditer(text))
    if len(matches) != 1:
        raise RuntimeError(f"Settings HTML ids array count={len(matches)}")
    m = matches[0]
    body = m.group("body")
    anchor = "'maxDeveloper',"
    if body.count(anchor) != 1:
        raise RuntimeError("Settings HTML maxDeveloper ids anchor is not unique")
    add = "'maxDeveloper','maxSuspectedRiskyWalletsPct','maxInsidersPct','maxDeveloperRugHistoryPct','maxDeveloperExitPct','requireDevMigrated','requireTokenLogo',"
    body = body.replace(anchor, add, 1)
    text = text[:m.start("body")] + body + text[m.end("body"):]
    return text.rstrip() + f"\n<!-- {PATCH_ID} -->\n"


def make_test() -> str:
    return r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultSettings,normalizeSettings,validateSettings} from './settings.mjs';
import {evaluate} from './evaluate.mjs';
const NOW=Date.now();
const token=(p={})=>({
 mint:'V15Risk111111111111111111111111111pump',name:'V15 Risk',symbol:'V15',launchPlatform:'pump',protocol:'pump',source:'Pump create',
 discoveredAt:NOW-5*60_000,pumpCreatedAt:NOW-5*60_000,pumpCreatedAtPending:false,
 holderCount:120,holderFresh:true,top10Pct:10,developerPct:2,buyPressure:3,priceSol:1,peakPriceSol:1,dataQuality:1,
 liquidityUsd:1_000_000,marketCapUsd:1_000_000,bondingCurvePct:10,bondingCurveProgressPct:10,volume24hUsd:1_000_000,
 buys24h:100,sells24h:10,buyTransactions:100,sellTransactions:10,totalTransactions:110,totalFeesSol:100,bundlePct:0,sniperPct:0,
 twitter:'https://x.com/v15',website:'https://example.invalid',metadataResolved:true,metadataReady:true,imageUrl:'https://example.invalid/logo.png',
 devMigrated:true,suspectedRiskyWalletsPct:1,insidersPct:1,developerRugHistoryPct:0,developerExitPct:0,...p
});
const cfg=(p={})=>normalizeSettings({...defaultSettings(),minScore:0,minConfidence:0,minHolders:null,maxHolders:null,minLiquidityUsd:null,minMarketCapUsd:null,maxMarketCapUsd:null,minBondingCurvePct:null,maxBondingCurvePct:null,minBondingCurveProgressPct:null,maxBondingCurveProgressPct:null,minVolume24hUsd:null,maxVolume24hUsd:null,minBuyTransactions:null,maxBuyTransactions:null,minSellTransactions:null,maxSellTransactions:null,minTotalTransactions:null,maxTotalTransactions:null,minBuys24h:null,maxBuys24h:null,minSells24h:null,maxSells24h:null,minBundlePct:null,maxBundlePct:null,minSniperPct:null,maxSniperPct:null,minTokenAgeMinutes:null,maxTokenAgeMinutes:null,requireFreshHolderSnapshot:false,requireAnySocial:false,requireTwitter:false,requireWebsite:false,requireTelegram:false,requireWebsiteOrX:false,maxTop10Pct:25,maxDeveloperPct:20,maxSuspectedRiskyWalletsPct:null,maxInsidersPct:null,requireDevMigrated:false,maxDeveloperRugHistoryPct:null,maxDeveloperExitPct:null,requireTokenLogo:false,...p});

test('V1.5 settings defaults are disabled and valid values persist',()=>{const d=defaultSettings();assert.equal(d.maxSuspectedRiskyWalletsPct,null);assert.equal(d.maxInsidersPct,null);assert.equal(d.requireDevMigrated,false);assert.equal(d.maxDeveloperRugHistoryPct,null);assert.equal(d.maxDeveloperExitPct,null);assert.equal(d.requireTokenLogo,false);const v=validateSettings({...d,maxSuspectedRiskyWalletsPct:12.5,maxInsidersPct:8,requireDevMigrated:true,maxDeveloperRugHistoryPct:15,maxDeveloperExitPct:20,requireTokenLogo:true});assert.equal(v.ok,true,v.errors?.join('; '));assert.equal(v.settings.maxSuspectedRiskyWalletsPct,12.5);assert.equal(v.settings.requireTokenLogo,true)});
test('invalid V1.5 percentage is rejected',()=>{const v=validateSettings({...defaultSettings(),maxInsidersPct:101});assert.equal(v.ok,false);assert.match(v.errors.join(' '),/maxInsidersPct/)});
test('disabled unknown new metrics do not create V1.5 gates',()=>{const d=evaluate(token({suspectedRiskyWalletsPct:null,insidersPct:null,developerRugHistoryPct:null,developerExitPct:null,devMigrated:null}),cfg());const n=d.settingsEvaluation.gates.map(g=>g.name);assert.equal(n.includes('Suspected risky wallets'),false);assert.equal(n.includes('Insiders'),false);assert.equal(n.includes('Developer migrated'),false)});
test('unknown enabled risky-wallet evidence waits',()=>{const d=evaluate(token({suspectedRiskyWalletsPct:null}),cfg({maxSuspectedRiskyWalletsPct:10}));assert.equal(d.state,'WAITING');assert.equal(d.settingsEvaluation.gates.find(g=>g.name==='Suspected risky wallets')?.status,'WAITING')});
test('known risky-wallet violation blocks',()=>{const d=evaluate(token({suspectedRiskyWalletsPct:12}),cfg({maxSuspectedRiskyWalletsPct:10}));assert.equal(d.state,'BLOCKED')});
test('insiders unknown waits and known violation blocks',()=>{assert.equal(evaluate(token({insidersPct:null}),cfg({maxInsidersPct:10})).state,'WAITING');assert.equal(evaluate(token({insidersPct:11}),cfg({maxInsidersPct:10})).state,'BLOCKED')});
test('developer rug history and exit are explicit evidence gates',()=>{assert.equal(evaluate(token({developerRugHistoryPct:21}),cfg({maxDeveloperRugHistoryPct:20})).state,'BLOCKED');assert.equal(evaluate(token({developerExitPct:null}),cfg({maxDeveloperExitPct:20})).state,'WAITING')});
test('dev migrated unknown waits, false blocks, true passes',()=>{assert.equal(evaluate(token({devMigrated:null}),cfg({requireDevMigrated:true})).state,'WAITING');assert.equal(evaluate(token({devMigrated:false}),cfg({requireDevMigrated:true})).state,'BLOCKED');const d=evaluate(token({devMigrated:true}),cfg({requireDevMigrated:true}));assert.notEqual(d.state,'BLOCKED');assert.equal(d.settingsEvaluation.gates.find(g=>g.name==='Developer migrated')?.status,'PASS')});
test('token logo waits for metadata then missing logo blocks',()=>{assert.equal(evaluate(token({imageUrl:null,metadataResolved:false,metadataReady:false,metadataFetched:false,metadataFetchedAt:null}),cfg({requireTokenLogo:true})).state,'WAITING');assert.equal(evaluate(token({imageUrl:null,metadataResolved:true,metadataReady:true}),cfg({requireTokenLogo:true})).state,'BLOCKED');assert.notEqual(evaluate(token({imageUrl:'https://example.invalid/logo.png',metadataResolved:true}),cfg({requireTokenLogo:true})).state,'BLOCKED')});
test('existing bundle/sniper unknown-enabled behavior stays WAITING',()=>{assert.equal(evaluate(token({bundlePct:null,bundledPct:null,bundlePercentage:null}),cfg({maxBundlePct:10})).state,'WAITING');assert.equal(evaluate(token({sniperPct:null,snipersPct:null,sniperPercentage:null}),cfg({maxSniperPct:10})).state,'WAITING')});
test('Top-10 and Developer remain authoritative',()=>{assert.equal(evaluate(token({top10Pct:30}),cfg({maxTop10Pct:25})).state,'BLOCKED');assert.equal(evaluate(token({developerPct:21}),cfg({maxDeveloperPct:20})).state,'BLOCKED')});
test('V1.5 evaluator block contains no DEX price inputs',()=>{const src=fs.readFileSync(new URL('./evaluate.mjs',import.meta.url),'utf8');const i=src.lastIndexOf('// MEMEFLOW_ANTI_RUG_V1_5_EXACT');assert.ok(i>=0);const b=src.slice(i);assert.doesNotMatch(b,/dexPrice|dexPriceUsd|dexPriceSol|poolPrice|quotePrice/i);assert.match(b,/suspectedRiskyWalletsPct/);assert.match(b,/insidersPct/);assert.match(b,/developerRugHistoryPct/);assert.match(b,/developerExitPct/)});
'''


def self_test() -> None:
    s = "export function defaultSettings(){return {}}\nexport function normalizeSettings(x={}){return x}\nexport function validateSettings(x={}){return {ok:true,errors:[],settings:x}}\n"
    ps = patch_settings(s)
    assert all(k in ps for k in NEW_KEYS)
    e = "export function evaluate(token={},s={}){return {state:'BUY READY',reasons:[],settingsEvaluation:{gates:[]}}}\n"
    pe = patch_evaluate(e)
    assert "function __mfV15BaseEvaluate(" in pe and "export function evaluate(token={},s={})" in pe
    block = pe[pe.rfind("// MEMEFLOW_ANTI_RUG_V1_5_EXACT"):]
    assert not re.search(r"dexPrice|poolPrice|quotePrice", block, re.I)
    h = '''<form id="aiSettingsForm"><div class="setting-field"><label for="maxTop10">Maximum Top 10 · %</label><input id="maxTop10" min="0" max="100" step="0.1" type="number" disabled/></div><div class="setting-field"><label for="maxDeveloper">Maximum developer · %</label><input id="maxDeveloper" min="0" max="100" step="0.1" type="number" disabled/></div><div class="toggle-row"><div class="toggle-copy"><b>Use optional website/X metadata</b><span>Informational enrichment only; it cannot be the sole LIVE execution gate.</span></div><label class="switch"><input id="requireSocial" type="checkbox" disabled/><i></i></label></div></form><script id="ai-trading-settings-js">const ids=['maxTop10','maxDeveloper','requireSocial'];fetch('/api/settings')</script>'''
    ph = patch_html(h)
    assert all(k in ph for k in NEW_KEYS)
    j = "const MF293_GROUPS=[['x','x','x',false,[\n ['maxDeveloperPct','Maximum developer %','nullable',0,100,0.1],\n ['maxSniperPct','Maximum sniper %','nullable',0,100,0.1],\n]]];fetch('/api/settings');"
    pj = patch_mf293(j)
    assert all(k in pj for k in NEW_KEYS)


def main() -> int:
    self_test()
    if "--self-test" in sys.argv:
        log("Installer transformer self-test: PASS")
        return 0
    log("Installer transformer self-test: PASS")
    root = root_dir()
    log(f"Project root: {root}")
    run(["git", "rev-parse", "--is-inside-work-tree"], root, capture=True)
    head = run(["git", "rev-parse", "HEAD"], root, capture=True).stdout.strip()
    if head != EXPECTED_HEAD:
        raise RuntimeError(f"Built only for exact baseline {EXPECTED_HEAD}; current HEAD is {head}. Nothing changed.")
    log(f"Exact HEAD verified: {head}")

    settings = root / "src/settings.mjs"
    evaluate = root / "src/evaluate.mjs"
    store = root / "src/store.mjs"
    for p in (settings, evaluate, store):
        if not p.is_file():
            raise RuntimeError(f"Missing required file: {p.relative_to(root)}")
    es = evaluate.read_text(encoding="utf-8")
    ss = store.read_text(encoding="utf-8")
    if "MEMEFLOW_ANTI_RUG_V1_4_2_EXACT" not in es:
        raise RuntimeError("V1.4.2 evaluator marker missing; refusing unknown runtime")
    if "rugRiskVersion:'V1.4.2'" not in ss:
        raise RuntimeError("V1.4.2 store latch marker missing; refusing unknown runtime")
    if PATCH_ID in es or PATCH_ID in settings.read_text(encoding="utf-8"):
        raise RuntimeError("V1.5 appears already installed. Nothing changed.")

    ui = discover_ui(root)
    for p, kind in ui:
        log(f"Settings UI detected: {p.relative_to(root)} [{kind}]")
    touched = [settings, evaluate] + [p for p, _ in ui]
    test_path = root / NEW_TEST
    if test_path.exists():
        raise RuntimeError(f"{NEW_TEST} already exists. Nothing changed.")
    clean_for(root, touched)

    backup = root / f".memeflow-anti-rug-v1.5-backup-{time.strftime('%Y%m%d-%H%M%S')}"
    backup.mkdir(parents=True)
    originals = {}
    def remember(p: Path) -> str:
        t = p.read_text(encoding="utf-8")
        originals[p] = t
        dst = backup / p.relative_to(root)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dst)
        return t

    try:
        st = remember(settings)
        et = remember(evaluate)
        uit = [(p, k, remember(p)) for p, k in ui]
        settings.write_text(patch_settings(st), encoding="utf-8")
        evaluate.write_text(patch_evaluate(et), encoding="utf-8")
        for p, kind, t in uit:
            p.write_text(patch_mf293(t) if kind == "mf293" else patch_html(t), encoding="utf-8")
        test_path.write_text(make_test(), encoding="utf-8")

        run(["node", "--check", "src/settings.mjs"], root)
        run(["node", "--check", "src/evaluate.mjs"], root)
        run(["node", "--check", NEW_TEST], root)
        for p, kind in ui:
            if kind == "mf293":
                run(["node", "--check", str(p.relative_to(root))], root)
        log("Syntax validation: PASS")

        probe = "import{defaultSettings,normalizeSettings,validateSettings}from'./src/settings.mjs';const d=defaultSettings(),n=normalizeSettings({...d,maxInsidersPct:7.5,requireTokenLogo:true}),v=validateSettings({...d,maxInsidersPct:7.5,requireTokenLogo:true});if(d.maxInsidersPct!==null||d.requireTokenLogo!==false||n.maxInsidersPct!==7.5||n.requireTokenLogo!==true||!v.ok||v.settings.maxInsidersPct!==7.5||v.settings.requireTokenLogo!==true)throw Error('V1.5 settings contract failed');"
        run(["node", "--input-type=module", "-e", probe], root)
        log("Settings contract probe: PASS")
        run(["node", "--test", NEW_TEST], root)
        log("V1.5 focused tests: PASS")

        legacy = [
            "src/anti-rug-v1_4_2-exact.test.mjs",
            "src/runtime-truth-v1_4_1-holder-hotfix.test.mjs",
            "src/runtime-truth-v1_4-exact.test.mjs",
            "src/data-integrity-v1_3-exact.test.mjs",
            "src/filter-upgrade.test.mjs",
            "src/unified-decision.test.mjs",
            "src/candidate-visibility-lifecycle.test.mjs",
            "src/paper-fee-reserve.test.mjs",
            "src/openai-policy.test.mjs",
        ]
        existing = [x for x in legacy if (root / x).is_file()]
        if existing:
            run(["node", "--test", *existing, NEW_TEST], root)
            log(f"Regression tests: PASS ({len(existing)} existing suites + V1.5)")
        if (root / "package.json").is_file():
            run(["npm", "test"], root)
            log("npm test: PASS")
        run(["git", "--no-pager", "diff", "--check"], root)
        log("git diff --check: PASS")

        sa = settings.read_text(encoding="utf-8")
        ea = evaluate.read_text(encoding="utf-8")
        for k in NEW_KEYS:
            if k not in sa or k not in ea:
                raise RuntimeError(f"Post-check missing V1.5 key: {k}")
        block = ea[ea.rfind("// MEMEFLOW_ANTI_RUG_V1_5_EXACT"):]
        if re.search(r"dexPrice|dexPriceUsd|dexPriceSol|poolPrice|quotePrice", block, re.I):
            raise RuntimeError("Forbidden DEX-price input found in V1.5 evaluator block")
        for p, _ in ui:
            text = p.read_text(encoding="utf-8")
            for k in NEW_KEYS:
                if k not in text:
                    raise RuntimeError(f"Post-check {p.relative_to(root)} missing UI key {k}")

        log("SUCCESS: MEMEFLOW anti-rug V1.5 installed and validated.")
        log(f"Backup: {backup.relative_to(root)}")
        log("Top-10/Developer unchanged; Bundler/Sniper unknown-enabled stays WAITING.")
        log("New unknown-enabled evidence => WAITING; known violation => BLOCKED.")
        log("Require dev migrated: unknown WAITING / false BLOCKED / true PASS.")
        log("Require token logo: unresolved WAITING / resolved missing BLOCKED.")
        log("No DEX-price/quote/pool-price input is used by V1.5.")
        log("Restart the Replit workflow/app after SUCCESS.")
        return 0
    except Exception as exc:
        log(f"VALIDATION FAILED: {exc}")
        log("Rolling back exact pre-V1.5 files...")
        for p, t in originals.items():
            try:
                p.write_text(t, encoding="utf-8")
            except Exception as e:
                log(f"Rollback warning: {p}: {e}")
        try:
            if test_path.exists():
                test_path.unlink()
        except Exception as e:
            log(f"Rollback warning: {NEW_TEST}: {e}")
        log(f"ROLLBACK COMPLETE. Backup kept at: {backup}")
        raise


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[V1.5] STOP: {exc}", file=sys.stderr)
        raise SystemExit(1)
