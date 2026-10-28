const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');
const releaseDir = path.join(projectDir, 'release');
const tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'order-cost-manager-'));
const builderCacheDir = path.join(os.tmpdir(), 'order-cost-electron-builder-cache');

function runNode(script, args, extraEnv = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: projectDir,
    env: {...process.env, ...extraEnv},
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Build command failed with exit code ${result.status ?? 1}.`);
  }
}

try {
  runNode(path.join(projectDir, 'node_modules', 'vite', 'bin', 'vite.js'), [
    '--configLoader',
    'runner',
    'build',
  ]);

  runNode(
    path.join(projectDir, 'node_modules', 'electron-builder', 'cli.js'),
    [
      '--win',
      'portable',
      '--x64',
      `-c.directories.output=${tempOutputDir}`,
    ],
    {ELECTRON_BUILDER_CACHE: builderCacheDir},
  );

  const portableExe = fs
    .readdirSync(tempOutputDir, {withFileTypes: true})
    .find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'));

  if (!portableExe) {
    throw new Error(`Portable EXE was not created in ${tempOutputDir}`);
  }

  fs.mkdirSync(releaseDir, {recursive: true});

  const sourcePath = path.join(tempOutputDir, portableExe.name);
  const destinationPath = path.join(releaseDir, portableExe.name);
  fs.copyFileSync(sourcePath, destinationPath);

  console.log(`Portable EXE created: ${destinationPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempOutputDir, {recursive: true, force: true});
}
