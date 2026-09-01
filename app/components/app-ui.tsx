'use client';

import Image from 'next/image';
import { Languages, Lock, Users } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import type { Language } from '../i18n';
import type { T, Visibility } from '../features/types';
export function Avatar({
  person,
  small = false,
}: {
  person: { initials?: string; color?: string; avatar?: string | null };
  small?: boolean;
}) {
  return (
    <span
      className={small ? 'avatar avatar-small' : 'avatar'}
      style={{ backgroundColor: person.color }}
    >
      {person.avatar ? (
        <Image
          src={person.avatar}
          alt=""
          width={small ? 27 : 34}
          height={small ? 27 : 34}
          unoptimized
        />
      ) : (
        person.initials
      )}
    </span>
  );
}
export function PrivacySelect({
  t,
  defaultValue = 'private',
}: {
  t: T;
  defaultValue?: Visibility;
}) {
  return (
    <label className="form-field">
      <span>{t('privacy')}</span>
      <select name="visibility" defaultValue={defaultValue}>
        <option value="private">{t('private')}</option>
        <option value="shared">{t('shared')}</option>
      </select>
    </label>
  );
}
export function PrivacyBadge({
  visibility,
  t,
}: {
  visibility: Visibility;
  t: T;
}) {
  return (
    <span className={`privacy-badge ${visibility}`}>
      {visibility === 'private' ? <Lock size={11} /> : <Users size={11} />}{' '}
      {t(visibility)}
    </span>
  );
}
export function Empty({
  children,
  action,
}: {
  children: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p>{children}</p>
      {action}
    </div>
  );
}
export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  cancelLabel,
  className,
  children,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  className?: string;
  children: ReactNode;
  onConfirm: () => unknown;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        {children}
      </button>
      <dialog
        ref={dialog}
        className="confirm-dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => trigger.current?.focus()}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <form method="dialog">
          <button className="secondary-button">{cancelLabel}</button>
          <button
            className="danger-button"
            value="confirm"
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </button>
        </form>
      </dialog>
    </>
  );
}
export function PageTitle({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="welcome">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 tabIndex={-1}>
          {title} <span>✦</span>
        </h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}
export function LanguageSwitch({
  language,
  setLanguage,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
}) {
  return (
    <label className="language-switch">
      <Languages size={15} />
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        aria-label="Language"
      >
        <option value="en">EN</option>
        <option value="ru">RU</option>
      </select>
    </label>
  );
}
