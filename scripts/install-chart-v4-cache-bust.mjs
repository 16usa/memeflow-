#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve("memeflow-app");
const indexFile = path.join(root, "index.html");
const bundled = path.resolve(here, "../memeflow-app/market-chart-final-v4.js");
const target = path.join(root, "market-chart-final-v4.js");

if (!fs.existsSync(indexFile)) throw new Error(`Missing ${indexFile}`);
if (!fs.existsSync(bundled)) throw new Error(`Missing ${bundled}`);

const indexBackup = `${indexFile}.before-chart-v4-cache-bust`;
if (!fs.existsSync(indexBackup)) fs.copyFileSync(indexFile, indexBackup);

fs.copyFileSync(bundled, target);

let html = fs.readFileSync(indexFile, "utf8");
html = html.replace(
  /<script[^>]*src=["'][^"']*market-chart-final(?:-v\d+)?\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  ""
);

const tag = '<script src="/market-chart-final-v4.js?v=20260805-2022"></script>';
const bodyEnd = html.lastIndexOf("</body>");
if (bodyEnd < 0) throw new Error("Missing </body>");
html = html.slice(0, bodyEnd) + tag + "\n" + html.slice(bodyEnd);

fs.writeFileSync(indexFile, html, "utf8");

const refs = (html.match(/market-chart-final-v4\.js/g) || []).length;
if (refs !== 1) throw new Error(`Validation failed: v4 script refs=${refs}`);

console.log("SUCCESS: Chart v4 installed with a unique cache-busting URL.");
console.log(`Updated: ${indexFile}`);
console.log(`Created: ${target}`);
