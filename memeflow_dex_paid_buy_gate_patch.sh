#!/usr/bin/env bash
set -euo pipefail

PATCH_NAME="MEMEFLOW DEX Paid BUY Gate"
COMMIT_MESSAGE="Enforce DEX Paid gate for new buys"

die() {
  printf '\n[PATCH ERROR] %s\n' "$*" >&2
  exit 1
}

info() {
  printf '[PATCH] %s\n' "$*"
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "Run this script from inside the MEMEFLOW Git repository."
cd "$ROOT"

APP="memeflow-app/app-server.mjs"
SETTINGS="memeflow-app/src/settings.mjs"
LIVEEVAL="memeflow-app/src/liveeval.mjs"

for f in "$APP" "$SETTINGS" "$LIVEEVAL"; do
  [[ -f "$f" ]] || die "Required file not found: $f"
done

BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
[[ -n "$BRANCH" ]] || die "Detached HEAD detected. Switch to the branch you want to patch first."

git remote get-url origin >/dev/null 2>&1 || die "Git remote 'origin' is not configured."

# Never mix this patch with somebody else's staged work.
if ! git diff --cached --quiet; then
  die "There are already staged changes. Commit/unstage them first; this patch refuses to mix commits."
fi

# Locate the already-existing DEX Paid UI logic without assuming a filename.
mapfile -t UI_FILES < <(
  grep -RIl \
    --include='*.js' --include='*.mjs' --include='*.html' \
    'DEX_POOL_FILTER_KEY' memeflow-app 2>/dev/null \
  | while IFS= read -r f; do
      if grep -q 'filteredApiPath' "$f" && grep -q 'dexPoolFilterEnabled' "$f"; then
        printf '%s\n' "$f"
      fi
    done
)

((${#UI_FILES[@]} >= 1)) || die "Could not locate the existing DEX Paid UI toggle (DEX_POOL_FILTER_KEY + filteredApiPath)."
((${#UI_FILES[@]} <= 4)) || die "Found an unexpected number of DEX Paid UI copies (${#UI_FILES[@]}). Refusing an ambiguous patch."

TARGETS=("$APP" "$SETTINGS" "$LIVEEVAL" "${UI_FILES[@]}")

# Logic-only patch: stylesheets are forbidden targets.
for f in "${TARGETS[@]}"; do
  case "$f" in
    *.css|*.scss|*.sass|*.less) die "Stylesheet unexpectedly selected as a patch target: $f" ;;
  esac
done

# Target files must be clean so rollback is deterministic.
for f in "${TARGETS[@]}"; do
  if ! git diff --quiet -- "$f"; then
    die "Target file has uncommitted changes: $f. Commit/stash it first."
  fi
done

if grep -q 'MEMEFLOW_DEX_PAID_BUY_GATE_V1' "$APP"; then
  die "This DEX Paid BUY-gate patch marker is already present. Nothing was changed."
fi

info "$PATCH_NAME"
info "Branch: $BRANCH"
info "UI file(s): ${UI_FILES[*]}"
info "No CSS/SCSS/SASS/LESS files will be modified."

PATCH_STARTED=0
COMMITTED=0

rollback() {
  status=$?
  if [[ "$PATCH_STARTED" == "1" && "$COMMITTED" == "0" ]]; then
    git reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
    git checkout -- "${TARGETS[@]}" >/dev/null 2>&1 || true
    printf '\n[PATCH] Patch failed before commit; target files were restored to HEAD.\n' >&2
  fi
  exit "$status"
}
trap rollback EXIT

PATCH_STARTED=1

python3 - "$ROOT" "${UI_FILES[@]}" <<'PY'
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
ui_files = [root / p for p in sys.argv[2:]]

app_path = root / "memeflow-app/app-server.mjs"
settings_path = root / "memeflow-app/src/settings.mjs"
liveeval_path = root / "memeflow-app/src/liveeval.mjs"

def read(path):
    return path.read_text(encoding="utf-8")

def write(path, text):
    path.write_text(text, encoding="utf-8")

def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"[PATCH ERROR] {label}: expected exactly 1 match, found {n}")
    return text.replace(old, new, 1)

# 1) Canonical server-side DEX Paid setting. Default stays OFF.
settings = read(settings_path)

settings = replace_once(
    settings,
    "'adaptiveProfile','shadowValidation','changeLog','exitOnWeakBuyPressure'",
    "'adaptiveProfile','shadowValidation','changeLog','exitOnWeakBuyPressure','requireDexPaid'",
    "settings boolean registry"
)

settings = replace_once(
    settings,
    "minScore:72,minConfidence:70,minLiquidityUsd:0,minBuyPressure:1.2,requireFreshHolderSnapshot:true,requireWebsiteOrX:false,",
    "minScore:72,minConfidence:70,minLiquidityUsd:0,minBuyPressure:1.2,requireFreshHolderSnapshot:true,requireWebsiteOrX:false,requireDexPaid:false,",
    "default requireDexPaid"
)

write(settings_path, settings)

# 2) Live evaluation must await the execution admission gate.
liveeval = read(liveeval_path)
liveeval = replace_once(
    liveeval,
    "if(onDecision)onDecision(u.id,t,d,s);",
    "if(onDecision)await onDecision(u.id,t,d,s);",
    "liveeval onDecision await"
)
write(liveeval_path, liveeval)

# 3) Server BUY gate, canonical toggle sync, and Assist approval protection.
app = read(app_path)

if "MEMEFLOW_DEX_PAID_BUY_GATE_V1" in app:
    raise SystemExit("[PATCH ERROR] DEX Paid BUY-gate marker already exists.")

helper = r'''
// MEMEFLOW_DEX_PAID_BUY_GATE_V1
// Entry-only gate. DEX Paid is a binary admission rule, never an AI score/weight.
// Existing positions and every SELL/exit path stay independent from this gate.
async function mfPaperOnDecisionWithDexPaid(uid,token,decision,settings){
  const required=store.settings(uid)?.requireDexPaid===true;
  if(required&&decision?.state==='BUY READY'){
    const mint=String(token?.mint||decision?.mint||'').trim();
    const dexPaid=await mfDexPaidCheck(mint);
    if(!(dexPaid?.checked===true&&dexPaid?.hasPaid===true)){
      console.info('[DEX_PAID_BUY_GATE]',JSON.stringify({
        uid,
        mint:mint||null,
        state:decision?.state||null,
        checked:dexPaid?.checked===true,
        hasPaid:dexPaid?.hasPaid===true,
        reason:dexPaid?.reason||'unknown',
        source:'decision'
      }));
      return {action:'BLOCKED',reason:'DEX_PAID_REQUIRED',dexPaid};
    }
  }
  return paper.onDecision(uid,token,decision,settings);
}

'''

anchor = "async function mfDexFilterRowsByPaid"
if app.count(anchor) != 1:
    raise SystemExit(
        f"[PATCH ERROR] DEX filter anchor: expected exactly 1 match, found {app.count(anchor)}"
    )
app = app.replace(anchor, helper + anchor, 1)

callback_re = re.compile(
    r'''onDecision:\(uid,token,decision\)=>\{\s*
        try\{paper\.onDecision\(uid,token,decision,store\.settings\(uid\)\)\}\s*
        catch\(e\)\{console\.error\('paper engine',e\)\}\s*
      \},''',
    re.X
)
app, n = callback_re.subn(
    '''onDecision:async(uid,token,decision)=>{
    try{return await mfPaperOnDecisionWithDexPaid(uid,token,decision,store.settings(uid))}
    catch(e){console.error('paper engine',e)}
  },''',
    app,
    count=1
)
if n != 1:
    raise SystemExit(
        f"[PATCH ERROR] live server onDecision callback: expected exactly 1 match, found {n}"
    )

app = replace_once(
    app,
    "function reevaluateUser(uid){",
    "async function reevaluateUser(uid){",
    "reevaluateUser async"
)

app = replace_once(
    app,
    "try{paper.onDecision(uid,t,d,s)}catch(e){console.error('paper engine',e)}",
    "try{await mfPaperOnDecisionWithDexPaid(uid,t,d,s)}catch(e){console.error('paper engine',e)}",
    "reevaluateUser execution gate"
)

reeval_old = "const decisionsReevaluated=reevaluateUser(u.id);"
reeval_count = app.count(reeval_old)
if reeval_count != 2:
    raise SystemExit(
        f"[PATCH ERROR] settings reevaluation awaits: expected 2 matches, found {reeval_count}"
    )
app = app.replace(reeval_old, "const decisionsReevaluated=await reevaluateUser(u.id);")

# An older settings UI may not know the new key. Preserve the current canonical
# value instead of accidentally switching DEX Paid off on an unrelated save.
app = replace_once(
    app,
    "const b=await body(req);const checked=validateSettings(b.settings||{});",
    "const b=await body(req);const incomingSettings={...(b.settings||{})};if(!Object.prototype.hasOwnProperty.call(incomingSettings,'requireDexPaid'))incomingSettings.requireDexPaid=store.settings(u.id)?.requireDexPaid===true;const checked=validateSettings(incomingSettings);",
    "settings PUT compatibility"
)

candidate_open = '''if(url.pathname==='/api/ai/decisions'){
  const _off='''
candidate_new = '''if(url.pathname==='/api/ai/decisions'){
  // The existing UI sends dexPool explicitly on every candidate request.
  // Mirror it into canonical server settings so display filtering and BUY
  // execution use exactly the same switch.
  const explicitDexPool=url.searchParams.get('dexPool');
  if(explicitDexPool==='1'||explicitDexPool==='0'){
    const desiredDexPaid=explicitDexPool==='1';
    const currentDexSettings=store.settings(u.id);
    if(currentDexSettings.requireDexPaid!==desiredDexPaid){
      const beforeDexSettings=JSON.parse(JSON.stringify(currentDexSettings));
      const savedDexSettings=store.setSettings(
        u.id,{...currentDexSettings,requireDexPaid:desiredDexPaid}
      );
      if(savedDexSettings.changeLog!==false)store.recordSettingsChange(
        u.id,beforeDexSettings,savedDexSettings,
        {actor:u.id,source:'dex_paid_toggle'}
      );
      console.info('[DEX_PAID_SETTING]',JSON.stringify({
        uid:u.id,
        enabled:desiredDexPaid,
        source:'candidate_request'
      }));
    }
  }
  const _off='''
app = replace_once(app, candidate_open, candidate_new, "candidate route toggle sync")

app = replace_once(
    app,
    "const discoveryScope=dexViewRequested(req.url);",
    "const discoveryScope=store.settings(u.id)?.requireDexPaid===true||(explicitDexPool===null&&dexViewRequested(req.url));",
    "candidate canonical DEX visibility"
)

proposal_re = re.compile(
    r'''if\(url\.pathname\.startsWith\('/api/paper/proposals/'\)&&url\.pathname\.endsWith\('/approve'\)&&req\.method==='POST'\)\{
        const\ parts=url\.pathname\.split\('/'\),id=parts\[parts\.length-2\];
        const\ r=paper\.approveProposal\(u\.id,id\);
        if\(!r\.ok\)return\ json\(res,409,\{error:r\.code\}\);
        return\ json\(res,200,r\)
      \}''',
    re.X
)
proposal_new = '''if(url.pathname.startsWith('/api/paper/proposals/')&&url.pathname.endsWith('/approve')&&req.method==='POST'){
  const parts=url.pathname.split('/'),id=parts[parts.length-2];
  const proposal=store.state.paperProposals?.[id];
  if(proposal?.userId===u.id&&proposal?.status==='PENDING'&&store.settings(u.id)?.requireDexPaid===true){
    const dexPaid=await mfDexPaidCheck(String(proposal.mint||''));
    if(!(dexPaid?.checked===true&&dexPaid?.hasPaid===true)){
      console.info('[DEX_PAID_BUY_GATE]',JSON.stringify({
        uid:u.id,
        mint:String(proposal.mint||'')||null,
        checked:dexPaid?.checked===true,
        hasPaid:dexPaid?.hasPaid===true,
        reason:dexPaid?.reason||'unknown',
        source:'assist_approve'
      }));
      return json(res,409,{error:'DEX_PAID_REQUIRED',dexPaid});
    }
  }
  const r=paper.approveProposal(u.id,id);
  if(!r.ok)return json(res,409,{error:r.code});
  return json(res,200,r)
 }'''
app, n = proposal_re.subn(proposal_new, app, count=1)
if n != 1:
    raise SystemExit(
        f"[PATCH ERROR] assist proposal approval route: expected exactly 1 match, found {n}"
    )

write(app_path, app)

# 4) Existing UI switch always sends explicit 1/0.
# This changes request logic only; it does not add or alter CSS.
new_ui_function = '''function filteredApiPath(path){
  const sep=path.includes('?')?'&':'?';
  return `${path}${sep}dexPool=${dexPoolFilterEnabled?'1':'0'}`;
}'''

for path in ui_files:
    text = read(path)
    if new_ui_function in text:
        continue

    pat = re.compile(
        r"function\s+filteredApiPath\s*\(\s*path\s*\)\s*\{[^{}]{0,1200}\}",
        re.S
    )
    matches = list(pat.finditer(text))
    if len(matches) != 1:
        raise SystemExit(
            f"[PATCH ERROR] {path.relative_to(root)} filteredApiPath: "
            f"expected exactly 1 simple function, found {len(matches)}"
        )
    m = matches[0]
    text = text[:m.start()] + new_ui_function + text[m.end():]
    write(path, text)

print("[PATCH] Source transformations completed.")
PY

info "Running syntax and whitespace checks..."
node --check "$APP"
node --check "$SETTINGS"
node --check "$LIVEEVAL"

for f in "${UI_FILES[@]}"; do
  case "$f" in
    *.js|*.mjs) node --check "$f" ;;
  esac
done

git diff --check

mapfile -t CHANGED < <(git diff --name-only)
((${#CHANGED[@]} >= 4)) || die "Unexpectedly few files changed (${#CHANGED[@]})."

for f in "${CHANGED[@]}"; do
  allowed=0
  for t in "${TARGETS[@]}"; do
    [[ "$f" == "$t" ]] && allowed=1 && break
  done
  [[ "$allowed" == "1" ]] || die "Unexpected file changed by patch: $f"
  case "$f" in
    *.css|*.scss|*.sass|*.less) die "Style file changed unexpectedly: $f" ;;
  esac
done

grep -q "requireDexPaid" "$SETTINGS" || die "Canonical requireDexPaid setting missing."
grep -q "MEMEFLOW_DEX_PAID_BUY_GATE_V1" "$APP" || die "BUY-gate marker missing."
grep -q "source:'assist_approve'" "$APP" || die "Assist approval gate missing."

for f in "${UI_FILES[@]}"; do
  grep -q "dexPool=.*dexPoolFilterEnabled" "$f" || die "Explicit DEX toggle transmission missing in $f"
done

info "Changed files:"
git diff --name-only | sed 's/^/  - /'

info "Diff summary:"
git diff --stat

git add -- "${TARGETS[@]}"

mapfile -t STAGED < <(git diff --cached --name-only)
for f in "${STAGED[@]}"; do
  case "$f" in
    *.css|*.scss|*.sass|*.less)
      git reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
      die "A stylesheet entered the staged patch unexpectedly: $f"
      ;;
  esac
  allowed=0
  for t in "${TARGETS[@]}"; do
    [[ "$f" == "$t" ]] && allowed=1 && break
  done
  [[ "$allowed" == "1" ]] || die "Unexpected staged file: $f"
done

git diff --cached --check

info "Creating commit..."
git commit -m "$COMMIT_MESSAGE"
COMMITTED=1

SHA="$(git rev-parse HEAD)"
info "Commit created: $SHA"

info "Pushing to origin/$BRANCH ..."
if ! git push origin "HEAD:$BRANCH"; then
  printf '\n[PATCH ERROR] Code was committed locally, but push failed.\n' >&2
  printf '[PATCH ERROR] Local commit: %s\n' "$SHA" >&2
  printf '[PATCH ERROR] Fix Git authentication/network and run:\n' >&2
  printf '  git push origin HEAD:%s\n' "$BRANCH" >&2
  exit 1
fi

trap - EXIT

printf '\n[PATCH OK] DEX Paid BUY gate installed and pushed.\n'
printf '[PATCH OK] Commit: %s\n' "$SHA"
printf '[PATCH OK] Branch: %s\n' "$BRANCH"
printf '[PATCH OK] No stylesheet files were modified.\n'
