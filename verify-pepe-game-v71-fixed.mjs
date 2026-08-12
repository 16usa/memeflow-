import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = '/home/runner/workspace';
const app = path.join(root, 'memeflow-app');
const pkg = path.join(root, 'pepe-game-v7.1');
const expected = {"game.html": "a4587438b2cf58738fb82f9383d2f9f7171b1c858d126cc05c2bb5728fa16b76", "game.css": "11a94aed0125a5a8e7b1f38ac74eb57251c25a8887658d80bb3acad3c378245d", "game.js": "5c7e2f1f8a04b038b97e0c489f5e172124d06b21db300a5d5ee6af294b2e40e6"};

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let checks = 0;
const pass = (name, ok) => {
  if (!ok) throw new Error('FAIL ' + name);
  checks++;
  console.log('PASS', name);
};

for (const [file, hash] of Object.entries(expected)) {
  const p = path.join(app, file);
  pass(`V7.1 hash ${file}`, fs.existsSync(p) && sha(p) === hash);
}

const html = fs.readFileSync(path.join(app, 'game.html'), 'utf8');
const css = fs.readFileSync(path.join(app, 'game.css'), 'utf8');
const js = fs.readFileSync(path.join(app, 'game.js'), 'utf8');

pass('V7.1 cache bust', html.includes('/game.css?v=71') && html.includes('/game.js?v=71'));
pass('no visualViewport jitter code', !js.includes('visualViewport'));
pass('CSS braces balanced', (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length);
pass('no literal escaped newline bug', !css.includes('\\n'));

const jsCheck = spawnSync(process.execPath, ['--check', path.join(app, 'game.js')], { encoding: 'utf8' });
pass('JS syntax', jsCheck.status === 0);

const smoke = path.join(pkg, 'runtime-smoke-v71.cjs');
if (fs.existsSync(smoke)) {
  const r = spawnSync(process.execPath, [smoke, app], { stdio: 'inherit' });
  pass('runtime smoke', r.status === 0);
} else {
  console.log('SKIP runtime smoke helper not found');
}

const engine = path.join(app, 'src', 'game-engine.mjs');
const server = path.join(app, 'app-server.mjs');
const index = path.join(app, 'index.html');

pass('protected src/game-engine.mjs exists', fs.existsSync(engine));
pass('protected app-server.mjs exists', fs.existsSync(server));
pass('protected index.html exists', fs.existsSync(index));

const engineCheck = spawnSync(process.execPath, ['--check', engine], { encoding: 'utf8' });
pass('protected src/game-engine.mjs syntax', engineCheck.status === 0);

const serverCheck = spawnSync(process.execPath, ['--check', server], { encoding: 'utf8' });
pass('protected app-server.mjs syntax', serverCheck.status === 0);

const payloadDir = path.join(pkg, 'payload');
if (fs.existsSync(payloadDir)) {
  const files = fs.readdirSync(payloadDir).sort();
  pass('V7.1 payload contains visual files only', files.join(',') === 'game.css,game.html,game.js');
}

pass('no BUY/SELL endpoint added by Game client', !/\/api\/(?:buy|sell)\b/i.test(js));
pass('no settings mutation endpoint added by Game client', !/\/api\/settings/i.test(js));

console.log(`PEPE GAME V7.1 VERIFY FIXED: PASS (${checks} checks)`);
