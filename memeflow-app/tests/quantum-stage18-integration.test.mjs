import assert from 'node:assert/strict';
import {auditIntegration} from '../scripts/quantum-stage18-integration-audit.mjs';
const report=auditIntegration();
assert.equal(report.stage,18);
assert.equal(report.liveReady,false);
assert.equal(report.liveTradingValidated,false);
assert.equal(report.networkCalls,0);
assert.equal(report.transactions,0);
assert.equal(report.checks.length,13);
assert.equal(report.passed+report.failed,report.checks.length);
assert.ok(report.checks.some(c=>c.name.includes('Score')));
assert.ok(report.checks.some(c=>c.name.includes('Risk')));
assert.ok(report.checks.some(c=>c.name.includes('Pattern')));
console.log(`Stage 18 audit completed: ${report.passed}/${report.checks.length} source checks passed; liveReady=false`);
// The test verifies the auditor itself. Missing integration is reported by
// the CLI with a nonzero exit code, never hidden as a test failure.
