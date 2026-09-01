import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const verifier = join(
  repositoryRoot,
  'deploy',
  'orange-pi',
  'verify-backup.sh',
);
const serviceUnit = join(
  repositoryRoot,
  'deploy',
  'orange-pi',
  'schwank.service',
);

function run(command, arguments_, options = {}) {
  return spawnSync(command, arguments_, {
    encoding: 'utf8',
    ...options,
  });
}

void test('verifies a valid archived D1 state and rejects corruption', async () => {
  const sqliteVersion = run('sqlite3', ['--version']);
  if (sqliteVersion.status !== 0)
    throw new Error('sqlite3 is required for the deployment backup test.');

  const directory = await mkdtemp(join(tmpdir(), 'schwank-backup-test-'));
  try {
    const stateDirectory = join(
      directory,
      '.wrangler',
      'state',
      'v3',
      'd1',
      'miniflare-D1DatabaseObject',
    );
    await mkdir(stateDirectory, { recursive: true });
    const database = join(stateDirectory, 'test.sqlite');
    const created = run('sqlite3', [
      database,
      "CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT); INSERT INTO users(name) VALUES ('Alice');",
    ]);
    assert.equal(created.status, 0, created.stderr);

    const archive = join(directory, 'valid.tar.gz');
    const archived = run('tar', [
      '-C',
      directory,
      '-czf',
      archive,
      '.wrangler/state',
    ]);
    assert.equal(archived.status, 0, archived.stderr);
    await chmod(archive, 0o600);

    const verified = run('sh', [verifier, archive]);
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /Backup verified/);

    const corruptDirectory = join(
      directory,
      'corrupt',
      '.wrangler',
      'state',
      'v3',
      'd1',
      'miniflare-D1DatabaseObject',
    );
    await mkdir(corruptDirectory, { recursive: true });
    await writeFile(join(corruptDirectory, 'broken.sqlite'), 'not a database');
    const corruptArchive = join(directory, 'corrupt.tar.gz');
    const corruptArchived = run('tar', [
      '-C',
      join(directory, 'corrupt'),
      '-czf',
      corruptArchive,
      '.wrangler/state',
    ]);
    assert.equal(corruptArchived.status, 0, corruptArchived.stderr);
    const rejected = run('sh', [verifier, corruptArchive]);
    assert.notEqual(rejected.status, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

void test('keeps persistent state and the replaceable server build writable', async () => {
  const service = await readFile(serviceUnit, 'utf8');

  assert.match(
    service,
    /^ReadWritePaths=\/home\/orangepi\/schwank-server\/\.wrangler$/m,
  );
  assert.match(
    service,
    /^ReadWritePaths=\/home\/orangepi\/schwank-server\/dist\/server$/m,
  );
});
