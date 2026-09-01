import { env } from 'cloudflare:workers';
import type { AuthUser } from './auth';
import { ensureDatabase } from './setup';
import { ApiError } from '@/lib/api-errors';

export const CHAT_PAGE_SIZE = 50;
export const CHAT_RETENTION_DAYS = 365;

export async function readChatPage(user: AuthUser, before?: number) {
  await ensureDatabase();
  if (before !== undefined && (!Number.isSafeInteger(before) || before < 1))
    throw new ApiError('Choose a valid chat page.', 400, 'validation_failed');
  const condition = before === undefined ? '' : 'WHERE m.id<?';
  const statement = env.DB.prepare(
    `SELECT m.id,m.body,m.created_at AS createdAt,m.edited_at AS editedAt,u.display_name AS name,u.initials,u.color,u.avatar_data AS avatar,(m.user_id=?) AS mine FROM messages m JOIN users u ON u.id=m.user_id ${condition} ORDER BY m.id DESC LIMIT ?`,
  );
  const result =
    before === undefined
      ? await statement.bind(user.id, CHAT_PAGE_SIZE + 1).all()
      : await statement.bind(user.id, before, CHAT_PAGE_SIZE + 1).all();
  const descending = result.results;
  const hasMore = descending.length > CHAT_PAGE_SIZE;
  return {
    messages: descending.slice(0, CHAT_PAGE_SIZE).reverse(),
    hasMore,
  };
}
