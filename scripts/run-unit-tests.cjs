// Compiles the dependency-free app modules and runs the node:test suites in
// scripts/unit. No device, no backend, no extra dependencies required.
const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'notice-unit-'));

try {
  execSync(
    'npx tsc src/utils/layout.ts src/utils/note.ts src/utils/id.ts ' +
      'src/types/index.ts src/theme/index.ts src/theme/colors.ts src/theme/fonts.ts ' +
      '--ignoreConfig --outDir ' + JSON.stringify(out) +
      ' --module commonjs --target es2019 --moduleResolution node --ignoreDeprecations 6.0 ' +
      '--esModuleInterop --skipLibCheck --strict false',
    { cwd: root, stdio: 'pipe' },
  );
} catch (e) {
  console.error('unit-test compile failed');
  console.error((e.stdout || '').toString() + (e.stderr || '').toString());
  process.exit(1);
}

const files = fs
  .readdirSync(path.join(__dirname, 'unit'))
  .filter((f) => f.endsWith('.test.cjs'))
  .map((f) => path.join(__dirname, 'unit', f));
if (files.length === 0) {
  console.error('no unit tests found in scripts/unit');
  process.exit(1);
}
const res = spawnSync(process.execPath, ['--test', ...files], {
  cwd: root,
  env: { ...process.env, TEST_BUILD: out },
  stdio: 'inherit',
});
fs.rmSync(out, { recursive: true, force: true });
process.exit(res.status ?? 1);
