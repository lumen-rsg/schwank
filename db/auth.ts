import { env } from 'cloudflare:workers';
import { ensureDatabase } from './setup';

export const SESSION_COOKIE = 'schwank_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 600_000;
const encoder = new TextEncoder();

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  initials: string;
  color: string;
  avatar: string | null;
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new AuthError('Enter a valid email address.', 400);
  if (name.length < 2 || name.length > 40)
    throw new AuthError('Your name must be between 2 and 40 characters.', 400);
  if (password.length < 12 || password.length > 128)
    throw new AuthError('Use a password between 12 and 128 characters.', 400);
  return { email, name, password };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function createSession(userId: number) {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_SECONDS * 1000,
  ).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?)',
  )
    .bind(userId, tokenHash, expiresAt, now.toISOString())
    .run();
  return token;
}

export async function registerUser(input: unknown) {
  await ensureDatabase();
  const { email, name, password } = normalizeRegistration(input);
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email=?')
    .bind(email)
    .first();
  if (existing)
    throw new AuthError('An account with that email already exists.', 409);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  try {
    const result = await env.DB.prepare(
      'INSERT INTO users (email,display_name,initials,color,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?,?)',
    )
      .bind(
        email,
        name,
        initialsFor(name),
        colorFor(email),
        passwordHash,
        bytesToBase64(salt),
        new Date().toISOString(),
      )
      .run();
    const userId = Number(result.meta.last_row_id);
    return { token: await createSession(userId), userId };
  } catch {
    throw new AuthError('An account with that email already exists.', 409);
  }
}

export async function loginUser(input: unknown) {
  await ensureDatabase();
  const record = (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >;
  const email = stringField(record, 'email').trim().toLowerCase();
  const password = stringField(record, 'password');
  const user = await env.DB.prepare(
    'SELECT id,email,display_name AS name,initials,color,avatar_data AS avatar,password_hash AS passwordHash,password_salt AS passwordSalt,calorie_goal AS calorieGoal,protein_goal AS proteinGoal,carb_goal AS carbGoal,fat_goal AS fatGoal,water_goal AS waterGoal,maintenance_calories AS maintenanceCalories,height_cm AS heightCm,weight_kg AS weightKg,age,sex,activity,nutrition_plan AS nutritionPlan,diet,ai_consent AS aiConsent FROM users WHERE email=?',
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
  return { token: await createSession(user.id), userId: user.id };
}

function cookieValue(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(';')) {
    const [name, ...parts] = item.trim().split('=');
    if (name === SESSION_COOKIE) return parts.join('=');
  }
  return null;
}
export async function getUserFromCookie(
  cookieHeader: string | null,
): Promise<AuthUser | null> {
  await ensureDatabase();
  const token = cookieValue(cookieHeader);
  if (!token) return null;
  const tokenHash = await sha256(token);
  return env.DB.prepare(
    `SELECT u.id,u.email,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar,u.calorie_goal AS calorieGoal,u.protein_goal AS proteinGoal,u.carb_goal AS carbGoal,u.fat_goal AS fatGoal,u.water_goal AS waterGoal,u.maintenance_calories AS maintenanceCalories,u.height_cm AS heightCm,u.weight_kg AS weightKg,u.age,u.sex,u.activity,u.nutrition_plan AS nutritionPlan,u.diet,u.ai_consent AS aiConsent FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`,
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
