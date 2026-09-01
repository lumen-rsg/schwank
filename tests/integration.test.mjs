import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wranglerCli = join(
  repositoryRoot,
  'node_modules',
  'wrangler',
  'bin',
  'wrangler.js',
);
const wranglerConfig = join(repositoryRoot, 'dist', 'server', 'wrangler.json');

let serverProcess;
let stateDirectory;
let origin;
let serverLogs = '';
const temporaryDirectories = [];

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  return port;
}

function captureLogs(chunk) {
  serverLogs = `${serverLogs}${chunk}`.slice(-20_000);
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null)
      throw new Error(`Integration server exited early.\n${serverLogs}`);
    try {
      const response = await fetch(`${origin}/api/health`, {
        headers: { connection: 'close' },
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        const health = await response.json();
        if (health.database === 'ready') return;
      }
    } catch {
      // Wrangler is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Integration server did not become ready.\n${serverLogs}`);
}

async function startServer(persistTo) {
  const port = await availablePort();
  origin = `http://127.0.0.1:${port}`;
  serverLogs = '';
  serverProcess = spawn(
    process.execPath,
    [
      wranglerCli,
      'dev',
      '--config',
      wranglerConfig,
      '--assets',
      join(repositoryRoot, 'dist', 'client'),
      '--persist-to',
      persistTo,
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        AI_PROVIDER: 'deepseek',
        AI_API_KEY: 'integration-test-key',
        AI_MODEL: 'deepseek-v4-pro',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  serverProcess.stdout.on('data', captureLogs);
  serverProcess.stderr.on('data', captureLogs);
  await waitForServer();
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  serverProcess.kill('SIGTERM');
  const stopped = await Promise.race([
    new Promise((resolveClose) =>
      serverProcess.once('exit', () => resolveClose(true)),
    ),
    new Promise((resolveTimeout) =>
      setTimeout(() => resolveTimeout(false), 5_000),
    ),
  ]);
  if (!stopped && serverProcess.exitCode === null) {
    serverProcess.kill('SIGKILL');
    await new Promise((resolveClose) =>
      serverProcess.once('exit', resolveClose),
    );
  }
}

before(async () => {
  assert.ok(
    existsSync(wranglerConfig),
    'Run `npm run server:build` before the integration tests.',
  );
  stateDirectory = await mkdtemp(join(tmpdir(), 'schwank-integration-'));
  temporaryDirectories.push(stateDirectory);
  await startServer(stateDirectory);
});

after(async () => {
  await stopServer();
  for (const directory of temporaryDirectories)
    await rm(directory, { recursive: true, force: true });
});

async function jsonRequest(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('connection', 'close');
  const response = await fetch(`${origin}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function register(name, email, password, inviteCode) {
  const result = await jsonRequest('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ name, email, password, inviteCode }),
  });
  const cookie = result.response.headers.get('set-cookie')?.split(';')[0];
  return { ...result, cookie };
}

async function action(cookie, body) {
  return jsonRequest('/api/schwank', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
      origin,
    },
    body: JSON.stringify(body),
  });
}

async function household(cookie) {
  const result = await jsonRequest('/api/schwank', {
    headers: { cookie },
  });
  assert.equal(result.response.status, 200);
  return result.body;
}

void test(
  'isolates authentication and private household data between two users',
  { timeout: 90_000 },
  async () => {
    const anonymous = await jsonRequest('/api/schwank');
    assert.equal(anonymous.response.status, 401);

    const freshEnrollment = await jsonRequest('/api/auth/enrollment');
    assert.deepEqual(freshEnrollment.body, {
      firstUser: true,
      registrationOpen: true,
    });

    const rejectedOrigin = await jsonRequest('/api/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://attacker.invalid',
      },
      body: JSON.stringify({
        name: 'Rejected User',
        email: 'rejected@example.test',
        password: 'rejected-password-123',
      }),
    });
    assert.equal(rejectedOrigin.response.status, 403);

    const alice = await register(
      'Alice Test',
      'alice@example.test',
      'alice-password-123',
    );
    assert.equal(alice.response.status, 201);
    assert.ok(alice.cookie);

    const closedEnrollment = await jsonRequest('/api/auth/enrollment');
    assert.deepEqual(closedEnrollment.body, {
      firstUser: false,
      registrationOpen: false,
    });

    const bobWithoutInvite = await register(
      'Bob Test',
      'bob@example.test',
      'bob-password-12345',
    );
    assert.equal(bobWithoutInvite.response.status, 403);

    const ownerSettings = await jsonRequest('/api/household/enrollment', {
      headers: { cookie: alice.cookie },
    });
    assert.equal(ownerSettings.response.status, 200);
    assert.equal(ownerSettings.body.registrationOpen, false);

    const invite = await jsonRequest('/api/household/enrollment', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: alice.cookie,
        origin,
      },
      body: JSON.stringify({ action: 'rotate' }),
    });
    assert.equal(invite.response.status, 200);
    assert.match(invite.body.inviteCode, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);

    const invalidInvite = await register(
      'Mallory Test',
      'mallory@example.test',
      'mallory-password-123',
      'WRONG-CODE',
    );
    assert.equal(invalidInvite.response.status, 403);

    const duplicate = await register(
      'Alice Duplicate',
      'alice@example.test',
      'another-password-123',
      invite.body.inviteCode,
    );
    assert.equal(duplicate.response.status, 409);

    const bob = await register(
      'Bob Test',
      'bob@example.test',
      'bob-password-12345',
      invite.body.inviteCode,
    );
    assert.equal(bob.response.status, 201);
    assert.ok(bob.cookie);

    const memberSettings = await jsonRequest('/api/household/enrollment', {
      headers: { cookie: bob.cookie },
    });
    assert.equal(memberSettings.response.status, 403);
    const memberRotate = await jsonRequest('/api/household/enrollment', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: bob.cookie,
        origin,
      },
      body: JSON.stringify({ action: 'rotate' }),
    });
    assert.equal(memberRotate.response.status, 403);

    const wrongPassword = await jsonRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email: 'alice@example.test',
        password: 'wrong-password-123',
      }),
    });
    assert.equal(wrongPassword.response.status, 401);

    const login = await jsonRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email: 'alice@example.test',
        password: 'alice-password-123',
      }),
    });
    assert.equal(login.response.status, 200);

    const today = new Date().toISOString().slice(0, 10);
    const records = [
      {
        type: 'nutrition',
        label: 'Alice private meal',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 20,
        visibility: 'private',
      },
      {
        type: 'nutrition',
        label: 'Alice shared meal',
        calories: 600,
        protein: 35,
        carbs: 60,
        fat: 22,
        visibility: 'shared',
      },
      {
        type: 'task',
        title: 'Alice private task',
        tag: 'Private',
        dueOn: '2030-01-10',
        visibility: 'private',
      },
      {
        type: 'task',
        title: 'Alice shared task',
        tag: 'Shared',
        dueOn: '2030-01-11',
        visibility: 'shared',
      },
      {
        type: 'expense',
        label: 'Alice private expense',
        amount: 100,
        category: 'other',
        visibility: 'private',
      },
      {
        type: 'expense',
        label: 'Alice shared expense',
        amount: 200,
        category: 'groceries',
        visibility: 'shared',
      },
      {
        type: 'recurring-payment',
        kind: 'subscription',
        label: 'Alice private payment',
        amount: 300,
        billingCycle: 'monthly',
        nextDueOn: '2030-01-12',
        visibility: 'private',
      },
      {
        type: 'recurring-payment',
        kind: 'rent',
        label: 'Alice shared payment',
        amount: 400,
        billingCycle: 'monthly',
        nextDueOn: '2030-01-13',
        visibility: 'shared',
      },
      {
        type: 'organiser',
        list: 'Alice private list',
        label: 'Alice private item',
        visibility: 'private',
      },
      {
        type: 'organiser',
        list: 'Alice shared list',
        label: 'Alice shared item',
        visibility: 'shared',
      },
      {
        type: 'reminder',
        label: 'Alice private reminder',
        remindAt: '2030-01-14T09:00',
        visibility: 'private',
      },
      {
        type: 'reminder',
        label: 'Alice shared reminder',
        remindAt: '2030-01-15T09:00',
        visibility: 'shared',
      },
      {
        type: 'medication',
        name: 'Alice private medication',
        dosage: '1 tablet',
        instructions: 'Synthetic test record',
        scheduleTimes: '09:00',
        startOn: '2029-01-01',
        endOn: '2030-12-31',
        visibility: 'private',
      },
      {
        type: 'medication',
        name: 'Alice shared medication',
        dosage: '2 tablets',
        instructions: 'Synthetic test record',
        scheduleTimes: '10:00',
        startOn: '2029-01-01',
        endOn: '2030-12-31',
        visibility: 'shared',
      },
    ];

    for (const record of records) {
      const created = await action(alice.cookie, record);
      assert.equal(created.response.status, 200, JSON.stringify(created.body));
    }

    assert.equal(
      (
        await action(alice.cookie, {
          type: 'water',
          amountMl: 450,
          drunkOn: today,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'habit',
          habit: 'vaping',
          occurrences: 1,
          cost: 50,
          occurredOn: today,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'purchase-idea',
          title: 'Alice public purchase idea',
          description: 'Synthetic test record',
          estimatedCost: 1_000,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'message',
          body: 'Alice household chat message',
        })
      ).response.status,
      200,
    );

    const aliceData = await household(alice.cookie);
    const bobData = await household(bob.cookie);
    const bobSerialized = JSON.stringify(bobData);

    for (const privateLabel of [
      'Alice private meal',
      'Alice private task',
      'Alice private expense',
      'Alice private payment',
      'Alice private list',
      'Alice private item',
      'Alice private reminder',
      'Alice private medication',
    ]) {
      assert.equal(bobSerialized.includes(privateLabel), false, privateLabel);
      assert.equal(JSON.stringify(aliceData).includes(privateLabel), true);
    }

    for (const sharedLabel of [
      'Alice shared meal',
      'Alice shared task',
      'Alice shared expense',
      'Alice shared payment',
      'Alice shared list',
      'Alice shared item',
      'Alice shared reminder',
      'Alice shared medication',
    ]) {
      assert.equal(bobSerialized.includes(sharedLabel), true, sharedLabel);
    }

    assert.equal(bobSerialized.includes('alice@example.test'), false);
    assert.equal(bobData.water.length, 0);
    assert.equal(
      bobData.habits.some((entry) => entry.name === 'Alice Test'),
      true,
    );
    assert.equal(
      bobData.messages.some(
        (message) => message.body === 'Alice household chat message',
      ),
      true,
    );

    const sharedTask = bobData.tasks.find(
      (task) => task.title === 'Alice shared task',
    );
    const sharedPayment = bobData.recurringPayments.find(
      (payment) => payment.label === 'Alice shared payment',
    );
    const sharedItem = bobData.organisers.find(
      (item) => item.label === 'Alice shared item',
    );
    const sharedReminder = bobData.reminders.find(
      (reminder) => reminder.label === 'Alice shared reminder',
    );
    const sharedMedication = bobData.medications.find(
      (medication) => medication.name === 'Alice shared medication',
    );
    const publicIdea = bobData.purchaseIdeas.find(
      (idea) => idea.title === 'Alice public purchase idea',
    );
    assert.ok(sharedTask && sharedPayment && sharedItem && sharedReminder);
    assert.ok(sharedMedication && publicIdea);

    const forbiddenMutations = [
      { type: 'task-status', id: sharedTask.id, status: 'done' },
      { type: 'recurring-payment-toggle', id: sharedPayment.id, active: false },
      { type: 'organiser-toggle', id: sharedItem.id, done: true },
      { type: 'reminder-toggle', id: sharedReminder.id, done: true },
      { type: 'medication-toggle', id: sharedMedication.id, active: false },
      {
        type: 'medication-dose',
        id: sharedMedication.id,
        scheduledFor: '2030-01-15T10:00',
      },
      { type: 'purchase-status', id: publicIdea.id, status: 'bought' },
    ];
    for (const mutation of forbiddenMutations) {
      const result = await action(bob.cookie, mutation);
      assert.equal(result.response.status, 403, JSON.stringify(mutation));
    }

    assert.equal(
      (
        await action(bob.cookie, {
          type: 'purchase-vote',
          id: publicIdea.id,
          vote: 1,
        })
      ).response.status,
      200,
    );
    const afterVote = await household(alice.cookie);
    assert.equal(
      afterVote.purchaseVotes.some(
        (vote) => vote.ideaId === publicIdea.id && Number(vote.vote) === 1,
      ),
      true,
    );

    await stopServer();
    const restoreParent = await mkdtemp(join(tmpdir(), 'schwank-restore-'));
    temporaryDirectories.push(restoreParent);
    const restoredState = join(restoreParent, 'state');
    await cp(stateDirectory, restoredState, { recursive: true });
    await startServer(restoredState);

    const restoredLogin = await jsonRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email: 'alice@example.test',
        password: 'alice-password-123',
      }),
    });
    assert.equal(restoredLogin.response.status, 200);
    const restoredCookie = restoredLogin.response.headers
      .get('set-cookie')
      ?.split(';')[0];
    assert.ok(restoredCookie);
    const restoredData = await household(restoredCookie);
    assert.equal(
      restoredData.tasks.some((task) => task.title === 'Alice private task'),
      true,
    );
    assert.equal(
      restoredData.purchaseVotes.some(
        (vote) => vote.ideaId === publicIdea.id && Number(vote.vote) === 1,
      ),
      true,
    );
  },
);
