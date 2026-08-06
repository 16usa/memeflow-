#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const stateFile = path.resolve("memeflow-app/data/state.json");
if (!fs.existsSync(stateFile)) throw new Error(`Missing ${stateFile}`);

const backup = `${stateFile}.before-token-image-backfill`;
if (!fs.existsSync(backup)) fs.copyFileSync(stateFile, backup);

const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const tokens = state.tokens && typeof state.tokens === "object" ? state.tokens : {};

function normalizeUrl(value) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  if (/^ipfs:\/\//i.test(url)) {
    return "https://ipfs.io/ipfs/" + url.replace(/^ipfs:\/\//i, "").replace(/^ipfs\//i, "");
  }
  if (/^ar:\/\//i.test(url)) {
    return "https://arweave.net/" + url.replace(/^ar:\/\//i, "");
  }
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

function imageOf(metadata) {
  const values = [
    metadata?.image, metadata?.image_url, metadata?.imageUrl,
    metadata?.logo, metadata?.logo_url, metadata?.logoUrl,
    metadata?.icon, metadata?.icon_url, metadata?.iconUrl,
    metadata?.properties?.files?.[0]?.uri,
    metadata?.properties?.files?.[0]?.url
  ];
  for (const value of values) {
    const url = normalizeUrl(value);
    if (url) return url;
  }
  return null;
}

async function fetchMetadata(uri) {
  const url = normalizeUrl(uri);
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {accept:"application/json,text/plain;q=0.9,*/*;q=0.5"}
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const metadata = await response.json();
    return {url, imageUrl:imageOf(metadata)};
  } finally {
    clearTimeout(timeout);
  }
}

const entries = Object.entries(tokens).filter(([,token]) =>
  token && token.uri && !token.imageUrl && !token.image && !token.logoUrl
);

let next = 0;
let updated = 0;
let failed = 0;

async function worker() {
  while (next < entries.length) {
    const index = next++;
    const [mint, token] = entries[index];
    try {
      const result = await fetchMetadata(token.uri);
      if (result?.imageUrl) {
        token.metadataUrl = result.url;
        token.imageUrl = result.imageUrl;
        token.image = result.imageUrl;
        token.logoUrl = result.imageUrl;
        token.metadataFetchedAt = Date.now();
        updated++;
        console.log(`IMAGE ${mint.slice(0,8)}…`);
      } else {
        failed++;
      }
    } catch (error) {
      token.metadataError = String(error?.message || error).slice(0,160);
      token.metadataFetchedAt = Date.now();
      failed++;
    }
  }
}

await Promise.all(Array.from({length:Math.min(4,Math.max(1,entries.length))}, worker));

fs.writeFileSync(stateFile, JSON.stringify(state), "utf8");

console.log(`SUCCESS: Image backfill complete. Updated=${updated}, unavailable=${failed}, checked=${entries.length}`);
console.log(`Backup: ${backup}`);
