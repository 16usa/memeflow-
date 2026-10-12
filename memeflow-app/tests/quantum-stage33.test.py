import importlib.util, json, pathlib, sqlite3, tempfile, unittest
src=pathlib.Path(__file__).resolve().parents[1]/'scripts/quantum-stage33-followup.py'
spec=importlib.util.spec_from_file_location('stage33',src);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NOW=1_800_000_000_000;MINT='A'*40
class TestStage33(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.data=pathlib.Path(self.tmp.name);(self.data/'quantum-archive').mkdir()
  con=sqlite3.connect(self.data/'token-registry-v1.sqlite');con.execute('CREATE TABLE tokens(mint TEXT PRIMARY KEY,token_json TEXT)');con.execute('INSERT INTO tokens VALUES (?,?)',(MINT,json.dumps({'priceSol':2.0,'lastPriceAt':NOW-1000})));con.commit();con.close()
  e={'mint':MINT,'at':NOW-6*60000,'priceSol':1.0,'stage29ShadowDecision':{'state':'WATCH'}}
  (self.data/'quantum-stage24-decisions.ndjson').write_text(json.dumps(e)+'\n')
 def tearDown(self):self.tmp.cleanup()
 def test_run_and_dedup(self):
  a=m.run(self.data,NOW);b=m.run(self.data,NOW)
  self.assertEqual(a['activeDecisionKeys'],1);self.assertEqual(a['newSnapshots'],1);self.assertEqual(b['newSnapshots'],0)
  self.assertEqual(len((self.data/'quantum-stage33/price-snapshots.ndjson').read_text().splitlines()),1)
  self.assertEqual(json.loads((self.data/'quantum-stage33/targets.json').read_text())[0]['horizonsDue'],[5])
 def test_no_future_or_invalid_prices(self):
  self.assertFalse(m.valid_price(1,NOW+61000,NOW));self.assertFalse(m.valid_price(-1,NOW,NOW));self.assertFalse(m.valid_price(None,NOW,NOW))
 def test_read_only_registry(self):
  m.run(self.data,NOW);con=sqlite3.connect(self.data/'token-registry-v1.sqlite');self.assertEqual(con.execute('SELECT COUNT(*) FROM tokens').fetchone()[0],1);con.close()
 def test_old_decision_excluded(self):
  a=m.run(self.data,NOW+63*60000);self.assertEqual(a['activeDecisionKeys'],0)
 def test_missing_db(self):
  (self.data/'token-registry-v1.sqlite').unlink();a=m.run(self.data,NOW);self.assertEqual(a['databaseError'],'DB_MISSING')
if __name__=='__main__':unittest.main()
