#!/usr/bin/env python3
"""Independent, read-only SQLite follow-up sampler. No RPC, no trades."""
import argparse, datetime, json, os, pathlib, sqlite3, time

HORIZONS=(5,15,30,60)

def valid_price(p,t,now):
    try:
        p=float(p); t=int(t)
        return p>0 and 0<t<=now+60_000
    except (ValueError,TypeError,OverflowError): return False

def journal_files(data):
    archive=data/'quantum-archive'
    files=[]
    if archive.exists():
        files=[p for p in archive.glob('*.ndjson') if p.name=='stage24-before-stage28.ndjson' or p.name.startswith('stage24-rotated-')]
    return sorted(files)+[data/'quantum-stage24-decisions.ndjson']

def load_targets(data,now,limit=400):
    """Track first stage29 decision per mint/state, including removed scanner cards."""
    targets={}
    for f in journal_files(data):
        if not f.exists(): continue
        with f.open(errors='replace') as stream:
            for line in stream:
                try: e=json.loads(line)
                except ValueError: continue
                state=(e.get('stage29ShadowDecision') or {}).get('state')
                mint=e.get('mint'); at=e.get('at'); price=e.get('priceSol')
                if state not in ('CANDIDATE','WATCH','WAITING','BLOCKED') or not isinstance(mint,str) or not 20<=len(mint)<=64 or not isinstance(at,(int,float)) or not valid_price(price,at,now): continue
                key=(mint,state)
                if key not in targets or at<targets[key]['decisionAt']:
                    targets[key]={'mint':mint,'state':state,'decisionAt':int(at),'entryPriceSol':float(price)}
    # Old decisions have already missed follow-up windows; keep recent cohort only.
    active=[v for v in targets.values() if 0<=now-v['decisionAt']<=62*60_000]
    return sorted(active,key=lambda v:v['decisionAt'])[:limit],len(targets)

def query_prices(db,mints,now):
    if not db.exists(): return {},'DB_MISSING'
    try:
        con=sqlite3.connect('file:'+str(db.resolve())+'?mode=ro',uri=True,timeout=3)
        con.execute('PRAGMA query_only=ON')
        found={}
        try:
            for mint in mints:
                row=con.execute('SELECT token_json FROM tokens WHERE mint=? LIMIT 1',(mint,)).fetchone()
                if not row:continue
                try:
                    obj=json.loads(row[0]); p=obj.get('priceSol'); at=obj.get('lastPriceAt')
                    if valid_price(p,at,now):found[mint]={'mint':mint,'priceSol':float(p),'priceAt':int(at),'source':'STAGE33_SQLITE_REGISTRY'}
                except (TypeError,ValueError):continue
        finally:con.close()
        return found,None
    except sqlite3.Error as exc:return {},type(exc).__name__

def run(data,now=None,limit=400):
    now=int(time.time()*1000) if now is None else now
    targets,total=load_targets(data,now,limit)
    mints=list(dict.fromkeys(t['mint'] for t in targets))
    found,error=query_prices(data/'token-registry-v1.sqlite',mints,now)
    out=data/'quantum-stage33';out.mkdir(parents=True,exist_ok=True)
    dest=out/'price-snapshots.ndjson'
    # Source timestamp, never polling time. Dedup persists across invocations.
    seen=set()
    if dest.exists():
        with dest.open() as f:
            for line in f:
                try:
                    r=json.loads(line);seen.add((r.get('mint'),r.get('priceAt')))
                except ValueError:pass
    added=0
    with dest.open('a') as f:
        for r in found.values():
            key=(r['mint'],r['priceAt'])
            if key in seen:continue
            f.write(json.dumps(r,separators=(',',':'))+'\n');added+=1;seen.add(key)
    # Status distinguishes registry absent, stale price, and fresh observation.
    status=[]
    for t in targets:
        r=found.get(t['mint'])
        status.append({**t,'priceAvailable':bool(r),'lastPriceAt':r['priceAt'] if r else None,
                       'horizonsDue':[h for h in HORIZONS if now>=t['decisionAt']+h*60000]})
    summary={'mode':'SHADOW_READ_ONLY','tradeAuthority':False,'externalPriceFetch':False,
             'now':now,'totalDecisionKeys':total,'activeDecisionKeys':len(targets),
             'queriedMints':len(mints),'availableMints':len(found),'unavailableMints':len(mints)-len(found),
             'newSnapshots':added,'databaseError':error,
             'limitation':'Registry retains only latest source price; no historical reconstruction or guarantee of price after scanner removal.'}
    (out/'report.json').write_text(json.dumps(summary,indent=2))
    (out/'targets.json').write_text(json.dumps(status,indent=2))
    return summary

def main():
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['once','watch'],nargs='?',default='once');parser.add_argument('--interval',type=int,default=60);parser.add_argument('--limit',type=int,default=400);args=parser.parse_args()
    if args.interval<30 or not 1<=args.limit<=1000:parser.error('interval >=30 and limit 1..1000 required')
    data=pathlib.Path(__file__).resolve().parents[1]/'data'
    while True:
        print(json.dumps(run(data,limit=args.limit)),flush=True)
        if args.mode=='once':break
        time.sleep(args.interval)
if __name__=='__main__':main()
