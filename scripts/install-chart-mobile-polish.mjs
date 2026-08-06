#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve("memeflow-app");
const indexFile = path.join(root, "index.html");
const bundled = path.resolve(here, "../memeflow-app/market-chart-final-v5.js");
const target = path.join(root, "market-chart-final-v5.js");

if (!fs.existsSync(indexFile)) throw new Error(`Missing ${indexFile}`);
if (!fs.existsSync(bundled)) throw new Error(`Missing ${bundled}`);

const backup = `${indexFile}.before-chart-mobile-polish`;
if (!fs.existsSync(backup)) fs.copyFileSync(indexFile, backup);

fs.copyFileSync(bundled, target);

let html = fs.readFileSync(indexFile, "utf8");
html = html.replace(
  /<script[^>]*src=["'][^"']*market-chart-final(?:-v\d+)?\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  ""
);

const tag = '<script src="/market-chart-final-v5.js?v=20260805-mobile-polish"></script>';
const bodyEnd = html.lastIndexOf("</body>");
if (bodyEnd < 0) throw new Error("Missing </body>");

html = html.slice(0, bodyEnd) + tag + "\n" + html.slice(bodyEnd);
fs.writeFileSync(indexFile, html, "utf8");

const refs = (html.match(/market-chart-final-v5\.js/g) || []).length;
if (refs !== 1) throw new Error(`Validation failed: v5 refs=${refs}`);

console.log("SUCCESS: Mobile Market Chart polish installed.");
console.log(`Updated: ${indexFile}`);
console.log(`Created: ${target}`);
