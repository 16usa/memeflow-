import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(root, 'index.html');
const scriptTag = '<script src="/navigation-fix.js" defer></script>';

let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('/navigation-fix.js')) {
  if (!html.includes('</body>')) {
    throw new Error('index.html does not contain </body>');
  }

  html = html.replace('</body>', `${scriptTag}\n</body>`);
  fs.writeFileSync(indexPath, html);
  console.log('Navigation fix injected into index.html');
}

await import('./app-server.mjs');
