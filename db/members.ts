import { env } from 'cloudflare:workers';
import { ApiError } from '@/lib/api-errors';
import { assertCurrentUserPassword, type AuthUser } from './auth';
import { ensureDatabase } from './setup';

function values(input: unknown) {
  return (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >;
}

async function targetMember(owner: AuthUser, input: Record<string, unknown>) {
  const targetId = Number(input.memberId);
  if (!Number.isSafeInteger(targetId) || targetId < 1 || targetId === owner.id)
    throw new ApiError(
      'Choose another household member.',
      400,
      'validation_failed',
    );
  const target = await env.DB.prepare(
    'SELECT id,display_name AS name,role FROM users WHERE id=? AND deleted_at IS NULL',
  )
    .bind(targetId)
    .first<{ id: number; name: string; role: string }>();
  if (!target) throw new ApiError('Member not found.', 404, 'not_found');
  return target;
}

export async function manageHouseholdMember(owner: AuthUser, input: unknown) {
  await ensureDatabase();
  if (owner.role !== 'owner')
    throw new ApiError(
      'Only the household owner can manage members.',
      403,
      'owner_required',
    );
  const record = values(input);
  const target = await targetMember(owner, record);
  await assertCurrentUserPassword(owner, record.currentPassword);
  const action = record.action;
  if (action === 'transfer') {
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET role='member' WHERE id=?").bind(
        owner.id,
      ),
      env.DB.prepare("UPDATE users SET role='owner' WHERE id=?").bind(
        target.id,
      ),
      env.DB.prepare(
        'UPDATE household_settings SET registration_open=0,invite_code_hash=NULL,invite_expires_at=NULL WHERE id=1',
      ),
    ]);
    return { transferredTo: target.id };
  }
  if (action !== 'remove')
    throw new ApiError(
      'Choose a valid member action.',
      400,
      'validation_failed',
    );
  const confirmation =
    typeof record.confirmation === 'string' ? record.confirmation.trim() : '';
  if (confirmation !== target.name)
    throw new ApiError(
      'Type the member name exactly to confirm removal.',
      400,
      'validation_failed',
    );
  const now = new Date().toISOString();
  const deletedEmail = `deleted-${target.id}-${crypto.randomUUID()}@invalid.local`;
  await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM medication_doses WHERE user_id=? OR medication_id IN (SELECT id FROM medications WHERE user_id=?)',
    ).bind(target.id, target.id),
    env.DB.prepare(
      'DELETE FROM purchase_votes WHERE user_id=? OR idea_id IN (SELECT id FROM purchase_ideas WHERE user_id=?)',
    ).bind(target.id, target.id),
    ...[
      'sessions',
      'nutrition_entries',
      'tasks',
      'expenses',
      'recurring_payments',
      'spending_budgets',
      'organiser_items',
      'reminders',
      'medications',
      'water_entries',
      'habit_entries',
      'messages',
      'chat_read_state',
      'purchase_ideas',
    ].map((table) =>
      env.DB.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(target.id),
    ),
    env.DB.prepare(
      'UPDATE tasks SET assignee_id=CAST(user_id AS TEXT) WHERE assignee_id=? AND user_id IS NOT NULL',
    ).bind(String(target.id)),
    env.DB.prepare(
      'UPDATE household_settings SET registration_open=0,invite_code_hash=NULL,invite_expires_at=NULL WHERE id=1',
    ),
    env.DB.prepare(
      "UPDATE users SET email=?,display_name='Former member',initials='—',color='#737373',avatar_data=NULL,password_hash='deleted',password_salt='deleted',role='member',calorie_goal=2200,protein_goal=140,carb_goal=250,fat_goal=70,water_goal=2000,maintenance_calories=NULL,height_cm=NULL,weight_kg=NULL,age=NULL,sex=NULL,activity=NULL,nutrition_plan=NULL,diet=NULL,ai_consent=0,deleted_at=? WHERE id=? AND deleted_at IS NULL",
    ).bind(deletedEmail, now, target.id),
  ]);
  return { removedMember: target.id };
}
