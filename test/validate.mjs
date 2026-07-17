// Basic pre-release validation for Simple Side Note.
// No dependencies — run with:  node test/validate.mjs
//
// Catches the most common mistakes made while editing before a version bump:
//  1. Broken JSON / missing manifest fields
//  2. Files referenced by the manifest that don't exist
//  3. JavaScript syntax errors (parse check on every .js)
//  4. getElementById('x') in sidepanel.js with no matching id="x" in the HTML
//  5. Version in manifest.json not documented in CHANGELOG.md

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => join(ROOT, ...s);

let failures = 0;
let checks = 0;
const fail = (msg) => { failures++; console.log('  ✗ ' + msg); };
const pass = (msg) => { checks++; console.log('  ✓ ' + msg); };

function section(name) { console.log('\n' + name); }

// ---- 1. manifest.json ----
section('manifest.json');
let manifest = null;
try {
  manifest = JSON.parse(readFileSync(p('manifest.json'), 'utf8'));
  pass('valid JSON');
} catch (e) {
  fail('invalid JSON: ' + e.message);
}

if (manifest) {
  for (const field of ['manifest_version', 'name', 'version', 'description']) {
    if (manifest[field] === undefined || manifest[field] === '') {
      fail('missing required field: ' + field);
    } else {
      pass('has ' + field + ' (' + JSON.stringify(manifest[field]) + ')');
    }
  }
  if (manifest.manifest_version !== 3) fail('manifest_version should be 3');
  if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    fail('version "' + manifest.version + '" is not semver (x.y.z)');
  }

  // Files the manifest points at must exist
  const refs = [];
  if (manifest.background?.service_worker) refs.push(manifest.background.service_worker);
  if (manifest.side_panel?.default_path) refs.push(manifest.side_panel.default_path);
  if (manifest.icons) refs.push(...Object.values(manifest.icons));
  for (const rel of refs) {
    if (existsSync(p(rel))) pass('referenced file exists: ' + rel);
    else fail('referenced file MISSING: ' + rel);
  }
}

// ---- 2. JavaScript syntax ----
section('JavaScript syntax');
for (const file of ['service-worker.js', 'sidepanel.js']) {
  if (!existsSync(p(file))) { fail(file + ' not found'); continue; }
  try {
    execFileSync(process.execPath, ['--check', p(file)], { stdio: 'pipe' });
    pass(file + ' parses');
  } catch (e) {
    fail(file + ' has a syntax error:\n' + (e.stderr?.toString() || e.message));
  }
}

// ---- 3. DOM wiring: getElementById must resolve to a real id in the HTML ----
section('DOM wiring (sidepanel.js ↔ sidepanel.html)');
try {
  const js = readFileSync(p('sidepanel.js'), 'utf8');
  const html = readFileSync(p('sidepanel.html'), 'utf8');
  const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const referenced = new Set([...js.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]));
  let missing = 0;
  for (const id of referenced) {
    if (!htmlIds.has(id)) { fail('getElementById("' + id + '") has no matching element in HTML'); missing++; }
  }
  if (missing === 0) pass('all ' + referenced.size + ' element IDs resolve');
} catch (e) {
  fail('could not cross-check IDs: ' + e.message);
}

// ---- 4. Version documented in CHANGELOG ----
section('CHANGELOG');
if (manifest?.version) {
  try {
    const changelog = readFileSync(p('CHANGELOG.md'), 'utf8');
    if (changelog.includes('[' + manifest.version + ']')) {
      pass('version ' + manifest.version + ' has a CHANGELOG entry');
    } else {
      fail('version ' + manifest.version + ' is NOT documented in CHANGELOG.md');
    }
  } catch {
    fail('CHANGELOG.md not found');
  }
}

// ---- summary ----
console.log('\n' + '-'.repeat(40));
if (failures === 0) {
  console.log('✓ All checks passed (' + checks + ').');
  process.exit(0);
} else {
  console.log('✗ ' + failures + ' problem(s) found, ' + checks + ' check(s) passed.');
  process.exit(1);
}
