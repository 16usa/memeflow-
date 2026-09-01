// MEMEFLOW_HOLDER_ACTIVE_USER_CONTEXT_V70
//
// Build once per holder scheduling tick. Settings objects are read once for
// each active user and then reused by every token's stable-admission check.

export function buildHolderActiveUserContextV70({
  uids=[],
  getSettings=()=>({})
}={}){
  const source=Array.isArray(uids)?uids:[];
  const rows=[];

  for(const uid of source){
    rows.push({
      uid,
      settings:getSettings(uid)||{}
    });
  }

  return rows;
}
