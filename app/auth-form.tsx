'use client';

import Link from 'next/link';
import { useEffect, useState, type SubmitEvent } from 'react';
import {
  ArrowRight,
  Languages,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';
import { useLanguage, type Language } from './i18n';
import { apiErrorMessage } from './api-error-copy';
import type { ApiErrorPayload } from '@/lib/api-errors';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { language, setLanguage, t } = useLanguage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState<{
    firstUser: boolean;
    registrationOpen: boolean;
  } | null>(null);
  const registering = mode === 'register';

  useEffect(() => {
    if (!registering) return;
    void fetch('/api/auth/enrollment', { cache: 'no-store' })
      .then(
        (response) =>
          response.json() as Promise<{
            firstUser: boolean;
            registrationOpen: boolean;
          }>,
      )
      .then(setEnrollment)
      .catch(() => setEnrollment(null));
  }, [registering]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
          inviteCode: form.get('inviteCode'),
        }),
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ApiErrorPayload>;
      if (response.ok) {
        window.location.assign('/');
        return;
      }
      setError(apiErrorMessage(payload, t, 'somethingWrong'));
    } catch {
      setError(t('somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-card-top">
          <Link className="auth-brand" href="/">
            <span className="brand-mark">
              <Sparkles size={18} />
            </span>
            <strong>schwank</strong>
          </Link>
          <label className="language-switch">
            <Languages size={15} />
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
              aria-label={t('language')}
            >
              <option value="en">EN</option>
              <option value="ru">RU</option>
            </select>
          </label>
        </div>
        <div className="auth-icon">
          <LockKeyhole size={22} />
        </div>
        <span className="eyebrow">{t('privateWorkspace')}</span>
        <h1>{registering ? t('createAccount') : t('welcomeBack')}</h1>
        <p>{registering ? t('registerCopy') : t('loginCopy')}</p>
        <form onSubmit={submit}>
          {registering && (
            <label>
              <span>{t('yourName')}</span>
              <input
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={40}
                required
              />
            </label>
          )}
          {registering && enrollment && !enrollment.firstUser && (
            <label>
              <span>{t('inviteCode')}</span>
              <input
                name="inviteCode"
                autoComplete="off"
                placeholder={t('inviteCodePlaceholder')}
                maxLength={32}
                required
                disabled={!enrollment.registrationOpen}
              />
              <small>
                {enrollment.registrationOpen
                  ? t('inviteCodeHint')
                  : t('registrationClosed')}
              </small>
            </label>
          )}
          <label>
            <span>{t('email')}</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label>
            <span>{t('password')}</span>
            <input
              name="password"
              type="password"
              autoComplete={registering ? 'new-password' : 'current-password'}
              minLength={12}
              maxLength={128}
              required
            />
            <small>{registering ? t('passwordHint') : ''}</small>
          </label>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="primary-button auth-submit"
            disabled={
              busy ||
              (registering &&
                enrollment !== null &&
                !enrollment.registrationOpen)
            }
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <>
                {registering ? t('createAccount') : t('signIn')}
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
        <footer>
          {registering ? t('alreadyAccount') : t('newHere')}{' '}
          <Link href={registering ? '/login' : '/register'}>
            {registering ? t('signIn') : t('createAnAccount')}
          </Link>
        </footer>
      </section>
    </main>
  );
}
