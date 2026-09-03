import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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

void test('reports versioned liveness and migration-aware readiness', async () => {
  const live = await jsonRequest('/api/health/live', {
    headers: { 'x-request-id': 'integration-live-01' },
  });
  assert.equal(live.response.status, 200);
  assert.equal(
    live.response.headers.get('x-request-id'),
    'integration-live-01',
  );
  assert.equal(live.body.ok, true);
  assert.equal(live.body.service, 'schwank-server');
  assert.equal(live.body.version, '0.1.0');
  assert.equal(live.body.apiVersion, 1);
  assert.match(live.body.serverTime, /^\d{4}-\d{2}-\d{2}T/);

  const ready = await jsonRequest('/api/health', {
    headers: { 'x-request-id': 'integration-ready-01' },
  });
  assert.equal(ready.response.status, 200);
  assert.equal(
    ready.response.headers.get('x-request-id'),
    'integration-ready-01',
  );
  assert.equal(ready.body.ok, true);
  assert.equal(ready.body.database, 'ready');
  assert.deepEqual(ready.body.schema, {
    appliedMigrations: 19,
    expectedMigrations: 19,
  });
});

void test(
  'isolates authentication and private household data between two users',
  { timeout: 90_000 },
  async () => {
    const anonymous = await jsonRequest('/api/schwank');
    assert.equal(anonymous.response.status, 401);
    assert.equal(anonymous.body.code, 'auth_required');
    const anonymousSections = await jsonRequest('/api/data?sections=tasks');
    assert.equal(anonymousSections.response.status, 401);

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
    assert.equal(rejectedOrigin.body.code, 'origin_rejected');

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
    assert.equal(bobWithoutInvite.body.code, 'registration_closed');

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
    assert.equal(invalidInvite.body.code, 'invalid_invite');

    const duplicate = await register(
      'Alice Duplicate',
      'alice@example.test',
      'another-password-123',
      invite.body.inviteCode,
    );
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.body.code, 'email_exists');

    const bob = await register(
      'Bob Test',
      'bob@example.test',
      'bob-password-12345',
      invite.body.inviteCode,
    );
    assert.equal(bob.response.status, 201);
    assert.ok(bob.cookie);
    const charlie = await register(
      'Charlie Test',
      'charlie@example.test',
      'charlie-password-123',
      invite.body.inviteCode,
    );
    assert.equal(charlie.response.status, 201);
    assert.ok(charlie.cookie);

    const memberSettings = await jsonRequest('/api/household/enrollment', {
      headers: { cookie: bob.cookie },
    });
    assert.equal(memberSettings.response.status, 403);
    assert.equal(memberSettings.body.code, 'owner_required');
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
    assert.equal(memberRotate.body.code, 'owner_required');

    for (let attempt = 1; attempt < 10; attempt += 1) {
      const rejectedRegistration = await register(
        `Rate Limit ${attempt}`,
        `register-limit-${attempt}@example.test`,
        'rate-limit-password-123',
        'WRONG-CODE',
      );
      assert.equal(rejectedRegistration.response.status, 403);
    }
    const limitedRegistration = await register(
      'Rate Limited Registration',
      'register-limit-final@example.test',
      'rate-limit-password-123',
      'WRONG-CODE',
    );
    assert.equal(limitedRegistration.response.status, 429);
    assert.equal(limitedRegistration.body.code, 'rate_limited');

    const wrongPassword = await jsonRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email: 'alice@example.test',
        password: 'wrong-password-123',
      }),
    });
    assert.equal(wrongPassword.response.status, 401);
    assert.equal(wrongPassword.body.code, 'invalid_credentials');

    const login = await jsonRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email: 'alice@example.test',
        password: 'alice-password-123',
      }),
    });
    assert.equal(login.response.status, 200);
    const loginCookie = login.response.headers.get('set-cookie')?.split(';')[0];
    assert.ok(loginCookie);

    for (let attempt = 1; attempt < 5; attempt += 1) {
      const rejectedLogin = await jsonRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({
          email: 'login-limit@example.test',
          password: `wrong-password-${attempt}`,
        }),
      });
      assert.equal(rejectedLogin.response.status, 401);
    }
    const limitedLogin = await jsonRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email: 'login-limit@example.test',
        password: 'wrong-password-final',
      }),
    });
    assert.equal(limitedLogin.response.status, 429);
    assert.equal(limitedLogin.body.code, 'rate_limited');
    const stillLimitedLogin = await jsonRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email: 'login-limit@example.test',
        password: 'another-wrong-password',
      }),
    });
    assert.equal(stillLimitedLogin.response.status, 429);
    assert.equal(stillLimitedLogin.body.code, 'rate_limited');

    const charlieId = (await household(charlie.cookie)).currentUser.id;
    const memberCannotTransfer = await jsonRequest('/api/household/members', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: bob.cookie,
        origin,
      },
      body: JSON.stringify({
        action: 'transfer',
        memberId: charlieId,
        currentPassword: 'bob-password-12345',
      }),
    });
    assert.equal(memberCannotTransfer.response.status, 403);
    assert.equal(memberCannotTransfer.body.code, 'owner_required');
    const wrongTransferPassword = await jsonRequest('/api/household/members', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: alice.cookie,
        origin,
      },
      body: JSON.stringify({
        action: 'transfer',
        memberId: charlieId,
        currentPassword: 'wrong-password',
      }),
    });
    assert.equal(wrongTransferPassword.response.status, 403);
    assert.equal(wrongTransferPassword.body.code, 'invalid_current_password');
    assert.equal(
      (
        await jsonRequest('/api/household/members', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: alice.cookie,
            origin,
          },
          body: JSON.stringify({
            action: 'transfer',
            memberId: charlieId,
            currentPassword: 'alice-password-123',
          }),
        })
      ).response.status,
      200,
    );
    assert.equal((await household(alice.cookie)).currentUser.role, 'member');
    assert.equal((await household(charlie.cookie)).currentUser.role, 'owner');
    const aliceId = (await household(alice.cookie)).currentUser.id;
    assert.equal(
      (
        await jsonRequest('/api/household/members', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: charlie.cookie,
            origin,
          },
          body: JSON.stringify({
            action: 'transfer',
            memberId: aliceId,
            currentPassword: 'charlie-password-123',
          }),
        })
      ).response.status,
      200,
    );
    assert.equal((await household(alice.cookie)).currentUser.role, 'owner');
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
        supplyRemaining: 12,
        refillThreshold: 3,
        visibility: 'shared',
      },
    ];

    const mutationShapes = {
      nutrition: ['nutrition', 'nutrition'],
      task: ['tasks', 'tasks'],
      expense: ['spending', 'expenses'],
      'recurring-payment': ['spending', 'recurringPayments'],
      organiser: ['organisers', 'organisers'],
      reminder: ['organisers', 'reminders'],
      medication: ['medications', 'medications'],
    };
    for (const record of records) {
      const created = await action(alice.cookie, record);
      assert.equal(created.response.status, 200, JSON.stringify(created.body));
      assert.equal(created.body.ok, true);
      const [scope, collection] = mutationShapes[record.type];
      assert.deepEqual(created.body.scopes, [scope]);
      assert.ok(Array.isArray(created.body.data[collection]));
      assert.equal('messages' in created.body.data, false);
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
          type: 'spending-budget',
          category: 'all',
          monthlyLimit: 25_000,
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
    const firstChatMessage = await action(alice.cookie, {
      type: 'message',
      body: 'Alice household chat message',
    });
    assert.equal(firstChatMessage.response.status, 200);
    assert.deepEqual(firstChatMessage.body.scopes, ['chat']);
    assert.deepEqual(Object.keys(firstChatMessage.body.data).sort(), [
      'messageCount',
      'messages',
      'messagesHasMore',
      'unreadMessages',
    ]);
    const firstChatMessageId = firstChatMessage.body.data.messages.at(-1).id;
    for (let index = 1; index <= 51; index += 1) {
      const createdMessage = await action(alice.cookie, {
        type: 'message',
        body: `Pagination message ${String(index).padStart(2, '0')}`,
      });
      assert.equal(createdMessage.response.status, 200);
    }
    const bobUnreadChat = await household(bob.cookie);
    assert.equal(bobUnreadChat.messageCount, 52);
    assert.equal(bobUnreadChat.messages.length, 50);
    assert.equal(bobUnreadChat.messagesHasMore, true);
    assert.equal(bobUnreadChat.unreadMessages, 52);
    const olderChat = await jsonRequest(
      `/api/chat?before=${bobUnreadChat.messages[0].id}`,
      { headers: { cookie: bob.cookie } },
    );
    assert.equal(olderChat.response.status, 200);
    assert.equal(olderChat.body.hasMore, false);
    assert.equal(olderChat.body.messages.length, 2);
    assert.equal(
      olderChat.body.messages[0].body,
      'Alice household chat message',
    );
    for (const forbiddenChatMutation of [
      {
        type: 'message-update',
        id: firstChatMessageId,
        body: 'Bob cannot edit this message',
      },
      { type: 'message-remove', id: firstChatMessageId },
    ]) {
      const denied = await action(bob.cookie, forbiddenChatMutation);
      assert.equal(denied.response.status, 403);
      assert.equal(denied.body.code, 'forbidden');
    }
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'message-update',
          id: firstChatMessageId,
          body: 'Alice household chat message corrected',
        })
      ).response.status,
      200,
    );
    const correctedOlderChat = await jsonRequest(
      `/api/chat?before=${bobUnreadChat.messages[0].id}`,
      { headers: { cookie: bob.cookie } },
    );
    assert.equal(
      correctedOlderChat.body.messages[0].body,
      'Alice household chat message corrected',
    );
    assert.ok(correctedOlderChat.body.messages[0].editedAt);
    const newestChatMessage = bobUnreadChat.messages.at(-1);
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'message-remove',
          id: newestChatMessage.id,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await action(bob.cookie, {
          type: 'message-read',
        })
      ).response.status,
      200,
    );
    assert.equal((await household(bob.cookie)).unreadMessages, 0);

    assert.equal(
      (
        await action(alice.cookie, {
          type: 'food-add',
          name: 'Policy test rice',
          quantity: 2,
          unit: 'kg',
          category: 'Dry goods',
        })
      ).response.status,
      200,
    );
    const sharedFood = (await household(bob.cookie)).foods.find(
      (food) => food.name === 'Policy test rice',
    );
    assert.ok(sharedFood);
    assert.equal(
      (
        await action(bob.cookie, {
          type: 'food-adjust',
          id: sharedFood.id,
          delta: 1,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await action(bob.cookie, {
          type: 'food-update',
          id: sharedFood.id,
          name: 'Policy test rice corrected',
          quantity: 3,
          unit: 'kg',
          category: 'pantry',
        })
      ).response.status,
      200,
    );
    assert.equal(
      (await household(alice.cookie)).foods.find(
        (food) => food.id === sharedFood.id,
      ).name,
      'Policy test rice corrected',
    );

    assert.equal(
      (
        await action(alice.cookie, {
          type: 'recipe-add',
          name: 'Policy test porridge',
          course: 'breakfast',
          servings: 3,
          instructions: 'Synthetic integration recipe',
          ingredients: [
            { name: 'Policy test rice corrected', quantity: 600, unit: 'g' },
          ],
        })
      ).response.status,
      200,
    );
    const sharedRecipe = (await household(bob.cookie)).recipes.find(
      (recipe) => recipe.name === 'Policy test porridge',
    );
    assert.ok(sharedRecipe);
    assert.equal(
      (
        await action(bob.cookie, {
          type: 'recipe-update',
          id: sharedRecipe.id,
          name: 'Policy test rice bowl',
          course: 'starter',
          servings: 6,
          instructions: 'Corrected synthetic integration recipe',
          ingredients: [
            {
              name: 'Policy test rice corrected',
              quantity: 600,
              unit: 'g',
            },
          ],
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'recipe-cook',
          id: sharedRecipe.id,
          servings: 3,
        })
      ).response.status,
      200,
    );
    assert.equal(
      Number(
        (await household(bob.cookie)).foods.find(
          (food) => food.id === sharedFood.id,
        ).quantity,
      ),
      2.7,
    );
    const insufficientCook = await action(bob.cookie, {
      type: 'recipe-cook',
      id: sharedRecipe.id,
      servings: 100,
    });
    assert.equal(insufficientCook.response.status, 400);
    assert.equal(insufficientCook.body.code, 'validation_failed');
    assert.equal(
      Number(
        (await household(alice.cookie)).foods.find(
          (food) => food.id === sharedFood.id,
        ).quantity,
      ),
      2.7,
    );
    assert.equal(
      (
        await action(bob.cookie, {
          type: 'meal-plan-save',
          weekStart: today,
          entries: [
            {
              dayIndex: 0,
              course: 'starter',
              recipeId: sharedRecipe.id,
              servings: 5,
            },
          ],
        })
      ).response.status,
      200,
    );
    assert.equal(
      (await household(alice.cookie)).weeklyPlan.find(
        (meal) => meal.recipeId === sharedRecipe.id,
      ).servings,
      5,
    );
    const duplicateMeal = await action(bob.cookie, {
      type: 'meal-plan-save',
      weekStart: today,
      entries: [
        {
          dayIndex: 0,
          course: 'starter',
          recipeId: sharedRecipe.id,
          servings: 3,
        },
        {
          dayIndex: 0,
          course: 'starter',
          recipeId: sharedRecipe.id,
          servings: 3,
        },
      ],
    });
    assert.equal(duplicateMeal.response.status, 400);
    assert.equal(duplicateMeal.body.code, 'validation_failed');
    assert.equal(
      (
        await action(bob.cookie, {
          type: 'food-remove',
          id: sharedFood.id,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await action(bob.cookie, {
          type: 'recipe-remove',
          id: sharedRecipe.id,
        })
      ).response.status,
      200,
    );
    const memberHomeChange = await action(bob.cookie, {
      type: 'home',
      name: 'Bob cannot rename the home',
      address: 'Synthetic address',
    });
    assert.equal(memberHomeChange.response.status, 403);
    assert.equal(memberHomeChange.body.code, 'owner_required');
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'home',
          name: 'Policy test home',
          address: 'Synthetic address',
        })
      ).response.status,
      200,
    );
    assert.equal((await household(alice.cookie)).home.name, 'Policy test home');

    const onePixelPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const avatarUpdate = await action(alice.cookie, {
      type: 'avatar',
      avatar: onePixelPng,
    });
    assert.equal(avatarUpdate.response.status, 200);
    assert.deepEqual(avatarUpdate.body.scopes, ['account']);
    assert.equal(avatarUpdate.body.data.currentUser.avatar, onePixelPng);
    assert.ok(Array.isArray(avatarUpdate.body.data.members));
    const spoofedImage = await action(alice.cookie, {
      type: 'avatar',
      avatar: onePixelPng.replace('image/png', 'image/jpeg'),
    });
    assert.equal(spoofedImage.response.status, 400);
    assert.equal(spoofedImage.body.code, 'image_invalid');
    const oversizedImage = await action(alice.cookie, {
      type: 'avatar',
      avatar: `data:image/png;base64,${'A'.repeat(430_000)}`,
    });
    assert.equal(oversizedImage.response.status, 413);
    assert.equal(oversizedImage.body.code, 'image_too_large');

    const aliceData = await household(alice.cookie);
    const bobData = await household(bob.cookie);
    const invalidSections = await jsonRequest('/api/data?sections=unknown', {
      headers: { cookie: alice.cookie },
    });
    assert.equal(invalidSections.response.status, 400);
    assert.equal(
      (await jsonRequest('/api/history?kind=nutrition')).response.status,
      401,
    );
    assert.equal(
      (
        await jsonRequest('/api/history?kind=nutrition&beforeDate=2026-09-01', {
          headers: { cookie: alice.cookie },
        })
      ).response.status,
      400,
    );
    const bobTaskSection = await jsonRequest(
      '/api/data?sections=tasks,spending',
      { headers: { cookie: bob.cookie } },
    );
    assert.equal(bobTaskSection.response.status, 200);
    assert.deepEqual(Object.keys(bobTaskSection.body).sort(), [
      'completedTaskCount',
      'completedTasksHasMore',
      'expenseCount',
      'expenseTotal',
      'expenses',
      'expensesHasMore',
      'recurringPayments',
      'spendingBudgets',
      'tasks',
    ]);
    assert.equal(
      bobTaskSection.body.tasks.some(
        (task) => task.title === 'Alice private task',
      ),
      false,
    );
    assert.equal(
      bobTaskSection.body.tasks.some(
        (task) => task.title === 'Alice shared task',
      ),
      true,
    );
    const bobSerialized = JSON.stringify(bobData);

    assert.deepEqual(
      aliceData.nutritionHistory.map((meal) => meal.label).sort(),
      ['Alice private meal', 'Alice shared meal'],
    );
    assert.deepEqual(bobData.nutritionHistory, []);

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
    assert.equal(bobData.messageCount, 51);
    assert.equal(bobData.messages.length, 50);
    assert.equal(bobData.messagesHasMore, true);
    assert.equal(bobData.unreadMessages, 0);
    assert.equal(
      bobData.members.find((member) => member.name === 'Alice Test').role,
      'owner',
    );

    assert.equal(aliceData.notificationPreferences.advanceMinutes, 4320);
    assert.deepEqual(aliceData.notificationStates, []);
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'notification-preferences',
          enabled: true,
          medicationsEnabled: true,
          paymentsEnabled: true,
          tasksEnabled: true,
          remindersEnabled: true,
          chatEnabled: false,
          advanceMinutes: 60,
          quietHoursEnabled: false,
          quietStart: '23:00',
          quietEnd: '07:00',
          timezone: 'Europe/Moscow',
        })
      ).response.status,
      200,
    );
    const aliceNotificationData = await household(alice.cookie);
    const bobNotificationData = await household(bob.cookie);
    assert.equal(aliceNotificationData.notificationPreferences.chatEnabled, 0);
    assert.equal(
      aliceNotificationData.notificationPreferences.advanceMinutes,
      60,
    );
    assert.equal(bobNotificationData.notificationPreferences.chatEnabled, true);
    assert.equal(
      bobNotificationData.notificationPreferences.advanceMinutes,
      4320,
    );

    const rejectedNotificationOrigin = await jsonRequest('/api/notifications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: alice.cookie,
        origin: 'https://attacker.invalid',
      },
      body: JSON.stringify({
        events: [{ key: 'task:999:2030-01-01', category: 'tasks' }],
      }),
    });
    assert.equal(rejectedNotificationOrigin.response.status, 403);

    const claimedNotifications = await jsonRequest('/api/notifications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: alice.cookie,
        origin,
      },
      body: JSON.stringify({
        events: [
          { key: 'task:999:2030-01-01', category: 'tasks' },
          { key: 'chat:999', category: 'tasks' },
        ],
      }),
    });
    assert.deepEqual(claimedNotifications.body.claimed, [
      'task:999:2030-01-01',
    ]);
    const duplicateClaim = await jsonRequest('/api/notifications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: alice.cookie,
        origin,
      },
      body: JSON.stringify({
        events: [{ key: 'task:999:2030-01-01', category: 'tasks' }],
      }),
    });
    assert.deepEqual(duplicateClaim.body.claimed, []);
    const bobIndependentClaim = await jsonRequest('/api/notifications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: bob.cookie,
        origin,
      },
      body: JSON.stringify({
        events: [{ key: 'task:999:2030-01-01', category: 'tasks' }],
      }),
    });
    assert.deepEqual(bobIndependentClaim.body.claimed, ['task:999:2030-01-01']);
    const snoozedNotification = await action(alice.cookie, {
      type: 'notification-snooze',
      eventKey: 'task:999:2030-01-01',
      minutes: 15,
    });
    assert.equal(snoozedNotification.response.status, 200);
    const aliceNotificationState =
      snoozedNotification.body.data.notificationStates.find(
        (state) => state.eventKey === 'task:999:2030-01-01',
      );
    assert.equal(aliceNotificationState.deliveredAt, null);
    assert.ok(aliceNotificationState.snoozedUntil);
    const snoozedClaim = await jsonRequest('/api/notifications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: alice.cookie,
        origin,
      },
      body: JSON.stringify({
        events: [{ key: 'task:999:2030-01-01', category: 'tasks' }],
      }),
    });
    assert.deepEqual(snoozedClaim.body.claimed, []);

    const anonymousUpdates = await jsonRequest('/api/updates');
    assert.equal(anonymousUpdates.response.status, 401);
    const invalidUpdateCursor = await jsonRequest(
      '/api/updates?after=invalid',
      {
        headers: { cookie: alice.cookie },
      },
    );
    assert.equal(invalidUpdateCursor.response.status, 400);
    const aliceUpdateBaseline = await jsonRequest('/api/updates', {
      headers: { cookie: alice.cookie },
    });
    const bobUpdateBaseline = await jsonRequest('/api/updates', {
      headers: { cookie: bob.cookie },
    });
    assert.deepEqual(aliceUpdateBaseline.body.scopes, []);
    assert.deepEqual(bobUpdateBaseline.body.scopes, []);
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'task',
          title: 'Alice live private task',
          tag: 'Live',
          dueOn: '2030-01-02',
          visibility: 'private',
        })
      ).response.status,
      200,
    );
    const alicePrivateUpdate = await jsonRequest(
      `/api/updates?after=${aliceUpdateBaseline.body.cursor}`,
      { headers: { cookie: alice.cookie } },
    );
    const bobPrivateUpdate = await jsonRequest(
      `/api/updates?after=${bobUpdateBaseline.body.cursor}`,
      { headers: { cookie: bob.cookie } },
    );
    assert.deepEqual(alicePrivateUpdate.body.scopes, ['tasks']);
    assert.deepEqual(bobPrivateUpdate.body.scopes, []);
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'task',
          title: 'Alice live shared task',
          tag: 'Live',
          dueOn: '2030-01-03',
          visibility: 'shared',
        })
      ).response.status,
      200,
    );
    const aliceSharedUpdate = await jsonRequest(
      `/api/updates?after=${alicePrivateUpdate.body.cursor}`,
      { headers: { cookie: alice.cookie } },
    );
    const bobSharedUpdate = await jsonRequest(
      `/api/updates?after=${bobPrivateUpdate.body.cursor}`,
      { headers: { cookie: bob.cookie } },
    );
    assert.deepEqual(aliceSharedUpdate.body.scopes, ['tasks']);
    assert.deepEqual(bobSharedUpdate.body.scopes, ['tasks']);
    const chatSnapshot = await jsonRequest('/api/chat', {
      headers: { cookie: bob.cookie },
    });
    assert.equal(chatSnapshot.response.status, 200);
    assert.equal(chatSnapshot.body.messageCount, 51);
    assert.equal(chatSnapshot.body.messages.length, 50);
    assert.equal(chatSnapshot.body.hasMore, true);
    assert.equal(chatSnapshot.body.unreadMessages, 0);

    const sharedTask = bobData.tasks.find(
      (task) => task.title === 'Alice shared task',
    );
    const sharedMeal = bobData.nutrition.find(
      (meal) => meal.label === 'Alice shared meal',
    );
    const sharedExpense = bobData.expenses.find(
      (expense) => expense.label === 'Alice shared expense',
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
    const aliceWater = aliceData.water.find(
      (entry) => Number(entry.amountMl) === 450,
    );
    const publicHabit = bobData.habits.find(
      (entry) => entry.name === 'Alice Test',
    );
    const publicIdea = bobData.purchaseIdeas.find(
      (idea) => idea.title === 'Alice public purchase idea',
    );
    assert.ok(
      sharedMeal &&
        sharedTask &&
        sharedExpense &&
        sharedPayment &&
        sharedItem &&
        sharedReminder,
    );
    assert.ok(sharedMedication && aliceWater && publicHabit && publicIdea);

    const forbiddenMutations = [
      {
        type: 'nutrition-update',
        id: sharedMeal.id,
        label: 'Bob cannot edit this meal',
        calories: 700,
        protein: 40,
        carbs: 70,
        fat: 25,
        eatenOn: today,
        visibility: 'shared',
      },
      { type: 'nutrition-remove', id: sharedMeal.id },
      { type: 'task-status', id: sharedTask.id, status: 'done' },
      {
        type: 'task-update',
        id: sharedTask.id,
        title: 'Bob cannot edit this task',
        tag: 'Shared',
        dueOn: '2030-01-11',
        assigneeId: bobData.currentUser.id,
        visibility: 'shared',
      },
      { type: 'task-remove', id: sharedTask.id },
      {
        type: 'expense-update',
        id: sharedExpense.id,
        label: 'Bob cannot edit this expense',
        amount: 250,
        category: 'groceries',
        spentOn: today,
        visibility: 'shared',
      },
      { type: 'expense-remove', id: sharedExpense.id },
      { type: 'recurring-payment-toggle', id: sharedPayment.id, active: false },
      { type: 'recurring-payment-pay', id: sharedPayment.id },
      {
        type: 'recurring-payment-update',
        id: sharedPayment.id,
        kind: 'rent',
        label: 'Bob cannot edit this payment',
        amount: 450,
        billingCycle: 'monthly',
        nextDueOn: '2030-01-13',
        visibility: 'shared',
      },
      { type: 'recurring-payment-remove', id: sharedPayment.id },
      { type: 'organiser-toggle', id: sharedItem.id, done: true },
      {
        type: 'organiser-update',
        id: sharedItem.id,
        list: 'Bob cannot move this item',
        label: 'Bob cannot edit this item',
        visibility: 'shared',
      },
      { type: 'organiser-remove', id: sharedItem.id },
      { type: 'reminder-toggle', id: sharedReminder.id, done: true },
      {
        type: 'reminder-update',
        id: sharedReminder.id,
        label: 'Bob cannot edit this reminder',
        remindAt: '2030-01-15T10:00',
        recurrence: 'weekly',
        visibility: 'shared',
      },
      {
        type: 'reminder-snooze',
        id: sharedReminder.id,
        minutes: 60,
        snoozeUntil: '2030-01-15T10:00',
      },
      { type: 'reminder-to-task', id: sharedReminder.id },
      { type: 'reminder-remove', id: sharedReminder.id },
      { type: 'medication-toggle', id: sharedMedication.id, active: false },
      {
        type: 'medication-update',
        id: sharedMedication.id,
        name: 'Bob cannot edit this medication',
        dosage: '2 tablets',
        instructions: 'Synthetic test record',
        scheduleTimes: '10:00',
        startOn: '2029-01-01',
        endOn: '2030-12-31',
        supplyRemaining: 12,
        refillThreshold: 3,
        visibility: 'shared',
      },
      { type: 'medication-remove', id: sharedMedication.id },
      {
        type: 'medication-dose',
        id: sharedMedication.id,
        scheduledFor: '2030-01-15T10:00',
      },
      {
        type: 'water-update',
        id: aliceWater.id,
        amountMl: 500,
        drunkOn: today,
      },
      { type: 'water-remove', id: aliceWater.id },
      {
        type: 'habit-update',
        id: publicHabit.id,
        habit: 'alcohol',
        occurrences: 2,
        cost: 100,
        occurredOn: today,
      },
      { type: 'habit-remove', id: publicHabit.id },
      {
        type: 'purchase-idea-update',
        id: publicIdea.id,
        title: 'Bob cannot edit this idea',
        description: 'Synthetic test record',
        estimatedCost: 2_000,
      },
      { type: 'purchase-status', id: publicIdea.id, status: 'bought' },
    ];
    for (const mutation of forbiddenMutations) {
      const result = await action(bob.cookie, mutation);
      assert.equal(
        result.response.status,
        403,
        JSON.stringify({ mutation, body: result.body }),
      );
      assert.equal(result.body.code, 'forbidden', JSON.stringify(mutation));
    }

    const organiserCreate = await action(alice.cookie, {
      type: 'organiser',
      list: 'Correctable list',
      label: 'Correctable item',
      visibility: 'shared',
    });
    assert.equal(organiserCreate.response.status, 200);
    const correctableItem = organiserCreate.body.data.organisers.find(
      (item) => item.label === 'Correctable item',
    );
    assert.ok(correctableItem);
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'organiser-update',
          id: correctableItem.id,
          list: 'Moved list',
          label: 'Corrected item',
          visibility: 'shared',
        })
      ).response.status,
      200,
    );
    assert.equal(
      (await household(bob.cookie)).organisers.some(
        (item) => item.id === correctableItem.id && item.list === 'Moved list',
      ),
      true,
    );

    const recurringReminderCreate = await action(alice.cookie, {
      type: 'reminder',
      label: 'Recurring household reminder',
      remindAt: '2030-01-20T09:00',
      recurrence: 'daily',
      visibility: 'shared',
    });
    assert.equal(recurringReminderCreate.response.status, 200);
    const recurringReminder = recurringReminderCreate.body.data.reminders.find(
      (reminder) => reminder.label === 'Recurring household reminder',
    );
    assert.ok(recurringReminder);
    assert.equal(recurringReminder.recurrence, 'daily');
    const advancedReminder = await action(alice.cookie, {
      type: 'reminder-toggle',
      id: recurringReminder.id,
      done: true,
    });
    assert.equal(advancedReminder.response.status, 200);
    const nextRecurringReminder = advancedReminder.body.data.reminders.find(
      (reminder) => reminder.id === recurringReminder.id,
    );
    assert.equal(nextRecurringReminder.remindAt, '2030-01-21T09:00');
    assert.equal(Boolean(nextRecurringReminder.done), false);
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'reminder-to-task',
          id: recurringReminder.id,
        })
      ).response.status,
      400,
    );

    const taskReminderCreate = await action(alice.cookie, {
      type: 'reminder',
      label: 'Reminder to convert',
      remindAt: '2030-02-01T10:30',
      recurrence: 'none',
      visibility: 'shared',
    });
    assert.equal(taskReminderCreate.response.status, 200);
    const taskReminder = taskReminderCreate.body.data.reminders.find(
      (reminder) => reminder.label === 'Reminder to convert',
    );
    assert.ok(taskReminder);
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'reminder-update',
          id: taskReminder.id,
          label: 'Corrected reminder to convert',
          remindAt: '2030-02-02T11:00',
          recurrence: 'none',
          visibility: 'shared',
        })
      ).response.status,
      200,
    );
    const snoozedReminder = await action(alice.cookie, {
      type: 'reminder-snooze',
      id: taskReminder.id,
      minutes: 15,
      snoozeUntil: '2030-02-02T11:15',
    });
    assert.equal(snoozedReminder.response.status, 200);
    assert.match(
      snoozedReminder.body.data.reminders.find(
        (reminder) => reminder.id === taskReminder.id,
      ).remindAt,
      /^2030-02-02T11:15$/,
    );
    for (let attempt = 0; attempt < 2; attempt += 1)
      assert.equal(
        (
          await action(alice.cookie, {
            type: 'reminder-to-task',
            id: taskReminder.id,
          })
        ).response.status,
        200,
      );
    const convertedData = await household(alice.cookie);
    const convertedTasks = convertedData.tasks.filter(
      (task) => Number(task.sourceReminderId) === taskReminder.id,
    );
    assert.equal(convertedTasks.length, 1);
    assert.equal(convertedTasks[0].title, 'Corrected reminder to convert');
    assert.equal(convertedTasks[0].visibility, 'shared');
    const convertedReminder = convertedData.reminders.find(
      (reminder) => reminder.id === taskReminder.id,
    );
    assert.equal(Boolean(convertedReminder.done), true);
    assert.equal(convertedReminder.convertedTaskId, convertedTasks[0].id);
    assert.equal(
      (await household(bob.cookie)).tasks.some(
        (task) => task.id === convertedTasks[0].id,
      ),
      true,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'reminder-remove',
          id: taskReminder.id,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (await household(alice.cookie)).tasks.some(
        (task) => task.id === convertedTasks[0].id,
      ),
      true,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'reminder-remove',
          id: recurringReminder.id,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'organiser-remove',
          id: correctableItem.id,
        })
      ).response.status,
      200,
    );

    const yesterdayDate = new Date(`${today}T12:00:00Z`);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);
    const historicalMealResult = await action(alice.cookie, {
      type: 'nutrition',
      label: 'Correctable historical meal',
      calories: 410,
      protein: 31,
      carbs: 42,
      fat: 14,
      eatenOn: yesterday,
      visibility: 'shared',
    });
    assert.equal(historicalMealResult.response.status, 200);
    const historicalMeal = historicalMealResult.body.data.nutritionHistory.find(
      (meal) => meal.label === 'Correctable historical meal',
    );
    assert.ok(historicalMeal);
    assert.equal(
      historicalMealResult.body.data.nutrition.some(
        (meal) => meal.id === historicalMeal.id,
      ),
      false,
    );
    assert.equal(
      (await household(bob.cookie)).nutritionHistory.some(
        (meal) => meal.id === historicalMeal.id,
      ),
      false,
    );
    const correctedMealResult = await action(alice.cookie, {
      type: 'nutrition-update',
      id: historicalMeal.id,
      label: 'Corrected private meal',
      calories: 375,
      protein: 29,
      carbs: 38,
      fat: 12,
      eatenOn: today,
      visibility: 'private',
    });
    assert.equal(correctedMealResult.response.status, 200);
    const correctedMeal = correctedMealResult.body.data.nutritionHistory.find(
      (meal) => meal.id === historicalMeal.id,
    );
    assert.equal(correctedMeal.label, 'Corrected private meal');
    assert.equal(correctedMeal.calories, 375);
    assert.equal(correctedMeal.eatenOn, today);
    assert.equal(
      (await household(bob.cookie)).nutrition.some(
        (meal) => meal.id === historicalMeal.id,
      ),
      false,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'nutrition-remove',
          id: historicalMeal.id,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (await household(alice.cookie)).nutritionHistory.some(
        (meal) => meal.id === historicalMeal.id,
      ),
      false,
    );

    const updatedMedicationResult = await action(alice.cookie, {
      type: 'medication-update',
      id: sharedMedication.id,
      name: 'Corrected private medication',
      dosage: '1 tablet',
      instructions: 'Corrected synthetic record',
      scheduleTimes: '10:00, 20:00',
      startOn: today,
      endOn: '',
      supplyRemaining: 5,
      refillThreshold: 2,
      visibility: 'private',
    });
    assert.equal(updatedMedicationResult.response.status, 200);
    const correctedMedication =
      updatedMedicationResult.body.data.medications.find(
        (medication) => medication.id === sharedMedication.id,
      );
    assert.equal(correctedMedication.name, 'Corrected private medication');
    assert.deepEqual(correctedMedication.scheduleTimes, ['10:00', '20:00']);
    assert.equal(correctedMedication.supplyRemaining, 5);
    assert.equal(
      (await household(bob.cookie)).medications.some(
        (medication) => medication.id === sharedMedication.id,
      ),
      false,
    );
    const doseResult = await action(alice.cookie, {
      type: 'medication-dose',
      id: sharedMedication.id,
      scheduledFor: `${today}T10:00`,
    });
    assert.equal(doseResult.response.status, 200);
    const dosedMedication = doseResult.body.data.medications.find(
      (medication) => medication.id === sharedMedication.id,
    );
    const recordedDose = doseResult.body.data.medicationDoses.find(
      (dose) => dose.medicationId === sharedMedication.id,
    );
    assert.equal(dosedMedication.supplyRemaining, 4);
    assert.ok(recordedDose);
    const duplicateDoseResult = await action(alice.cookie, {
      type: 'medication-dose',
      id: sharedMedication.id,
      scheduledFor: `${today}T10:00`,
    });
    assert.equal(duplicateDoseResult.response.status, 200);
    assert.equal(
      duplicateDoseResult.body.data.medications.find(
        (medication) => medication.id === sharedMedication.id,
      ).supplyRemaining,
      4,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'medication-dose-remove',
          id: recordedDose.id,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'medication-dose-remove',
          id: recordedDose.id,
        })
      ).response.status,
      403,
    );
    assert.equal(
      (await household(alice.cookie)).medications.find(
        (medication) => medication.id === sharedMedication.id,
      ).supplyRemaining,
      5,
    );

    const correctedWaterResult = await action(alice.cookie, {
      type: 'water-update',
      id: aliceWater.id,
      amountMl: 600,
      drunkOn: yesterday,
    });
    assert.equal(correctedWaterResult.response.status, 200);
    assert.equal(
      correctedWaterResult.body.data.water.find(
        (entry) => entry.id === aliceWater.id,
      ).amountMl,
      600,
    );
    assert.equal((await household(bob.cookie)).water.length, 0);
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'water-remove',
          id: aliceWater.id,
        })
      ).response.status,
      200,
    );

    const correctedHabitResult = await action(alice.cookie, {
      type: 'habit-update',
      id: publicHabit.id,
      habit: 'alcohol',
      occurrences: 2,
      cost: 100,
      occurredOn: yesterday,
    });
    assert.equal(correctedHabitResult.response.status, 200);
    const correctedHabit = correctedHabitResult.body.data.habits.find(
      (entry) => entry.id === publicHabit.id,
    );
    assert.equal(correctedHabit.habit, 'alcohol');
    assert.equal(correctedHabit.occurrences, 2);
    assert.equal(
      (await household(bob.cookie)).habits.find(
        (entry) => entry.id === publicHabit.id,
      ).cost,
      100,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'habit-remove',
          id: publicHabit.id,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (await household(bob.cookie)).habits.some(
        (entry) => entry.id === publicHabit.id,
      ),
      false,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'medication-remove',
          id: sharedMedication.id,
        })
      ).response.status,
      200,
    );

    const historicalExpenseResult = await action(alice.cookie, {
      type: 'expense',
      label: 'Correctable historical expense',
      amount: 321,
      category: 'other',
      spentOn: '2026-01-15',
      visibility: 'shared',
    });
    assert.equal(historicalExpenseResult.response.status, 200);
    const historicalExpense = historicalExpenseResult.body.data.expenses.find(
      (expense) => expense.label === 'Correctable historical expense',
    );
    assert.ok(historicalExpense);
    assert.equal(historicalExpense.spentOn, '2026-01-15');
    assert.equal(
      (
        await action(bob.cookie, {
          type: 'expense-remove',
          id: historicalExpense.id,
        })
      ).response.status,
      403,
    );
    const correctedExpenseResult = await action(alice.cookie, {
      type: 'expense-update',
      id: historicalExpense.id,
      label: 'Corrected private expense',
      amount: 123.45,
      category: 'utilities',
      spentOn: '2026-02-16',
      visibility: 'private',
    });
    assert.equal(correctedExpenseResult.response.status, 200);
    const correctedExpense = correctedExpenseResult.body.data.expenses.find(
      (expense) => expense.id === historicalExpense.id,
    );
    assert.equal(correctedExpense.amount, 123.45);
    assert.equal(correctedExpense.spentOn, '2026-02-16');
    assert.equal(
      (await household(bob.cookie)).expenses.some(
        (expense) => expense.id === historicalExpense.id,
      ),
      false,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'expense-remove',
          id: historicalExpense.id,
        })
      ).response.status,
      200,
    );

    const budgetResult = await action(alice.cookie, {
      type: 'spending-budget',
      category: 'groceries',
      monthlyLimit: 15_000,
    });
    assert.equal(budgetResult.response.status, 200);
    const groceryBudget = budgetResult.body.data.spendingBudgets.find(
      (budget) => budget.category === 'groceries',
    );
    assert.ok(groceryBudget);
    assert.equal((await household(bob.cookie)).spendingBudgets.length, 0);
    assert.equal(
      (
        await action(bob.cookie, {
          type: 'spending-budget-remove',
          id: groceryBudget.id,
        })
      ).response.status,
      403,
    );
    const updatedBudgetResult = await action(alice.cookie, {
      type: 'spending-budget',
      category: 'groceries',
      monthlyLimit: 18_000,
    });
    assert.equal(updatedBudgetResult.response.status, 200);
    assert.equal(
      updatedBudgetResult.body.data.spendingBudgets.filter(
        (budget) => budget.category === 'groceries',
      ).length,
      1,
    );
    assert.equal(
      updatedBudgetResult.body.data.spendingBudgets.find(
        (budget) => budget.category === 'groceries',
      ).monthlyLimit,
      18_000,
    );

    const updatedPaymentResult = await action(alice.cookie, {
      type: 'recurring-payment-update',
      id: sharedPayment.id,
      kind: 'rent',
      label: 'Updated shared rent',
      amount: 450,
      billingCycle: 'monthly',
      nextDueOn: '2030-01-13',
      visibility: 'shared',
    });
    assert.equal(updatedPaymentResult.response.status, 200);
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'recurring-payment-pay',
          id: sharedPayment.id,
        })
      ).response.status,
      200,
    );
    const paymentHistoryExpense = (await household(bob.cookie)).expenses.find(
      (expense) => expense.recurringPaymentId === sharedPayment.id,
    );
    assert.ok(paymentHistoryExpense);
    assert.equal(paymentHistoryExpense.label, 'Updated shared rent');
    assert.equal(paymentHistoryExpense.amount, 450);
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'recurring-payment-remove',
          id: sharedPayment.id,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (await household(alice.cookie)).expenses.some(
        (expense) => expense.id === paymentHistoryExpense.id,
      ),
      true,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'spending-budget-remove',
          id: groceryBudget.id,
        })
      ).response.status,
      200,
    );

    const privateAssignment = await action(alice.cookie, {
      type: 'task',
      title: 'Invalid private assignment',
      tag: 'Policy',
      dueOn: '2030-02-01',
      assigneeId: bobData.currentUser.id,
      visibility: 'private',
    });
    assert.equal(privateAssignment.response.status, 400);
    assert.equal(privateAssignment.body.code, 'validation_failed');

    const assignedTaskResult = await action(alice.cookie, {
      type: 'task',
      title: 'Alice assigned task',
      tag: 'Shared',
      dueOn: '2030-02-02',
      assigneeId: bobData.currentUser.id,
      visibility: 'shared',
    });
    assert.equal(assignedTaskResult.response.status, 200);
    const assignedTask = assignedTaskResult.body.data.tasks.find(
      (task) => task.title === 'Alice assigned task',
    );
    assert.ok(assignedTask);
    assert.equal(Number(assignedTask.assigneeId), bobData.currentUser.id);
    assert.equal(Boolean(assignedTask.assignedToMe), false);

    const assignedForBob = (await household(bob.cookie)).tasks.find(
      (task) => task.id === assignedTask.id,
    );
    assert.ok(assignedForBob);
    assert.equal(Boolean(assignedForBob.assignedToMe), true);
    assert.equal(assignedForBob.assigneeName, 'Bob Test');
    assert.equal(
      (
        await action(bob.cookie, {
          type: 'task-status',
          id: assignedTask.id,
          status: 'done',
        })
      ).response.status,
      200,
    );
    for (const ownerOnlyMutation of [
      {
        type: 'task-update',
        id: assignedTask.id,
        title: 'Bob edited the task',
        tag: 'Shared',
        dueOn: '2030-02-02',
        assigneeId: bobData.currentUser.id,
        visibility: 'shared',
      },
      { type: 'task-remove', id: assignedTask.id },
    ]) {
      const result = await action(bob.cookie, ownerOnlyMutation);
      assert.equal(result.response.status, 403);
      assert.equal(result.body.code, 'forbidden');
    }

    const updatedTaskResult = await action(alice.cookie, {
      type: 'task-update',
      id: assignedTask.id,
      title: 'Alice private follow-up',
      tag: 'Private',
      dueOn: '2030-02-03',
      assigneeId: aliceData.currentUser.id,
      visibility: 'private',
    });
    assert.equal(updatedTaskResult.response.status, 200);
    const updatedTask = updatedTaskResult.body.data.tasks.find(
      (task) => task.id === assignedTask.id,
    );
    assert.equal(updatedTask.title, 'Alice private follow-up');
    assert.equal(updatedTask.status, 'done');
    assert.equal(updatedTask.visibility, 'private');
    assert.equal(
      (await household(bob.cookie)).tasks.some(
        (task) => task.id === assignedTask.id,
      ),
      false,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'task-remove',
          id: assignedTask.id,
        })
      ).response.status,
      200,
    );
    assert.equal(
      (await household(alice.cookie)).tasks.some(
        (task) => task.id === assignedTask.id,
      ),
      false,
    );

    const unknownAction = await action(bob.cookie, {
      type: 'not-a-real-action',
    });
    assert.equal(unknownAction.response.status, 400);
    assert.equal(unknownAction.body.code, 'unknown_action');

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
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'purchase-idea-update',
          id: publicIdea.id,
          title: 'Edited household purchase idea',
          description: 'Corrected by its author',
          estimatedCost: 1_250,
        })
      ).response.status,
      200,
    );
    const editedIdea = (await household(bob.cookie)).purchaseIdeas.find(
      (idea) => idea.id === publicIdea.id,
    );
    assert.equal(editedIdea.title, 'Edited household purchase idea');
    assert.equal(Number(editedIdea.estimatedCost), 1_250);
    assert.ok(editedIdea.updatedAt);
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'purchase-status',
          id: publicIdea.id,
          status: 'archived',
        })
      ).response.status,
      200,
    );
    const archivedData = await household(bob.cookie);
    assert.equal(
      archivedData.purchaseIdeas.find((idea) => idea.id === publicIdea.id)
        .status,
      'archived',
    );
    assert.equal(
      archivedData.purchaseVotes.some((vote) => vote.ideaId === publicIdea.id),
      true,
    );
    assert.equal(
      (
        await action(alice.cookie, {
          type: 'purchase-status',
          id: publicIdea.id,
          status: 'open',
        })
      ).response.status,
      200,
    );

    const sessionInventory = await jsonRequest('/api/account/sessions', {
      headers: { cookie: loginCookie },
    });
    assert.equal(sessionInventory.response.status, 200);
    assert.equal(sessionInventory.body.sessions.length, 2);
    assert.equal(
      sessionInventory.body.sessions.filter((session) => session.current)
        .length,
      1,
    );
    const oldSession = sessionInventory.body.sessions.find(
      (session) => !session.current,
    );
    assert.ok(oldSession);
    const crossUserSession = await jsonRequest('/api/account/sessions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: bob.cookie,
        origin,
      },
      body: JSON.stringify({ sessionId: oldSession.id }),
    });
    assert.equal(crossUserSession.response.status, 404);
    assert.equal(crossUserSession.body.code, 'not_found');
    const revoked = await jsonRequest('/api/account/sessions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: loginCookie,
        origin,
      },
      body: JSON.stringify({ sessionId: oldSession.id }),
    });
    assert.equal(revoked.response.status, 200);
    assert.equal(revoked.body.currentRevoked, false);
    assert.equal(
      (await jsonRequest('/api/schwank', { headers: { cookie: alice.cookie } }))
        .response.status,
      401,
    );

    const wrongCurrentPassword = await jsonRequest('/api/account/password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: loginCookie,
        origin,
      },
      body: JSON.stringify({
        currentPassword: 'incorrect-current-password',
        newPassword: 'alice-new-password-456',
      }),
    });
    assert.equal(wrongCurrentPassword.response.status, 403);
    assert.equal(wrongCurrentPassword.body.code, 'invalid_current_password');

    const reusedPassword = await jsonRequest('/api/account/password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: loginCookie,
        origin,
      },
      body: JSON.stringify({
        currentPassword: 'alice-password-123',
        newPassword: 'alice-password-123',
      }),
    });
    assert.equal(reusedPassword.response.status, 400);
    assert.equal(reusedPassword.body.code, 'password_reuse');

    const changedPassword = await jsonRequest('/api/account/password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: loginCookie,
        origin,
      },
      body: JSON.stringify({
        currentPassword: 'alice-password-123',
        newPassword: 'alice-new-password-456',
      }),
    });
    assert.equal(changedPassword.response.status, 200);
    const changedPasswordCookie = changedPassword.response.headers
      .get('set-cookie')
      ?.split(';')[0];
    assert.ok(changedPasswordCookie);
    assert.equal(
      (await jsonRequest('/api/schwank', { headers: { cookie: loginCookie } }))
        .response.status,
      401,
    );
    assert.equal(
      (
        await jsonRequest('/api/schwank', {
          headers: { cookie: changedPasswordCookie },
        })
      ).response.status,
      200,
    );

    const oldPasswordLogin = await jsonRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email: 'alice@example.test',
        password: 'alice-password-123',
      }),
    });
    assert.equal(oldPasswordLogin.response.status, 401);
    assert.equal(oldPasswordLogin.body.code, 'invalid_credentials');

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
        password: 'alice-new-password-456',
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

    await stopServer();
    const d1Directory = join(
      restoredState,
      'v3',
      'd1',
      'miniflare-D1DatabaseObject',
    );
    const d1File = (await readdir(d1Directory)).find(
      (file) => file.endsWith('.sqlite') && file !== 'metadata.sqlite',
    );
    assert.ok(d1File);
    const legacyDatabase = new DatabaseSync(join(d1Directory, d1File));
    const retainedTaskCount = legacyDatabase
      .prepare('SELECT COUNT(*) AS count FROM tasks')
      .get().count;
    const restoredAliceId = legacyDatabase
      .prepare("SELECT id FROM users WHERE email='alice@example.test'")
      .get().id;
    const restoredPrivateMedicationId = legacyDatabase
      .prepare(
        "SELECT id FROM medications WHERE user_id=? AND name='Alice private medication'",
      )
      .get(restoredAliceId).id;
    const insertLargeExpense = legacyDatabase.prepare(
      "INSERT INTO expenses (user_id,visibility,label,amount,category,paid_by,spent_on) VALUES (?,'private',?,?, 'groceries','Alice Test',?)",
    );
    const insertLargeNutrition = legacyDatabase.prepare(
      "INSERT INTO nutrition_entries (user_id,member_id,visibility,label,calories,protein,carbs,fat,eaten_on) VALUES (?,?,'private',?,100,10,12,4,?)",
    );
    const insertLargeWater = legacyDatabase.prepare(
      'INSERT INTO water_entries (user_id,amount_ml,drunk_on,created_at) VALUES (?,25,?,?)',
    );
    const insertLargeMedicationDose = legacyDatabase.prepare(
      'INSERT INTO medication_doses (medication_id,user_id,scheduled_for,taken_at) VALUES (?,?,?,?)',
    );
    const insertLargeHabit = legacyDatabase.prepare(
      "INSERT INTO habit_entries (user_id,habit,occurrences,cost,occurred_on,created_at) VALUES (?,'vaping',1,25,?,?)",
    );
    const insertCompletedTask = legacyDatabase.prepare(
      "INSERT INTO tasks (user_id,visibility,title,status,assignee_id,tag,due,due_on) VALUES (?,?,?,'done',?,'Pass 8','Completed',?)",
    );
    const insertCompletedOrganiser = legacyDatabase.prepare(
      'INSERT INTO organiser_items (user_id,visibility,list,label,done) VALUES (?,?,?,?,1)',
    );
    const insertCompletedReminder = legacyDatabase.prepare(
      "INSERT INTO reminders (user_id,visibility,label,remind_at,recurrence,done,created_at) VALUES (?,?,?,?,'none',1,?)",
    );
    legacyDatabase.exec('BEGIN');
    for (let index = 0; index < 250; index += 1) {
      const day = String((index % 28) + 1).padStart(2, '0');
      const month = String(12 - (Math.floor(index / 28) % 12)).padStart(2, '0');
      insertLargeExpense.run(
        restoredAliceId,
        `Large history expense ${String(index).padStart(3, '0')}`,
        index + 1,
        `2029-${month}-${day}`,
      );
    }
    for (let index = 0; index < 130; index += 1) {
      const historyDate = new Date(`${today}T12:00:00.000Z`);
      historyDate.setUTCDate(historyDate.getUTCDate() - (index % 90));
      const historyDay = historyDate.toISOString().slice(0, 10);
      insertLargeNutrition.run(
        restoredAliceId,
        String(restoredAliceId),
        `Large nutrition history ${String(index).padStart(3, '0')}`,
        historyDay,
      );
      insertLargeWater.run(
        restoredAliceId,
        historyDay,
        `${historyDay}T12:00:00.000Z`,
      );
      insertLargeMedicationDose.run(
        restoredPrivateMedicationId,
        restoredAliceId,
        `${historyDay}T${index < 90 ? '09:00' : '10:00'}`,
        `${historyDay}T12:00:00.000Z`,
      );
      const habitDate = new Date(`${today}T12:00:00.000Z`);
      habitDate.setUTCDate(habitDate.getUTCDate() - (index % 84));
      const habitDay = habitDate.toISOString().slice(0, 10);
      insertLargeHabit.run(
        restoredAliceId,
        habitDay,
        `${habitDay}T12:00:00.000Z`,
      );
      const workflowVisibility = index < 5 ? 'shared' : 'private';
      const workflowSuffix = String(index).padStart(3, '0');
      insertCompletedTask.run(
        restoredAliceId,
        workflowVisibility,
        `Large completed task ${workflowSuffix}`,
        String(restoredAliceId),
        historyDay,
      );
      insertCompletedOrganiser.run(
        restoredAliceId,
        workflowVisibility,
        'Large completed list',
        `Large completed item ${workflowSuffix}`,
      );
      insertCompletedReminder.run(
        restoredAliceId,
        workflowVisibility,
        `Large completed reminder ${workflowSuffix}`,
        `${historyDay}T12:00`,
        `${historyDay}T12:00:00.000Z`,
      );
    }
    legacyDatabase.exec('COMMIT');
    legacyDatabase.exec(`
      DROP INDEX idx_expenses_visibility_date_id;
      DROP INDEX idx_medication_doses_medication_date;
      DROP INDEX idx_medications_visibility_active_id;
      DROP INDEX idx_organisers_visibility_id;
      DROP INDEX idx_recurring_payments_visibility_due_id;
      DROP INDEX idx_reminders_visibility_due_id;
      DROP INDEX idx_tasks_visibility_status_id;
      DROP INDEX idx_users_active_name;
      DELETE FROM __schwank_migrations WHERE id='0018_superb_korath';
      ALTER TABLE household_settings DROP COLUMN registration_open;
      ALTER TABLE household_settings DROP COLUMN invite_code_hash;
      ALTER TABLE household_settings DROP COLUMN invite_expires_at;
      ALTER TABLE users DROP COLUMN role;
      DROP TABLE auth_rate_limits;
      ALTER TABLE sessions DROP COLUMN user_agent;
      ALTER TABLE users DROP COLUMN deleted_at;
    `);
    legacyDatabase.close();

    await startServer(restoredState);
    const repairedData = await household(restoredCookie);
    assert.equal(
      repairedData.tasks.some((task) => task.title === 'Alice private task'),
      true,
    );
    const pageStartedAt = performance.now();
    const spendingSection = await jsonRequest('/api/data?sections=spending', {
      headers: { cookie: restoredCookie },
    });
    assert.equal(spendingSection.response.status, 200);
    assert.equal(spendingSection.body.expenses.length, 100);
    assert.equal(spendingSection.body.expensesHasMore, true);
    assert.ok(spendingSection.body.expenseCount >= 250);
    assert.ok(spendingSection.body.expenseTotal > 31_000);
    const loadedExpenses = [...spendingSection.body.expenses];
    let hasMoreExpenses = spendingSection.body.expensesHasMore;
    while (hasMoreExpenses) {
      const oldestExpense = loadedExpenses.at(-1);
      const nextPage = await jsonRequest(
        `/api/spending?beforeDate=${oldestExpense.spentOn}&beforeId=${oldestExpense.id}`,
        { headers: { cookie: restoredCookie } },
      );
      assert.equal(nextPage.response.status, 200);
      loadedExpenses.push(...nextPage.body.expenses);
      hasMoreExpenses = nextPage.body.hasMore;
    }
    assert.equal(loadedExpenses.length, spendingSection.body.expenseCount);
    assert.equal(
      new Set(loadedExpenses.map((expense) => expense.id)).size,
      loadedExpenses.length,
    );
    assert.equal(
      loadedExpenses.filter((expense) =>
        expense.label.startsWith('Large history expense'),
      ).length,
      250,
    );
    assert.ok(performance.now() - pageStartedAt < 5_000);

    for (const history of [
      {
        kind: 'nutrition',
        section: 'nutrition',
        itemsKey: 'nutritionHistory',
        countKey: 'nutritionHistoryCount',
        hasMoreKey: 'nutritionHistoryHasMore',
        daysKey: 'nutritionHistoryDays',
        dateKey: 'eatenOn',
      },
      {
        kind: 'water',
        section: 'water',
        itemsKey: 'water',
        countKey: 'waterHistoryCount',
        hasMoreKey: 'waterHistoryHasMore',
        daysKey: 'waterHistoryDays',
        dateKey: 'drunkOn',
      },
    ]) {
      const section = await jsonRequest(
        `/api/data?sections=${history.section}`,
        { headers: { cookie: restoredCookie } },
      );
      assert.equal(section.response.status, 200);
      assert.equal(section.body[history.itemsKey].length, 100);
      assert.equal(section.body[history.hasMoreKey], true);
      assert.ok(
        section.body[history.countKey] >= 130,
        `${history.kind}: ${section.body[history.countKey]}`,
      );
      assert.ok(
        section.body[history.daysKey].reduce(
          (total, day) => total + Number(day.entryCount),
          0,
        ) >= 130,
      );
      const loaded = [...section.body[history.itemsKey]];
      let hasMore = section.body[history.hasMoreKey];
      while (hasMore) {
        const oldest = loaded.at(-1);
        const page = await jsonRequest(
          `/api/history?kind=${history.kind}&beforeDate=${oldest[history.dateKey]}&beforeId=${oldest.id}`,
          { headers: { cookie: restoredCookie } },
        );
        assert.equal(page.response.status, 200);
        loaded.push(...page.body.items);
        hasMore = page.body.hasMore;
      }
      assert.equal(loaded.length, section.body[history.countKey]);
      assert.equal(new Set(loaded.map((item) => item.id)).size, loaded.length);
    }
    for (const history of [
      {
        kind: 'medication-doses',
        section: 'medications',
        itemsKey: 'medicationDoseHistory',
        countKey: 'medicationDoseHistoryCount',
        hasMoreKey: 'medicationDoseHistoryHasMore',
        daysKey: 'medicationAdherenceDoses',
        dateKey: 'scheduledFor',
        public: false,
        pageSize: 24,
      },
      {
        kind: 'habits',
        section: 'habits',
        itemsKey: 'habits',
        countKey: 'habitHistoryCount',
        hasMoreKey: 'habitHistoryHasMore',
        daysKey: 'habitHistoryDays',
        dateKey: 'occurredOn',
        public: true,
        pageSize: 24,
      },
    ]) {
      const section = await jsonRequest(
        `/api/data?sections=${history.section}`,
        { headers: { cookie: restoredCookie } },
      );
      assert.equal(section.response.status, 200);
      assert.equal(section.body[history.itemsKey].length, history.pageSize);
      assert.equal(section.body[history.hasMoreKey], true);
      assert.ok(
        section.body[history.countKey] >= 130,
        `${history.kind}: ${section.body[history.countKey]}`,
      );
      assert.ok(section.body[history.daysKey].length > 0);
      const loaded = [...section.body[history.itemsKey]];
      let hasMore = section.body[history.hasMoreKey];
      while (hasMore) {
        const oldest = loaded.at(-1);
        const beforeDate = oldest[history.dateKey].slice(0, 10);
        const page = await jsonRequest(
          `/api/history?kind=${history.kind}&beforeDate=${beforeDate}&beforeId=${oldest.id}`,
          { headers: { cookie: restoredCookie } },
        );
        assert.equal(page.response.status, 200);
        loaded.push(...page.body.items);
        hasMore = page.body.hasMore;
      }
      assert.equal(loaded.length, section.body[history.countKey]);
      assert.equal(new Set(loaded.map((item) => item.id)).size, loaded.length);
      const bobHistory = await jsonRequest(
        `/api/history?kind=${history.kind}`,
        {
          headers: { cookie: bob.cookie },
        },
      );
      assert.equal(bobHistory.response.status, 200);
      assert.equal(
        bobHistory.body.items.some(
          (item) =>
            item.userId === restoredAliceId ||
            item.takenByName === 'Alice Test',
        ),
        history.public,
      );
      if (history.public)
        assert.equal(bobHistory.body.count, section.body[history.countKey]);
    }
    const bobNutritionHistory = await jsonRequest(
      '/api/history?kind=nutrition',
      { headers: { cookie: bob.cookie } },
    );
    assert.equal(bobNutritionHistory.response.status, 200);
    assert.equal(
      bobNutritionHistory.body.items.some((item) =>
        item.label.startsWith('Large nutrition history'),
      ),
      false,
    );
    for (const history of [
      {
        kind: 'tasks',
        section: 'tasks',
        itemsKey: 'tasks',
        countKey: 'completedTaskCount',
        hasMoreKey: 'completedTasksHasMore',
        completed: (item) => item.status === 'done',
        label: (item) => item.title,
        prefix: 'Large completed task',
      },
      {
        kind: 'organiser-items',
        section: 'organisers',
        itemsKey: 'organisers',
        countKey: 'completedOrganiserCount',
        hasMoreKey: 'completedOrganisersHasMore',
        completed: (item) => Boolean(item.done),
        label: (item) => item.label,
        prefix: 'Large completed item',
      },
      {
        kind: 'reminders',
        section: 'organisers',
        itemsKey: 'reminders',
        countKey: 'completedReminderCount',
        hasMoreKey: 'completedRemindersHasMore',
        completed: (item) => Boolean(item.done),
        label: (item) => item.label,
        prefix: 'Large completed reminder',
      },
    ]) {
      const section = await jsonRequest(
        `/api/data?sections=${history.section}`,
        { headers: { cookie: restoredCookie } },
      );
      assert.equal(section.response.status, 200);
      const initialCompleted = section.body[history.itemsKey].filter(
        history.completed,
      );
      assert.equal(initialCompleted.length, 24);
      assert.equal(section.body[history.hasMoreKey], true);
      assert.ok(section.body[history.countKey] >= 130);
      const loaded = [...initialCompleted];
      let hasMore = section.body[history.hasMoreKey];
      while (hasMore) {
        const page = await jsonRequest(
          `/api/history?kind=${history.kind}&beforeId=${loaded.at(-1).id}`,
          { headers: { cookie: restoredCookie } },
        );
        assert.equal(page.response.status, 200);
        loaded.push(...page.body.items);
        hasMore = page.body.hasMore;
      }
      assert.equal(loaded.length, section.body[history.countKey]);
      assert.equal(new Set(loaded.map((item) => item.id)).size, loaded.length);
      assert.equal(
        loaded.filter((item) => history.label(item).startsWith(history.prefix))
          .length,
        130,
      );
      const bobHistory = await jsonRequest(
        `/api/history?kind=${history.kind}`,
        {
          headers: { cookie: bob.cookie },
        },
      );
      assert.equal(bobHistory.response.status, 200);
      assert.equal(
        bobHistory.body.items.filter((item) =>
          history.label(item).startsWith(history.prefix),
        ).length,
        5,
      );
      assert.equal(
        bobHistory.body.items.some((item) =>
          history.label(item).endsWith('129'),
        ),
        false,
      );
    }
    assert.equal(
      (
        await jsonRequest('/api/history?kind=tasks&beforeDate=2026-09-01', {
          headers: { cookie: restoredCookie },
        })
      ).response.status,
      400,
    );
    await stopServer();
    const repairedDatabase = new DatabaseSync(join(d1Directory, d1File), {
      readOnly: true,
    });
    assert.equal(
      repairedDatabase.prepare('SELECT COUNT(*) AS count FROM tasks').get()
        .count,
      retainedTaskCount + 130,
    );
    assert.equal(
      repairedDatabase
        .prepare(
          "SELECT COUNT(*) AS count FROM pragma_table_info('users') WHERE name IN ('role','deleted_at')",
        )
        .get().count,
      2,
    );
    assert.equal(
      repairedDatabase
        .prepare('SELECT COUNT(*) AS count FROM __schwank_migrations')
        .get().count,
      19,
    );
    repairedDatabase.close();
    await startServer(restoredState);

    assert.equal(
      (
        await action(charlie.cookie, {
          type: 'message',
          body: 'Charlie contribution removed with membership',
        })
      ).response.status,
      200,
    );

    const wrongRemovalConfirmation = await jsonRequest(
      '/api/household/members',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: restoredCookie,
          origin,
        },
        body: JSON.stringify({
          action: 'remove',
          memberId: charlieId,
          currentPassword: 'alice-new-password-456',
          confirmation: 'Charlie',
        }),
      },
    );
    assert.equal(wrongRemovalConfirmation.response.status, 400);
    assert.equal(wrongRemovalConfirmation.body.code, 'validation_failed');
    assert.equal(
      (
        await jsonRequest('/api/household/members', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: restoredCookie,
            origin,
          },
          body: JSON.stringify({
            action: 'remove',
            memberId: charlieId,
            currentPassword: 'alice-new-password-456',
            confirmation: 'Charlie Test',
          }),
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await jsonRequest('/api/schwank', {
          headers: { cookie: charlie.cookie },
        })
      ).response.status,
      401,
    );
    assert.equal(
      JSON.stringify(await household(bob.cookie)).includes(
        'Charlie contribution removed with membership',
      ),
      false,
    );

    assert.equal(
      (
        await action(bob.cookie, {
          type: 'task',
          title: 'Bob export secret',
          tag: 'Private',
          dueOn: '2030-02-01',
          visibility: 'private',
        })
      ).response.status,
      200,
    );
    const exportResult = await jsonRequest('/api/account/export', {
      method: 'POST',
      headers: { cookie: restoredCookie, origin },
    });
    assert.equal(exportResult.response.status, 200);
    assert.match(
      exportResult.response.headers.get('content-disposition') ?? '',
      /^attachment; filename="schwank-account-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    assert.equal(exportResult.body.account.email, 'alice@example.test');
    assert.equal(exportResult.body.records.spendingBudgets.length, 1);
    assert.equal(
      exportResult.body.records.spendingBudgets[0].monthlyLimit,
      25_000,
    );
    assert.equal(
      exportResult.body.records.tasks.some(
        (task) => task.title === 'Alice private task',
      ),
      true,
    );
    assert.equal(
      JSON.stringify(exportResult.body).includes('Bob export secret'),
      false,
    );
    assert.equal(
      JSON.stringify(exportResult.body).includes('bob@example.test'),
      false,
    );

    assert.equal(
      (
        await action(restoredCookie, {
          type: 'recipe-add',
          name: 'Recipe retained after departure',
          course: 'main',
          servings: 3,
          instructions: 'Synthetic global record',
          ingredients: [{ name: 'Beans', quantity: 300, unit: 'g' }],
        })
      ).response.status,
      200,
    );
    const wrongDeletionPassword = await jsonRequest('/api/account', {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        cookie: restoredCookie,
        origin,
      },
      body: JSON.stringify({
        currentPassword: 'wrong-password',
        confirmation: 'alice@example.test',
      }),
    });
    assert.equal(wrongDeletionPassword.response.status, 403);
    assert.equal(wrongDeletionPassword.body.code, 'invalid_current_password');
    const wrongDeletionConfirmation = await jsonRequest('/api/account', {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        cookie: restoredCookie,
        origin,
      },
      body: JSON.stringify({
        currentPassword: 'alice-new-password-456',
        confirmation: 'bob@example.test',
      }),
    });
    assert.equal(wrongDeletionConfirmation.response.status, 400);
    assert.equal(wrongDeletionConfirmation.body.code, 'validation_failed');

    const deletedOwner = await jsonRequest('/api/account', {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        cookie: restoredCookie,
        origin,
      },
      body: JSON.stringify({
        currentPassword: 'alice-new-password-456',
        confirmation: 'alice@example.test',
      }),
    });
    assert.equal(deletedOwner.response.status, 200);
    assert.equal(deletedOwner.body.finalAccount, false);
    assert.match(
      deletedOwner.response.headers.get('set-cookie') ?? '',
      /Max-Age=0/,
    );
    assert.equal(
      (
        await jsonRequest('/api/schwank', {
          headers: { cookie: restoredCookie },
        })
      ).response.status,
      401,
    );
    const afterOwnerDeletion = await household(bob.cookie);
    assert.equal(afterOwnerDeletion.currentUser.role, 'owner');
    assert.deepEqual(
      afterOwnerDeletion.members.map((member) => member.name),
      ['Bob Test'],
    );
    const afterOwnerDeletionSerialized = JSON.stringify(afterOwnerDeletion);
    assert.equal(
      afterOwnerDeletionSerialized.includes('alice@example.test'),
      false,
    );
    assert.equal(
      afterOwnerDeletionSerialized.includes('Alice private task'),
      false,
    );
    assert.equal(
      afterOwnerDeletionSerialized.includes('Alice household chat message'),
      false,
    );
    const retainedRecipe = afterOwnerDeletion.recipes.find(
      (recipe) => recipe.name === 'Recipe retained after departure',
    );
    assert.ok(retainedRecipe);
    assert.equal(retainedRecipe.createdByName, 'Former member');
    const enrollmentAfterTransfer = await jsonRequest('/api/auth/enrollment');
    assert.deepEqual(enrollmentAfterTransfer.body, {
      firstUser: false,
      registrationOpen: false,
    });
    assert.equal(
      (
        await jsonRequest('/api/household/enrollment', {
          headers: { cookie: bob.cookie },
        })
      ).response.status,
      200,
    );

    const deletedFinalAccount = await jsonRequest('/api/account', {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        cookie: bob.cookie,
        origin,
      },
      body: JSON.stringify({
        currentPassword: 'bob-password-12345',
        confirmation: 'bob@example.test',
      }),
    });
    assert.equal(deletedFinalAccount.response.status, 200);
    assert.equal(deletedFinalAccount.body.finalAccount, true);
    assert.deepEqual((await jsonRequest('/api/auth/enrollment')).body, {
      firstUser: true,
      registrationOpen: true,
    });
    const freshAccount = await register(
      'Fresh Owner',
      'alice@example.test',
      'fresh-owner-password-123',
    );
    assert.equal(freshAccount.response.status, 201);
    const freshData = await household(freshAccount.cookie);
    assert.equal(freshData.currentUser.role, 'owner');
    assert.equal(freshData.home.name, 'Our home');
    assert.equal(freshData.recipes.length, 0);
    assert.equal(freshData.foods.length, 0);
  },
);
