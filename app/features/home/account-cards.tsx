'use client';

import { useCallback, useEffect, useState, type SubmitEvent } from 'react';
import {
  Crown,
  Download,
  KeyRound,
  Monitor,
  ShieldCheck,
  Trash2,
  UserMinus,
} from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { requestApiJson, requestApiResponse } from '../../client/api';
import { formatLongDateTime } from '../../client/format';
import { Field } from '../../components/app-field';
import { Avatar } from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Member, T } from '../types';
type AccountSession = {
  id: number;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  current: boolean | number;
};

type EnrollmentSettings = {
  registrationOpen: boolean;
  inviteExpiresAt: string | null;
};

type EnrollmentMutation = EnrollmentSettings & { inviteCode?: string };

function sessionDevice(userAgent: string) {
  if (/Electron/i.test(userAgent)) return 'Electron';
  if (/Android|iPhone|iPad|Mobile/i.test(userAgent)) return 'Mobile';
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Macintosh|Mac OS/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Browser';
}

export function AccountSecurityCard({
  t,
  language,
}: {
  t: T;
  language: Language;
}) {
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSessions = useCallback(async () => {
    const payload = await requestApiJson<{ sessions: AccountSession[] }>(
      '/api/account/sessions',
      { cache: 'no-store' },
      t,
      'storageFailed',
    );
    setSessions(payload.sessions);
  }, [t]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSessions().catch((cause) =>
        setError(cause instanceof Error ? cause.message : t('storageFailed')),
      );
    });
  }, [loadSessions, t]);

  async function changePassword(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await requestApiJson(
        '/api/account/password',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            currentPassword: values.get('currentPassword'),
            newPassword: values.get('newPassword'),
          }),
        },
        t,
        'saveFailed',
      );
      form.reset();
      setMessage(t('passwordChanged'));
      await loadSessions();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(session: AccountSession) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = await requestApiJson<{ currentRevoked?: boolean }>(
        '/api/account/sessions',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id }),
        },
        t,
        'saveFailed',
      );
      if (payload.currentRevoked) {
        window.location.assign('/login');
        return;
      }
      setMessage(t('sessionRevoked'));
      await loadSessions();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel account-security-card">
      <div className="account-security-heading">
        <span>
          <ShieldCheck size={18} />
        </span>
        <div>
          <h2>{t('accountSecurity')}</h2>
          <p>{t('accountSecurityCopy')}</p>
        </div>
      </div>
      <form className="password-form" onSubmit={changePassword}>
        <Field
          name="currentPassword"
          label={t('currentPassword')}
          type="password"
          maxLength={128}
          autoComplete="current-password"
        />
        <Field
          name="newPassword"
          label={t('newPassword')}
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
        />
        <button className="primary-button" disabled={busy}>
          {t('changePassword')}
        </button>
      </form>
      <div className="session-heading">
        <strong>{t('activeSessions')}</strong>
        <span>{t('activeSessionsCount', { count: sessions.length })}</span>
      </div>
      <div className="session-list">
        {sessions.map((session) => (
          <div key={session.id}>
            <Monitor size={16} />
            <span>
              <strong>
                {sessionDevice(session.userAgent)}
                {session.current ? ` · ${t('thisDevice')}` : ''}
              </strong>
              <small>
                {t('signedInAt', {
                  date: formatLongDateTime(session.createdAt, language),
                })}
              </small>
            </span>
            <button
              className="danger-text-button"
              type="button"
              disabled={busy}
              onClick={() => void revokeSession(session)}
            >
              {session.current ? t('signOut') : t('revokeSession')}
            </button>
          </div>
        ))}
      </div>
      {message && <output className="security-success">{message}</output>}
      {error && <div className="auth-error">{error}</div>}
    </article>
  );
}

export function AccountDataCard({
  user,
  memberCount,
  t,
}: {
  user: AuthUser;
  memberCount: number;
  t: T;
}) {
  const [busy, setBusy] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function downloadExport() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await requestApiResponse(
        '/api/account/export',
        { method: 'POST' },
        t,
        'storageFailed',
      );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `schwank-account-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(t('dataExported'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('storageFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(t('deleteAccountWarning'))) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await requestApiJson(
        '/api/account',
        {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            currentPassword: values.get('currentPassword'),
            confirmation: values.get('confirmation'),
          }),
        },
        t,
        'saveFailed',
      );
      window.location.assign('/register');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
      setBusy(false);
    }
  }

  return (
    <article className="panel account-data-card">
      <div className="account-data-heading">
        <span>
          <Download size={18} />
        </span>
        <div>
          <h2>{t('accountData')}</h2>
          <p>{t('accountDataCopy')}</p>
        </div>
      </div>
      <button
        className="secondary-button"
        type="button"
        disabled={busy}
        onClick={() => void downloadExport()}
      >
        <Download size={15} />
        {t('downloadExport')}
      </button>
      <div className="danger-zone">
        <div>
          <strong>{t('deleteAccount')}</strong>
          <p>{t('deleteAccountCopy')}</p>
          {user.role === 'owner' && memberCount > 1 && (
            <small>{t('ownerDeletionCopy')}</small>
          )}
          {memberCount === 1 && <small>{t('lastAccountDeletionCopy')}</small>}
        </div>
        {!showDelete ? (
          <button
            className="danger-text-button"
            type="button"
            onClick={() => setShowDelete(true)}
          >
            {t('deleteAccount')}
          </button>
        ) : (
          <form className="delete-account-form" onSubmit={removeAccount}>
            <Field
              name="currentPassword"
              label={t('currentPassword')}
              type="password"
              maxLength={128}
              autoComplete="current-password"
            />
            <Field
              name="confirmation"
              label={t('confirmEmail', { email: user.email })}
              type="email"
              maxLength={254}
              autoComplete="off"
            />
            <div>
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => setShowDelete(false)}
              >
                {t('cancel')}
              </button>
              <button className="danger-button" disabled={busy}>
                <Trash2 size={15} />
                {t('permanentlyDelete')}
              </button>
            </div>
          </form>
        )}
      </div>
      {message && <output className="security-success">{message}</output>}
      {error && <div className="auth-error">{error}</div>}
    </article>
  );
}

export function EnrollmentCard({ t, language }: { t: T; language: Language }) {
  const [settings, setSettings] = useState<EnrollmentSettings | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void requestApiJson<EnrollmentSettings>(
      '/api/household/enrollment',
      { cache: 'no-store' },
      t,
      'storageFailed',
    )
      .then(setSettings)
      .catch(() => setError(t('storageFailed')));
  }, [t]);

  async function update(action: 'rotate' | 'close') {
    setBusy(true);
    setError('');
    try {
      const payload = await requestApiJson<EnrollmentMutation>(
        '/api/household/enrollment',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action }),
        },
        t,
        'saveFailed',
      );
      setSettings({
        registrationOpen: Boolean(payload.registrationOpen),
        inviteExpiresAt: payload.inviteExpiresAt ?? null,
      });
      setInviteCode(payload.inviteCode ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel enrollment-card">
      <div className="enrollment-icon">
        <KeyRound size={18} />
      </div>
      <div>
        <span className="eyebrow">{t('ownerOnly')}</span>
        <h2>{t('enrollmentTitle')}</h2>
        <p>{t('enrollmentCopy')}</p>
        <strong>
          {settings?.registrationOpen && settings.inviteExpiresAt
            ? t('enrollmentOpen', {
                date: formatLongDateTime(settings.inviteExpiresAt, language),
              })
            : t('enrollmentClosed')}
        </strong>
        {inviteCode && (
          <button
            className="invite-code"
            type="button"
            title={t('inviteCodeOnce')}
            onClick={() => void navigator.clipboard?.writeText(inviteCode)}
          >
            {inviteCode}
          </button>
        )}
        {inviteCode && <small>{t('inviteCodeOnce')}</small>}
        {error && <div className="auth-error">{error}</div>}
      </div>
      <div className="enrollment-actions">
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => void update('rotate')}
        >
          {t('createInvite')}
        </button>
        {settings?.registrationOpen && (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void update('close')}
          >
            {t('closeRegistration')}
          </button>
        )}
      </div>
    </article>
  );
}

export function MembersCard({
  user,
  members,
  t,
}: {
  user: AuthUser;
  members: Member[];
  t: T;
}) {
  const [selection, setSelection] = useState<{
    member: Member;
    action: 'transfer' | 'remove';
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return;
    if (
      selection.action === 'transfer' &&
      !window.confirm(
        t('transferOwnershipWarning', { name: selection.member.name }),
      )
    )
      return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await requestApiJson(
        '/api/household/members',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: selection.action,
            memberId: selection.member.id,
            currentPassword: values.get('currentPassword'),
            confirmation: values.get('confirmation'),
          }),
        },
        t,
        'saveFailed',
      );
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
      setBusy(false);
    }
  }

  return (
    <article className="panel members-panel">
      <div className="panel-heading">
        <div>
          <h2>{t('housemates')}</h2>
          <span>{t('membersCount', { count: members.length })}</span>
        </div>
        <Crown size={18} />
      </div>
      <div className="member-list">
        {members.map((member) => (
          <div key={member.id}>
            <span className="member-identity">
              <Avatar person={member} />
              <span>
                <strong>{member.name}</strong>
                <small>
                  {member.role === 'owner'
                    ? t('householdOwner')
                    : t('householdMember')}
                  {member.id === user.id ? ` · ${t('you')}` : ''}
                </small>
              </span>
            </span>
            {user.role === 'owner' && member.id !== user.id && (
              <span className="member-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSelection({ member, action: 'transfer' })}
                >
                  <Crown size={14} />
                  {t('transferOwnership')}
                </button>
                <button
                  type="button"
                  className="danger-text-button"
                  onClick={() => setSelection({ member, action: 'remove' })}
                >
                  <UserMinus size={14} />
                  {t('removeMember')}
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      {selection && (
        <form className="member-management-form" onSubmit={submit}>
          <strong>
            {selection.action === 'transfer'
              ? t('transferOwnershipTo', { name: selection.member.name })
              : t('removeMemberNamed', { name: selection.member.name })}
          </strong>
          <p>
            {selection.action === 'transfer'
              ? t('transferOwnershipCopy')
              : t('removeMemberCopy')}
          </p>
          <Field
            name="currentPassword"
            label={t('currentPassword')}
            type="password"
            maxLength={128}
            autoComplete="current-password"
          />
          {selection.action === 'remove' && (
            <Field
              name="confirmation"
              label={t('confirmMemberName', { name: selection.member.name })}
              maxLength={40}
              autoComplete="off"
            />
          )}
          <div>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => setSelection(null)}
            >
              {t('cancel')}
            </button>
            <button
              className={
                selection.action === 'remove'
                  ? 'danger-button'
                  : 'primary-button'
              }
              disabled={busy}
            >
              {selection.action === 'transfer'
                ? t('transferOwnership')
                : t('removeMember')}
            </button>
          </div>
        </form>
      )}
      {error && <div className="auth-error">{error}</div>}
    </article>
  );
}
