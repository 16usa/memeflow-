#!/usr/bin/env python3
"""Read-only exact-mint token-registry price lookup. No schema changes."""
import json, sqlite3, sys, os

def main():
    db, limit = sys.argv[1], int(sys.argv[2])
    mints=json.load(sys.stdin)
    if not isinstance(mints,list): raise ValueError('expected mints array')
    mints=list(dict.fromkeys(x for x in mints if isinstance(x,str) and 20<=len(x)<=64))[:limit]
    if not os.path.isfile(db):
        print(json.dumps({'rows':[],'error':'DB_MISSING'}));return
    uri='file:'+os.path.abspath(db)+'?mode=ro'
    con=sqlite3.connect(uri,uri=True,timeout=2)
    try:
        con.execute('PRAGMA query_only=ON')
        rows=[]
        for mint in mints:
            item=con.execute('SELECT token_json FROM tokens WHERE mint=? LIMIT 1',(mint,)).fetchone()
            if not item:continue
            try: obj=json.loads(item[0]); price=float(obj.get('priceSol') or 0);at=int(obj.get('lastPriceAt') or 0)
            except (ValueError,TypeError,KeyError):continue
            if price>0 and at>0:rows.append({'mint':mint,'priceSol':price,'priceAt':at})
        print(json.dumps({'rows':rows,'queried':len(mints)}))
    finally:con.close()
if __name__=='__main__':main()
