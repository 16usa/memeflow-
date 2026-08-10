#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const candidates = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
];

const target = candidates.find(p => fs.existsSync(p));
if (!target) {
  console.error('VERIFY V25: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const html = fs.readFileSync(target, 'utf8');
const results = [];

const add = (name, ok) => results.push([name, !!ok]);

add('runtime exists', fs.existsSync(path.join(appDir, 'ai-final-ui-v25.js')));
add('config exists', fs.existsSync(path.join(appDir, 'ai-final-ui-v25-config.js')));
add('one runtime tag', (html.match(/ai-final-ui-v25\.js\?v=25\.0\.0/g) || []).length === 1);
add('one config tag', (html.match(/ai-final-ui-v25-config\.js\?v=25\.0\.0/g) || []).length === 1);
add('legacy Manual AI id absent', !/id=["']mfManualAiButton["']/i.test(html));
add('mobile AI present', /id=["']mf-ai-mobile-v25["']/i.test(html));
add('desktop sidebar AI present when sidebar exists',
  !/<aside\b[^>]*class=["'][^"']*\bsidebar\b/i.test(html) ||
  /<aside\b[^>]*class=["'][^"']*\bsidebar\b[\s\S]*id=["']mf-ai-desktop-v25["']/i.test(html)
);
add('Wallet absent from compact nav',
  !/<nav\b[^>]*class=["'][^"']*\bmobile-nav\b[^"']*["'][^>]*>[\s\S]*?data-sheet=["']wallet["'][\s\S]*?<\/nav>/i.test(html)
);
add('nav order correct',
  /data-sheet=["']home["'][\s\S]*data-sheet=["']candidates["'][\s\S]*id=["']mf-ai-mobile-v25["'][\s\S]*data-sheet=["']positions["'][\s\S]*data-sheet=["']more["']/i.test(html)
);

const oldTag = /<script\b[^>]*src=["']\.\/(?:ai-bottom-nav-patch|ai-manual-scan-sheet-patch|ai-manual-scan-v\d+|ai-sheet-v\d+|ai-safe-sheet-v\d+|ai-native-sheet-v\d+|ai-final-native-v\d+|ai-direct-evaluator-v\d+(?:-config)?|ai-final-ui-v(?:[0-9]|1[0-9]|2[0-4])(?:-config)?)\.js/i;
add('obsolete patch tags absent', !oldTag.test(html));

console.log('=== MEMEFLOW FINAL UI V25 VERIFY ===');
for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);

const failed = results.filter(([,ok]) => !ok);
if (failed.length) {
  console.error(`VERIFY V25 FAILED: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`VERIFY V25 OK: ${results.length}/${results.length} checks passed.`);
