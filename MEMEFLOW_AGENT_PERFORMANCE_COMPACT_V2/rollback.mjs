#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const project=process.cwd();
const app=path.join(project,'memeflow-app');
const base=path.join(project,'.memeflow-backups');
if(!fs.existsSync(base)){console.error('No backup directory found.');process.exit(1)}

const dirs=fs.readdirSync(base).filter(x=>x.startsWith('agent-performance-compact-v2-')).sort().reverse();
if(!dirs.length){console.error('No Agent Performance Compact V2 backup found.');process.exit(2)}

const backup=path.join(base,dirs[0]);
fs.copyFileSync(path.join(backup,'agent-performance.html'),path.join(app,'agent-performance.html'));
fs.copyFileSync(path.join(backup,'agent-performance.css'),path.join(app,'agent-performance.css'));
console.log(`Rolled back from ${backup}`);
