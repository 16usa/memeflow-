import fs from 'node:fs';
import path from 'node:path';

const MODES = new Set(['pump', 'dex', 'hybrid']);

function normalizeMode(value, fallback='dex') {
  const v = String(value || '').trim().toLowerCase();
  return MODES.has(v) ? v : fallback;
}

export class DiscoverySourceController {
  constructor({dataDir, defaultMode='dex'}={}) {
    if (!dataDir) throw new Error('DiscoverySourceController requires dataDir');
    this.file = path.join(dataDir, 'discovery-source.json');
    this.state = {mode:normalizeMode(defaultMode, 'dex'),updatedAt:Date.now(),version:1};
    this.load();
  }
  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.state = {mode:normalizeMode(raw?.mode, this.state.mode),updatedAt:Number(raw?.updatedAt)||Date.now(),version:1};
      return;
    } catch {}
    this.persist();
  }
  persist() {
    fs.mkdirSync(path.dirname(this.file), {recursive:true});
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }
  get mode() { return this.state.mode; }
  allows(source) {
    const s = String(source || '').trim().toLowerCase();
    return this.state.mode === 'hybrid' || this.state.mode === s;
  }
  set(mode) {
    const next = normalizeMode(mode, '');
    if (!next) {
      const e = new Error('mode must be pump, dex or hybrid');
      e.code = 'INVALID_DISCOVERY_SOURCE';
      throw e;
    }
    this.state = {mode:next,updatedAt:Date.now(),version:1};
    this.persist();
    return this.snapshot();
  }
  snapshot() {
    const dexEnabled=this.state.mode==='dex'||this.state.mode==='hybrid';
    return {mode:this.state.mode,available:['pump','dex','hybrid'],pumpEnabled:true,dexEnabled,strategy:'pump-origin+dex-verification',updatedAt:this.state.updatedAt,version:this.state.version};
  }
}
