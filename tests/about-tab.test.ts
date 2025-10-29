import { test } from 'node:test';
import assert from 'node:assert';

// Simple sanity test reading package.json version to ensure version available
import fs from 'node:fs';
import path from 'node:path';

function getPkg() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

// This test ensures package.json version exists for About tab & window title
// (Renderer/electron integration tests would require a running Electron environment.)

test('package version exists', () => {
  const pkg = getPkg();
  assert.ok(pkg.version, 'package.json should have a version');
  assert.match(pkg.version, /^\d+\.\d+\.\d+(-.*)?$/, 'version should follow semver');
});
