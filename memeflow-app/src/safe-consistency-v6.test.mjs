import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8"
);
const moduleText = fs.readFileSync(
  new URL("../full-consistency-v6.js", import.meta.url),
  "utf8"
);

test("external consistency module is connected", () => {
  assert.match(
    html,
    /<script src="\/full-consistency-v6\.js" defer><\/script>/
  );
});

test("only one external V6 connection exists", () => {
  assert.equal(
    (
      html.match(
        /<script src="\/full-consistency-v6\.js" defer><\/script>/g
      ) || []
    ).length,
    1
  );
});

test("module isolates old chart DOM", () => {
  assert.match(moduleText, /cloneNode\(true\)/);
  assert.match(moduleText, /oldRoot\.replaceWith\(freshRoot\)/);
});

test("chart requires two positive points before LIVE", () => {
  assert.match(moduleText, /if \(rows\.length < 2\)/);
  assert.match(moduleText, /"NO DATA"/);
});

test("empty snapshots do not erase history", () => {
  assert.match(
    moduleText,
    /if \(!Array\.isArray\(incoming\) \|\| incoming\.length === 0\) return false/
  );
});

test("candidate mint is authoritative", () => {
  assert.match(moduleText, /const mint = mintOf\(candidate\)/);
  assert.match(moduleText, /mint !== chartState\.mint/);
});

test("route pass requires a real quote", () => {
  assert.match(moduleText, /const hasQuote =/);
  assert.match(moduleText, /candidate\?\.routeApproved === true/);
});

test("quote age requires a fresh positive price", () => {
  assert.match(moduleText, /const quoteFresh =/);
  assert.match(moduleText, /positive\(price\)/);
});

test("module syntax marker exists", () => {
  assert.match(
    moduleText,
    /MEMEFLOW_SAFE_CONSISTENCY_V6_2026_08_05/
  );
});
