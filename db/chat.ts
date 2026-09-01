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

export async function readChatSnapshot(user: AuthUser) {
  await ensureDatabase();
  const [page, stats] = await Promise.all([
    readChatPage(user),
    env.DB.prepare(
      'SELECT COUNT(*) AS messageCount,SUM(CASE WHEN id>COALESCE((SELECT last_read_message_id FROM chat_read_state WHERE user_id=?),0) THEN 1 ELSE 0 END) AS unreadMessages FROM messages',
    )
      .bind(user.id)
      .first<{ messageCount: number; unreadMessages: number | null }>(),
  ]);
  return {
    ...page,
    messageCount: Number(stats?.messageCount ?? 0),
    unreadMessages: Number(stats?.unreadMessages ?? 0),
  };
}
