import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
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
const encryptedBackup = join(
  repositoryRoot,
  'deploy',
  'orange-pi',
  'encrypted-backup.sh',
);
const encryptedVerifier = join(
  repositoryRoot,
  'deploy',
  'orange-pi',
  'verify-encrypted-backup.sh',
);
const restoreDrill = join(
  repositoryRoot,
  'deploy',
  'orange-pi',
  'restore-drill.sh',
);
const serviceUnit = join(
  repositoryRoot,
  'deploy',
  'orange-pi',
  'schwank.service',
);
const backupServiceUnit = join(
  repositoryRoot,
  'deploy',
  'orange-pi',
  'schwank-backup.service',
);
const fedoraServiceUnit = join(
  repositoryRoot,
  'deploy',
  'fedora',
  'schwank.service',
);
const fedoraBackupServiceUnit = join(
  repositoryRoot,
  'deploy',
  'fedora',
  'schwank-backup.service',
);
const serverRuntimePackage = join(
  repositoryRoot,
  'deploy',
  'server-runtime',
  'package.json',
);
const serverRuntimeLock = join(
  repositoryRoot,
  'deploy',
  'server-runtime',
  'package-lock.json',
);
const desktopWorkflow = join(
  repositoryRoot,
  '.github',
  'workflows',
  'desktop-builds.yml',
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

    const drilled = run('sh', [restoreDrill, archive]);
    assert.equal(drilled.status, 0, drilled.stderr);
    assert.match(drilled.stdout, /Restore drill passed: integrity=ok/);

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

    const linkedDirectory = join(directory, 'linked', '.wrangler', 'state');
    await mkdir(linkedDirectory, { recursive: true });
    await symlink('/tmp', join(linkedDirectory, 'outside'));
    const linkedArchive = join(directory, 'linked.tar.gz');
    assert.equal(
      run('tar', [
        '-C',
        join(directory, 'linked'),
        '-czf',
        linkedArchive,
        '.wrangler/state',
      ]).status,
      0,
    );
    const linkedRejected = run('sh', [verifier, linkedArchive]);
    assert.notEqual(linkedRejected.status, 0);
    assert.match(linkedRejected.stderr, /link or unsupported file type/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

void test('encrypts, decrypts, and verifies a backup through the age boundary', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'schwank-encrypted-test-'));
  try {
    const stateDirectory = join(
      directory,
      'state-source',
      '.wrangler',
      'state',
      'v3',
      'd1',
      'miniflare-D1DatabaseObject',
    );
    const binaryDirectory = join(directory, 'bin');
    const backupDirectory = join(directory, 'backups');
    await mkdir(stateDirectory, { recursive: true });
    await mkdir(binaryDirectory);
    await mkdir(backupDirectory);
    const database = join(stateDirectory, 'test.sqlite');
    assert.equal(
      run('sqlite3', [
        database,
        "CREATE TABLE __schwank_migrations(id TEXT PRIMARY KEY); INSERT INTO __schwank_migrations VALUES ('0018');",
      ]).status,
      0,
    );
    const archive = join(backupDirectory, 'schwank-state-test.tar.gz');
    assert.equal(
      run('tar', [
        '-C',
        join(directory, 'state-source'),
        '-czf',
        archive,
        '.wrangler/state',
      ]).status,
      0,
    );

    const backupCommand = join(directory, 'make-backup.sh');
    await writeFile(backupCommand, `#!/bin/sh\necho '${archive}'\n`);
    await chmod(backupCommand, 0o700);
    const fakeAge = join(binaryDirectory, 'age');
    await writeFile(
      fakeAge,
      `#!/bin/sh\noutput=\ninput=\nwhile [ "$#" -gt 0 ]; do\n  case "$1" in\n    --output) output=$2; shift 2 ;;\n    --recipient|--identity) shift 2 ;;\n    --encrypt|--decrypt) shift ;;\n    *) input=$1; shift ;;\n  esac\ndone\ncp "$input" "$output"\n`,
    );
    await chmod(fakeAge, 0o700);
    const environment = {
      ...process.env,
      PATH: `${binaryDirectory}:${process.env.PATH}`,
      SCHWANK_BACKUP_DIR: backupDirectory,
      SCHWANK_BACKUP_RECIPIENT: 'age1integrationrecipient',
      SCHWANK_BACKUP_SCRIPT: backupCommand,
      SCHWANK_VERIFY_BACKUP_SCRIPT: verifier,
    };
    const encrypted = run('sh', [encryptedBackup], { env: environment });
    assert.equal(encrypted.status, 0, encrypted.stderr);
    const encryptedPath = encrypted.stdout.trim();
    assert.equal(encryptedPath, `${archive}.age`);
    assert.equal(existsSync(archive), false);
    assert.equal(existsSync(encryptedPath), true);

    const identity = join(directory, 'identity.txt');
    await writeFile(identity, 'AGE-SECRET-KEY-TEST');
    const checked = run('sh', [encryptedVerifier, encryptedPath, identity], {
      env: environment,
    });
    assert.equal(checked.status, 0, checked.stderr);
    assert.match(checked.stdout, /Encrypted backup verified/);
    const drilled = run('sh', [restoreDrill, encryptedPath, identity], {
      env: environment,
    });
    assert.equal(drilled.status, 0, drilled.stderr);
    assert.match(drilled.stdout, /migrations=1/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

void test('keeps persistent state and the replaceable server build writable', async () => {
  const service = await readFile(serviceUnit, 'utf8');
  const backupService = await readFile(backupServiceUnit, 'utf8');

  assert.match(
    service,
    /^ReadWritePaths=\/home\/orangepi\/schwank-server\/\.wrangler$/m,
  );
  assert.match(
    service,
    /^ReadWritePaths=\/home\/orangepi\/schwank-server\/dist\/server$/m,
  );
  assert.match(service, /^SyslogIdentifier=schwank$/m);
  assert.match(service, /^LogRateLimitBurst=200$/m);
  assert.match(backupService, /^User=root$/m);
  assert.match(
    backupService,
    /^ExecStart=\/usr\/local\/libexec\/schwank-backup-runner$/m,
  );
});

void test('provides a pinned minimal runtime and Fedora lumina service profile', async () => {
  const runtimePackage = JSON.parse(
    await readFile(serverRuntimePackage, 'utf8'),
  );
  const runtimeLock = JSON.parse(await readFile(serverRuntimeLock, 'utf8'));
  const service = await readFile(fedoraServiceUnit, 'utf8');
  const backupService = await readFile(fedoraBackupServiceUnit, 'utf8');

  assert.deepEqual(runtimePackage.dependencies, { wrangler: '4.127.1' });
  assert.equal(runtimeLock.packages[''].dependencies.wrangler, '4.127.1');
  assert.match(runtimePackage.scripts.start, /--ip 0\.0\.0\.0/);
  assert.match(runtimePackage.scripts.start, /--port 3000/);
  assert.match(runtimePackage.scripts.start, /--persist-to \.wrangler\/state/);
  assert.match(runtimePackage.scripts.start, /--env-file \.dev\.vars/);
  assert.match(service, /^User=lumina$/m);
  assert.match(service, /^WorkingDirectory=\/home\/lumina\/schwank-server$/m);
  assert.doesNotMatch(service, /orangepi/);
  assert.match(backupService, /^Environment=SCHWANK_BACKUP_USER=lumina$/m);
  assert.match(
    backupService,
    /^Environment=SCHWANK_SERVER_DIR=\/home\/lumina\/schwank-server$/m,
  );
});

void test('publishes a complete tagged desktop release only after every native build', async () => {
  const workflow = await readFile(desktopWorkflow, 'utf8');

  assert.match(workflow, /^\s+- 'v\*'$/m);
  assert.match(workflow, /command: desktop:dist:mac/);
  assert.match(workflow, /command: desktop:dist:linux/);
  assert.match(workflow, /command: desktop:dist:windows/);
  assert.match(workflow, /needs: build/);
  assert.match(workflow, /if: startsWith\(github\.ref, 'refs\/tags\/v'\)/);
  assert.match(workflow, /permissions:\n\s+contents: write/);
  assert.match(workflow, /gh release create "\$GITHUB_REF_NAME"/);
  assert.match(workflow, /--notes-file "\$notes_file"/);
});
