import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,normalizeSettings} from './settings.mjs';
import {evaluate} from './evaluate.mjs';

const complete=(patch={})=>({
  mint:'Mint111',
  name:'Token',
  symbol:'TOK',
  holderCount:50,
  holderFresh:true,
  priceSol:1,
  dataQuality:1,
  buyPressure:2,
  top10Pct:20,
  developerPct:10,
  source:'Pump create',
  launchPlatform:'pump',
  discoveredAt:Date.now(),
  metadataResolved:true,
  ...patch
});

test('fresh incomplete token waits instead of being blocked by synthetic low score',()=>{
  const d=evaluate({
    mint:'Fresh111',
    name:'Fresh',
    symbol:'F',
    uri:'https://example.invalid/meta.json',
    source:'Pump create',
    launchPlatform:'pump',
    discoveredAt:Date.now(),
    holderFresh:false
  },defaultSettings());
  assert.equal(d.state,'WAITING');
  assert.equal(d.settingsEvaluation.gates.find(g=>g.name==='Minimum AI score')?.status,'WAITING');
  assert.equal(d.settingsEvaluation.gates.find(g=>g.name==='Minimum data confidence')?.status,'WAITING');
});

test('known hard fail remains BLOCKED even while other evidence is pending',()=>{
  const d=evaluate({
    mint:'Bad111',
    holderCount:2,
    holderFresh:false,
    source:'Pump create',
    launchPlatform:'pump',
    discoveredAt:Date.now()
  },defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.match(d.primaryReason,/holders below 30/i);
});

test('social gate waits until metadata is actually resolved',()=>{
  const s=normalizeSettings({...defaultSettings(),requireAnySocial:true});
  const d=evaluate(complete({
    metadataResolved:false,
    uri:'https://example.invalid/meta.json',
    twitter:null,website:null,telegram:null
  }),s);
  assert.equal(d.state,'WAITING');
});

test('social gate blocks after successful metadata resolution confirms no socials',()=>{
  const s=normalizeSettings({...defaultSettings(),requireAnySocial:true});
  const d=evaluate(complete({
    metadataResolved:true,
    twitter:null,website:null,telegram:null
  }),s);
  assert.equal(d.state,'BLOCKED');
  assert.match(d.primaryReason,/social link/i);
});

test('social gate passes when resolved metadata contains a social',()=>{
  const s=normalizeSettings({...defaultSettings(),requireAnySocial:true});
  const d=evaluate(complete({
    metadataResolved:true,
    twitter:'https://x.com/example'
  }),s);
  assert.equal(d.state,'BUY READY');
});
