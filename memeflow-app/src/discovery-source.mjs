import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_PUMP_ONLY_DISCOVERY_SOURCE_V8
// Discovery is Pump-only. Legacy alternate discovery modes were removed.
export class DiscoverySourceController {
  constructor({dataDir}={}) {
    if (!dataDir) throw new Error('DiscoverySourceController requires dataDir');
    this.file = path.join(dataDir, 'discovery-source.json');
    this.state = {mode:'pump',updatedAt:Date.now(),version:2};
    this.load();
  }

  load() {
    // Legacy files may contain an old mode. Ignore it and normalize to Pump.
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.state = {
        mode:'pump',
        updatedAt:Number(raw?.updatedAt)||Date.now(),
        version:2
      };
    } catch {
      this.state = {mode:'pump',updatedAt:Date.now(),version:2};
    }
    this.persist();
  }

  persist() {
    fs.mkdirSync(path.dirname(this.file), {recursive:true});
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  get mode() {
    return 'pump';
  }

  allows(source) {
    return String(source || '').trim().toLowerCase() === 'pump';
  }

  set(mode) {
    const requested = String(mode || '').trim().toLowerCase();
    if (requested !== 'pump') {
      const e = new Error('Only pump discovery is supported');
      e.code = 'INVALID_DISCOVERY_SOURCE';
      throw e;
    }
    this.state = {mode:'pump',updatedAt:Date.now(),version:2};
    this.persist();
    return this.snapshot();
  }

  snapshot() {
    return {
      mode:'pump',
      available:['pump'],
      pumpEnabled:true,
      strategy:'pump-native-live-index',
      updatedAt:this.state.updatedAt,
      version:this.state.version
    };
  }
}
