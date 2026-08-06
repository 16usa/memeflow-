#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("memeflow-app");
const serverFile = path.join(root, "app-server.mjs");
const enrichFile = path.join(root, "src", "enrich.mjs");
const MARKER = "MEMEFLOW_TOKEN_METADATA_IMAGE_V1";

for (const file of [serverFile, enrichFile]) {
  if (!fs.existsSync(file)) {
    console.error(`ERROR: Missing ${file}`);
    process.exit(1);
  }
}

function backup(file) {
  const copy = `${file}.before-token-image-backend`;
  if (!fs.existsSync(copy)) fs.copyFileSync(file, copy);
}

backup(serverFile);
backup(enrichFile);

let enrich = fs.readFileSync(enrichFile, "utf8");
let server = fs.readFileSync(serverFile, "utf8");

if (!enrich.includes(MARKER)) {
  const importNeedle = "import {decodeCurve} from './solana.mjs';";
  if (!enrich.includes(importNeedle)) {
    console.error("ERROR: enrich.mjs import anchor not found.");
    process.exit(1);
  }

  const helpers = `

/* ${MARKER} */
function normalizeMetadataUrl(value) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;
  if (/^ipfs:\\/\\//i.test(url)) {
    return 'https://ipfs.io/ipfs/' + url.replace(/^ipfs:\\/\\//i, '').replace(/^ipfs\\//i, '');
  }
  if (/^ar:\\/\\//i.test(url)) {
    return 'https://arweave.net/' + url.replace(/^ar:\\/\\//i, '');
  }
  if (/^https?:\\/\\//i.test(url)) return url;
  return null;
}

function firstMetadataImage(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const values = [
    metadata.image,
    metadata.image_url,
    metadata.imageUrl,
    metadata.logo,
    metadata.logo_url,
    metadata.logoUrl,
    metadata.icon,
    metadata.icon_url,
    metadata.iconUrl,
    metadata.properties?.files?.[0]?.uri,
    metadata.properties?.files?.[0]?.url
  ];
  for (const value of values) {
    const normalized = normalizeMetadataUrl(value);
    if (normalized) return normalized;
  }
  return null;
}

async function fetchTokenMetadata(uri) {
  const metadataUrl = normalizeMetadataUrl(uri);
  if (!metadataUrl) return {metadataUrl:null, imageUrl:null};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(metadataUrl, {
      signal: controller.signal,
      headers: {
        accept: 'application/json,text/plain;q=0.9,*/*;q=0.5',
        'user-agent': 'MEMEFLOW/1.0 token-metadata'
      }
    });
    if (!response.ok) throw new Error('metadata HTTP ' + response.status);

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 1_500_000) throw new Error('metadata response too large');

    const metadata = await response.json();
    return {
      metadataUrl,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null
    };
  } finally {
    clearTimeout(timeout);
  }
}
`;
  enrich = enrich.replace(importNeedle, importNeedle + helpers);

  const twNeedle = "    const tw = (tradeWindows?.get?.(mint)) || {buy: 0, sell: 0};";
  if (!enrich.includes(twNeedle)) {
    console.error("ERROR: enrich.mjs token update anchor not found.");
    process.exit(1);
  }

  const metadataBlock = `
    const existingToken = store.state.tokens[mint] || {};
    let metadataPatch = {};
    const shouldFetchMetadata =
      existingToken.uri &&
      !existingToken.imageUrl &&
      (!existingToken.metadataFetchedAt ||
        Date.now() - Number(existingToken.metadataFetchedAt) > 6 * 60 * 60 * 1000);

    if (shouldFetchMetadata) {
      try {
        const metadata = await fetchTokenMetadata(existingToken.uri);
        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataUrl:metadata.metadataUrl,
          imageUrl:metadata.imageUrl,
          image:metadata.imageUrl,
          logoUrl:metadata.imageUrl,
          metadataName:metadata.metadataName,
          metadataSymbol:metadata.metadataSymbol
        };
      } catch (error) {
        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataError:sanitize(error?.message || String(error))
        };
      }
    }
`;
  enrich = enrich.replace(twNeedle, twNeedle + metadataBlock);

  const updateNeedle = "    const update = {\n      scanError: null,";
  if (!enrich.includes(updateNeedle)) {
    console.error("ERROR: enrich.mjs update object anchor not found.");
    process.exit(1);
  }
  enrich = enrich.replace(
    updateNeedle,
    "    const update = {\n      ...metadataPatch,\n      scanError: null,"
  );
}

if (!server.includes(MARKER)) {
  const nameNeedle = "    symbol:t.symbol||'TOKEN',";
  if (!server.includes(nameNeedle)) {
    console.error("ERROR: app-server.mjs candidate payload anchor not found.");
    process.exit(1);
  }

  const imageFields = `
    /* ${MARKER} */
    uri:t.uri||null,
    metadataUri:t.metadataUrl||t.uri||null,
    imageUrl:t.imageUrl||t.image||t.logoUrl||null,
    image:t.imageUrl||t.image||t.logoUrl||null,
    logoUrl:t.logoUrl||t.imageUrl||t.image||null,`;
  server = server.replace(nameNeedle, nameNeedle + imageFields);
}

fs.writeFileSync(enrichFile, enrich, "utf8");
fs.writeFileSync(serverFile, server, "utf8");

console.log("SUCCESS: Backend token metadata image support installed.");
console.log(`Updated: ${enrichFile}`);
console.log(`Updated: ${serverFile}`);
console.log("New candidates will fetch metadata automatically.");
console.log("Existing candidates will fetch metadata on their next enrichment cycle.");
