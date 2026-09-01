import { env } from 'cloudflare:workers';
import { ensureDatabase } from './setup';

export const SESSION_COOKIE = 'schwank_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 600_000;
const encoder = new TextEncoder();
const RATE_LIMITS = {
  login: { attempts: 5, windowSeconds: 15 * 60 },
  register: { attempts: 10, windowSeconds: 60 * 60 },
} as const;
type AuthRateScope = keyof typeof RATE_LIMITS;

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
  role: 'owner' | 'member';
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
  waterGoal: number;
  maintenanceCalories: number | null;
  heightCm: number | null;
  weightKg: number | null;
  age: number | null;
  sex: string | null;
  activity: string | null;
  nutritionPlan: string | null;
  diet: string | null;
  aiConsent: boolean | number;
};
type StoredUser = AuthUser & { passwordHash: string; passwordSalt: string };

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function sha256(value: string) {
  return bytesToBase64(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(value)),
    ),
  );
}

function requestFingerprint(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0];
  const address =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    forwarded?.trim() ||
    'local';
  return address;
}

async function rateLimitBucket(
  request: Request,
  scope: AuthRateScope,
  identity: string,
) {
  return sha256(
    `${scope}|${requestFingerprint(request)}|${identity.trim().toLowerCase()}`,
  );
}

export async function assertAuthRateLimit(
  request: Request,
  scope: AuthRateScope,
  identity: string,
) {
  await ensureDatabase();
  const bucketHash = await rateLimitBucket(request, scope, identity);
  const row = await env.DB.prepare(
    'SELECT attempts,window_started_at AS windowStartedAt,blocked_until AS blockedUntil FROM auth_rate_limits WHERE bucket_hash=?',
  )
    .bind(bucketHash)
    .first<{
      attempts: number;
      windowStartedAt: string;
      blockedUntil: string | null;
    }>();
  const now = new Date();
  if (row?.blockedUntil && row.blockedUntil > now.toISOString())
    throw new AuthError('Too many attempts. Try again later.', 429);
  const windowMilliseconds = RATE_LIMITS[scope].windowSeconds * 1000;
  if (
    row &&
    new Date(row.windowStartedAt).getTime() + windowMilliseconds <=
      now.getTime()
  )
    await env.DB.prepare('DELETE FROM auth_rate_limits WHERE bucket_hash=?')
      .bind(bucketHash)
      .run();
}

export async function recordAuthFailure(
  request: Request,
  scope: AuthRateScope,
  identity: string,
) {
  const bucketHash = await rateLimitBucket(request, scope, identity);
  const now = new Date();
  const config = RATE_LIMITS[scope];
  const existing = await env.DB.prepare(
    'SELECT attempts,window_started_at AS windowStartedAt FROM auth_rate_limits WHERE bucket_hash=?',
  )
    .bind(bucketHash)
    .first<{ attempts: number; windowStartedAt: string }>();
  const expired =
    !existing ||
    new Date(existing.windowStartedAt).getTime() +
      config.windowSeconds * 1000 <=
      now.getTime();
  const attempts = expired ? 1 : Number(existing.attempts) + 1;
  const windowStartedAt = expired
    ? now.toISOString()
    : existing.windowStartedAt;
  const blockedUntil =
    attempts >= config.attempts
      ? new Date(now.getTime() + config.windowSeconds * 1000).toISOString()
      : null;
  await env.DB.prepare(
    'INSERT INTO auth_rate_limits (bucket_hash,scope,attempts,window_started_at,blocked_until) VALUES (?,?,?,?,?) ON CONFLICT(bucket_hash) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until',
  )
    .bind(bucketHash, scope, attempts, windowStartedAt, blockedUntil)
    .run();
  if (blockedUntil)
    throw new AuthError('Too many attempts. Try again later.', 429);
}

export async function clearAuthRateLimit(
  request: Request,
  scope: AuthRateScope,
  identity: string,
) {
  await env.DB.prepare('DELETE FROM auth_rate_limits WHERE bucket_hash=?')
    .bind(await rateLimitBucket(request, scope, identity))
    .run();
}
async function hashPassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const saltBuffer = new Uint8Array(salt).buffer as ArrayBuffer;
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}
function constantTimeEqual(left: string, right: string) {
  const a = base64ToBytes(left);
  const b = base64ToBytes(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1)
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}
function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
function colorFor(value: string) {
  const colors = [
    '#e8653f',
    '#708c67',
    '#557ea4',
    '#9a6fa2',
    '#b77a4b',
    '#4f8b82',
  ];
  let hash = 0;
  for (const character of value)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function normalizeRegistration(input: unknown) {
  if (!input || typeof input !== 'object')
    throw new AuthError('Please complete every field.', 400);
  const record = input as Record<string, unknown>;
  const email = stringField(record, 'email').trim().toLowerCase();
  const name = stringField(record, 'name').trim().replace(/\s+/g, ' ');
  const password = stringField(record, 'password');
  const inviteCode = stringField(record, 'inviteCode');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new AuthError('Enter a valid email address.', 400);
  if (name.length < 2 || name.length > 40)
    throw new AuthError('Your name must be between 2 and 40 characters.', 400);
  if (password.length < 12 || password.length > 128)
    throw new AuthError('Use a password between 12 and 128 characters.', 400);
  if (inviteCode.length > 32)
    throw new AuthError('Enter a valid household invite code.', 403);
  return { email, name, password, inviteCode };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function normalizeInviteCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function createInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `${code.slice(0, 5).join('')}-${code.slice(5).join('')}`;
}

export async function readPublicEnrollmentStatus() {
  await ensureDatabase();
  const users = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM users',
  ).first<{ count: number }>();
  const firstUser = Number(users?.count ?? 0) === 0;
  if (firstUser) return { firstUser: true, registrationOpen: true };
  const settings = await env.DB.prepare(
    'SELECT registration_open AS registrationOpen,invite_expires_at AS inviteExpiresAt FROM household_settings WHERE id=1',
  ).first<{
    registrationOpen: boolean | number;
    inviteExpiresAt: string | null;
  }>();
  const registrationOpen = Boolean(
    settings?.registrationOpen &&
    settings.inviteExpiresAt &&
    settings.inviteExpiresAt > new Date().toISOString(),
  );
  return { firstUser: false, registrationOpen };
}

export async function readEnrollmentSettings(user: AuthUser) {
  await ensureDatabase();
  if (user.role !== 'owner')
    throw new AuthError('Only the household owner can manage enrollment.', 403);
  const settings = await env.DB.prepare(
    'SELECT registration_open AS registrationOpen,invite_expires_at AS inviteExpiresAt FROM household_settings WHERE id=1',
  ).first<{
    registrationOpen: boolean | number;
    inviteExpiresAt: string | null;
  }>();
  return {
    registrationOpen: Boolean(settings?.registrationOpen),
    inviteExpiresAt: settings?.inviteExpiresAt ?? null,
  };
}

export async function updateEnrollmentSettings(user: AuthUser, input: unknown) {
  await ensureDatabase();
  if (user.role !== 'owner')
    throw new AuthError('Only the household owner can manage enrollment.', 403);
  const action =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>).action
      : null;
  if (action === 'close') {
    await env.DB.prepare(
      'UPDATE household_settings SET registration_open=0,invite_code_hash=NULL,invite_expires_at=NULL WHERE id=1',
    ).run();
    return { registrationOpen: false, inviteExpiresAt: null };
  }
  if (action !== 'rotate')
    throw new AuthError('Choose a valid enrollment action.', 400);
  const inviteCode = createInviteCode();
  const inviteExpiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  await env.DB.prepare(
    'UPDATE household_settings SET registration_open=1,invite_code_hash=?,invite_expires_at=? WHERE id=1',
  )
    .bind(await sha256(normalizeInviteCode(inviteCode)), inviteExpiresAt)
    .run();
  return { registrationOpen: true, inviteExpiresAt, inviteCode };
}

function cleanUserAgent(request?: Request) {
  return (
    request?.headers.get('user-agent')?.trim().slice(0, 240) || 'Unknown device'
  );
}

async function createSession(userId: number, request?: Request) {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_SECONDS * 1000,
  ).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (user_id,token_hash,user_agent,expires_at,created_at) VALUES (?,?,?,?,?)',
  )
    .bind(
      userId,
      tokenHash,
      cleanUserAgent(request),
      expiresAt,
      now.toISOString(),
    )
    .run();
  return token;
}

export async function registerUser(input: unknown, request?: Request) {
  await ensureDatabase();
  const { email, name, password, inviteCode } = normalizeRegistration(input);
  const userCount = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM users',
  ).first<{ count: number }>();
  const firstUser = Number(userCount?.count ?? 0) === 0;
  if (!firstUser) {
    const enrollment = await env.DB.prepare(
      'SELECT registration_open AS registrationOpen,invite_code_hash AS inviteCodeHash,invite_expires_at AS inviteExpiresAt FROM household_settings WHERE id=1',
    ).first<{
      registrationOpen: boolean | number;
      inviteCodeHash: string | null;
      inviteExpiresAt: string | null;
    }>();
    if (!enrollment?.registrationOpen)
      throw new AuthError('Registration is closed for this household.', 403);
    const candidateHash = await sha256(normalizeInviteCode(inviteCode));
    const validExpiry =
      enrollment.inviteExpiresAt &&
      enrollment.inviteExpiresAt > new Date().toISOString();
    if (
      !inviteCode ||
      !enrollment.inviteCodeHash ||
      !validExpiry ||
      !constantTimeEqual(candidateHash, enrollment.inviteCodeHash)
    )
      throw new AuthError('Enter a valid household invite code.', 403);
  }
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email=?')
    .bind(email)
    .first();
  if (existing)
    throw new AuthError('An account with that email already exists.', 409);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  try {
    const result = await env.DB.prepare(
      'INSERT INTO users (email,display_name,initials,color,password_hash,password_salt,role,created_at) VALUES (?,?,?,?,?,?,?,?)',
    )
      .bind(
        email,
        name,
        initialsFor(name),
        colorFor(email),
        passwordHash,
        bytesToBase64(salt),
        firstUser ? 'owner' : 'member',
        new Date().toISOString(),
      )
      .run();
    const userId = Number(result.meta.last_row_id);
    return { token: await createSession(userId, request), userId };
  } catch {
    throw new AuthError('An account with that email already exists.', 409);
  }
}

export async function loginUser(input: unknown, request?: Request) {
  await ensureDatabase();
  const record = (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >;
  const email = stringField(record, 'email').trim().toLowerCase();
  const password = stringField(record, 'password');
  const user = await env.DB.prepare(
    'SELECT id,email,display_name AS name,initials,color,avatar_data AS avatar,role,password_hash AS passwordHash,password_salt AS passwordSalt,calorie_goal AS calorieGoal,protein_goal AS proteinGoal,carb_goal AS carbGoal,fat_goal AS fatGoal,water_goal AS waterGoal,maintenance_calories AS maintenanceCalories,height_cm AS heightCm,weight_kg AS weightKg,age,sex,activity,nutrition_plan AS nutritionPlan,diet,ai_consent AS aiConsent FROM users WHERE email=?',
  )
    .bind(email)
    .first<StoredUser>();
  const fallbackSalt = new Uint8Array(16);
  const fallbackHash = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const candidateHash = await hashPassword(
    password || 'invalid-password',
    user ? base64ToBytes(user.passwordSalt) : fallbackSalt,
  );
  if (
    !user ||
    !password ||
    !constantTimeEqual(candidateHash, user?.passwordHash ?? fallbackHash)
  )
    throw new AuthError('Email or password is incorrect.', 401);
  return { token: await createSession(user.id, request), userId: user.id };
}

function cookieValue(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(';')) {
    const [name, ...parts] = item.trim().split('=');
    if (name === SESSION_COOKIE) return parts.join('=');
  }
  return null;
}

async function requestTokenHash(request: Request) {
  const token = cookieValue(request.headers.get('cookie'));
  return token ? sha256(token) : null;
}

export type SessionSummary = {
  id: number;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  current: boolean | number;
};

export async function listUserSessions(user: AuthUser, request: Request) {
  await ensureDatabase();
  const tokenHash = await requestTokenHash(request);
  if (!tokenHash) throw new AuthError('Sign in required.', 401);
  const result = await env.DB.prepare(
    'SELECT id,user_agent AS userAgent,created_at AS createdAt,expires_at AS expiresAt,(token_hash=?) AS current FROM sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC,id DESC',
  )
    .bind(tokenHash, user.id, new Date().toISOString())
    .all<SessionSummary>();
  return result.results;
}

export async function revokeUserSession(
  user: AuthUser,
  request: Request,
  input: unknown,
) {
  await ensureDatabase();
  const record = (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >;
  const sessionId = Number(record.sessionId);
  if (!Number.isSafeInteger(sessionId) || sessionId < 1)
    throw new AuthError('Choose a valid session.', 400);
  const tokenHash = await requestTokenHash(request);
  if (!tokenHash) throw new AuthError('Sign in required.', 401);
  const session = await env.DB.prepare(
    'SELECT id,(token_hash=?) AS current FROM sessions WHERE id=? AND user_id=?',
  )
    .bind(tokenHash, sessionId, user.id)
    .first<{ id: number; current: boolean | number }>();
  if (!session) throw new AuthError('Session not found.', 404);
  await env.DB.prepare('DELETE FROM sessions WHERE id=? AND user_id=?')
    .bind(sessionId, user.id)
    .run();
  return { currentRevoked: Boolean(session.current) };
}

export async function changeUserPassword(
  user: AuthUser,
  request: Request,
  input: unknown,
) {
  await ensureDatabase();
  const record = (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >;
  const currentPassword = stringField(record, 'currentPassword');
  const newPassword = stringField(record, 'newPassword');
  if (newPassword.length < 12 || newPassword.length > 128)
    throw new AuthError(
      'Use a new password between 12 and 128 characters.',
      400,
    );
  if (!currentPassword)
    throw new AuthError('Enter your current password.', 400);
  const stored = await env.DB.prepare(
    'SELECT password_hash AS passwordHash,password_salt AS passwordSalt FROM users WHERE id=?',
  )
    .bind(user.id)
    .first<{ passwordHash: string; passwordSalt: string }>();
  if (!stored) throw new AuthError('Sign in required.', 401);
  const candidateHash = await hashPassword(
    currentPassword,
    base64ToBytes(stored.passwordSalt),
  );
  if (!constantTimeEqual(candidateHash, stored.passwordHash))
    throw new AuthError('Your current password is incorrect.', 403);
  const repeatedHash = await hashPassword(
    newPassword,
    base64ToBytes(stored.passwordSalt),
  );
  if (constantTimeEqual(repeatedHash, stored.passwordHash))
    throw new AuthError('Choose a password you have not just been using.', 400);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(newPassword, salt);
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_SECONDS * 1000,
  ).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE users SET password_hash=?,password_salt=? WHERE id=?',
    ).bind(passwordHash, bytesToBase64(salt), user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id),
    env.DB.prepare(
      'INSERT INTO sessions (user_id,token_hash,user_agent,expires_at,created_at) VALUES (?,?,?,?,?)',
    ).bind(
      user.id,
      tokenHash,
      cleanUserAgent(request),
      expiresAt,
      now.toISOString(),
    ),
  ]);
  return { token };
}

export async function getUserFromCookie(
  cookieHeader: string | null,
): Promise<AuthUser | null> {
  await ensureDatabase();
  const token = cookieValue(cookieHeader);
  if (!token) return null;
  const tokenHash = await sha256(token);
  return env.DB.prepare(
    `SELECT u.id,u.email,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar,u.role,u.calorie_goal AS calorieGoal,u.protein_goal AS proteinGoal,u.carb_goal AS carbGoal,u.fat_goal AS fatGoal,u.water_goal AS waterGoal,u.maintenance_calories AS maintenanceCalories,u.height_cm AS heightCm,u.weight_kg AS weightKg,u.age,u.sex,u.activity,u.nutrition_plan AS nutritionPlan,u.diet,u.ai_consent AS aiConsent FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`,
  )
    .bind(tokenHash, new Date().toISOString())
    .first<AuthUser>();
}
export function getRequestUser(request: Request) {
  return getUserFromCookie(request.headers.get('cookie'));
}
export async function destroyRequestSession(request: Request) {
  const token = cookieValue(request.headers.get('cookie'));
  if (token)
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?')
      .bind(await sha256(token))
      .run();
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    throw new AuthError('Request origin was rejected.', 403);
}
export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}
export function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
