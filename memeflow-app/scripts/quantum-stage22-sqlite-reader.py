#!/usr/bin/env python3
"""Bounded indexed SQLite sampler; no schema changes or full scans."""
import json, sqlite3, sys
from pathlib import Path

def read(db, limit):
    if not Path(db).is_file(): raise FileNotFoundError('Registry database not found')
    uri = Path(db).resolve().as_uri() + '?mode=ro'
    con = sqlite3.connect(uri, uri=True, timeout=1)
    try:
        con.execute('PRAGMA query_only=ON')
        con.execute('PRAGMA busy_timeout=1000')
        # (ws_first, updated_at) index: equality on first column makes the
        # second column ordered. Explicit INDEXED BY prevents accidental scans.
        indexes = {r[1] for r in con.execute("PRAGMA index_list('tokens')")}
        if 'idx_tokens_ws_hot' not in indexes:
            raise RuntimeError('Required idx_tokens_ws_hot index missing; refusing full scan')
        cols = [r[2] for r in con.execute("PRAGMA index_info('idx_tokens_ws_hot')")]
        if cols != ['ws_first', 'updated_at']:
            raise RuntimeError('Unexpected idx_tokens_ws_hot columns; refusing full scan')
        rows = con.execute('''SELECT mint, token_json FROM tokens INDEXED BY idx_tokens_ws_hot
                              WHERE ws_first = 1 ORDER BY updated_at DESC LIMIT ?''', (limit,)).fetchall()
        out=[]; latest=None; fields=False
        for mint,raw in rows:
            try: t=json.loads(raw)
            except (TypeError, ValueError): continue
            if not isinstance(t,dict): continue
            fields=fields or ('priceSol' in t and 'lastPriceAt' in t)
            stamp=t.get('lastPriceAt')
            if isinstance(stamp,(float,int)) and (latest is None or stamp>latest): latest=stamp
            out.append({'mint':mint,'priceSol':t.get('priceSol'),'lastPriceAt':stamp})
        return {'tokens':out,'latestPriceAt':latest,'priceFieldsPresent':fields,
                'selection':'ws_first=1 ORDER BY updated_at DESC (idx_tokens_ws_hot)'}
    finally: con.close()
if __name__=='__main__':
    try:
        limit=int(sys.argv[2]); assert 1<=limit<=1000
        print(json.dumps(read(sys.argv[1],limit)))
    except Exception as e:
        print('Registry read error: '+str(e),file=sys.stderr); sys.exit(1)
