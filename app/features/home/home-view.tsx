'use client';

import { useState } from 'react';
import {
  Camera,
  Home,
  Image as ImageIcon,
  LoaderCircle,
  Lock,
  Sparkles,
} from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { withFormSubmission } from '../../client/forms';
import { imagePreparationMessage, resizeImage } from '../../client/image';
import { Field } from '../../components/app-field';
import { Avatar, PageTitle } from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, Post, T } from '../types';
import {
  AccountDataCard,
  AccountSecurityCard,
  EnrollmentCard,
  MembersCard,
} from './account-cards';
export function HomeView({
  data,
  user,
  post,
  t,
  language,
}: {
  data: Data;
  user: AuthUser;
  post: Post;
  t: T;
  language: Language;
}) {
  const [homePhoto, setHomePhoto] = useState<string | null>(data.home.photo);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [imageError, setImageError] = useState('');
  async function pickHome(file?: File) {
    if (!file) return;
    setPreparing(true);
    setImageError('');
    try {
      setHomePhoto(await resizeImage(file, 1400, 900, 0.8));
      setPhotoChanged(true);
    } catch (cause) {
      setImageError(imagePreparationMessage(cause, t));
    } finally {
      setPreparing(false);
    }
  }
  async function pickAvatar(file?: File) {
    if (!file) return;
    setPreparing(true);
    setImageError('');
    try {
      await post({
        type: 'avatar',
        avatar: await resizeImage(file, 512, 512, 0.84),
      });
    } catch (cause) {
      setImageError(imagePreparationMessage(cause, t));
    } finally {
      setPreparing(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={t('homeEyebrow')}
        title={t('homeTitle')}
        copy={t('homeCopy')}
      />
      <div className="settings-grid">
        <article className="panel home-settings-card">
          <div
            className="home-photo-editor"
            style={
              homePhoto
                ? {
                    backgroundImage: `linear-gradient(#0003,#0003),url(${homePhoto})`,
                  }
                : undefined
            }
          >
            {!homePhoto && <ImageIcon size={30} />}
            {user.role === 'owner' && (
              <label className="photo-button">
                <Camera size={15} />
                {homePhoto ? t('replacePhoto') : t('choosePhoto')}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={preparing}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    void pickHome(file);
                  }}
                />
              </label>
            )}
          </div>
          <form
            className="settings-form"
            onSubmit={(event) =>
              withFormSubmission(event, async (form) => {
                const values = new FormData(form);
                const nameValue = values.get('name');
                const addressValue = values.get('address');
                const payload: Record<string, string | boolean> = {
                  type: 'home',
                  name: typeof nameValue === 'string' ? nameValue : '',
                  address: typeof addressValue === 'string' ? addressValue : '',
                };
                if (photoChanged) payload.photo = homePhoto || '';
                const saved = await post(payload);
                if (saved) setPhotoChanged(false);
                return saved;
              })
            }
          >
            <Field
              name="name"
              label={t('homeName')}
              placeholder={t('homeNamePlaceholder')}
              defaultValue={data.home.name}
              disabled={user.role !== 'owner'}
            />
            <Field
              name="address"
              label={t('address')}
              placeholder={t('addressPlaceholder')}
              defaultValue={data.home.address}
              disabled={user.role !== 'owner'}
            />
            {homePhoto && user.role === 'owner' && (
              <button
                type="button"
                className="danger-text-button"
                onClick={() => {
                  setHomePhoto(null);
                  setPhotoChanged(true);
                }}
              >
                {t('removePhoto')}
              </button>
            )}
            {user.role === 'owner' ? (
              <button className="primary-button">
                <Home size={16} />
                {t('saveHome')}
              </button>
            ) : (
              <p className="owner-settings-note">
                <Lock size={14} />
                {t('homeSettingsOwnerCopy')}
              </p>
            )}
          </form>
        </article>
        <div className="settings-stack">
          <article className="panel profile-settings">
            <div className="profile-avatar-large">
              <Avatar person={user} />
              <label className="avatar-upload">
                <Camera size={15} />
                <span>
                  {user.avatar ? t('replaceAvatar') : t('chooseAvatar')}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={preparing}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    void pickAvatar(file);
                  }}
                />
              </label>
            </div>
            <div>
              <h2>{t('profileTitle')}</h2>
              <p>{t('profileCopy')}</p>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              {user.avatar && (
                <button
                  className="danger-text-button"
                  onClick={() => post({ type: 'avatar', avatar: '' })}
                >
                  {t('removeAvatar')}
                </button>
              )}
            </div>
          </article>
          <article className="panel ai-consent-card">
            <div className="ai-consent-icon">
              <Sparkles size={19} />
            </div>
            <div>
              <h2>{t('aiConsentTitle')}</h2>
              <p>{t('aiConsentCopy')}</p>
              <span>
                <Lock size={13} />
                {user.aiConsent
                  ? t('aiConsentEnabled')
                  : t('aiConsentDisabled')}
              </span>
            </div>
            <button
              className={user.aiConsent ? 'secondary-button' : 'primary-button'}
              onClick={() =>
                post({ type: 'ai-consent', enabled: !user.aiConsent })
              }
            >
              {user.aiConsent ? t('disableAiConsent') : t('enableAiConsent')}
            </button>
          </article>
          <AccountSecurityCard t={t} language={language} />
          <AccountDataCard
            user={user}
            memberCount={data.members.length}
            t={t}
          />
          {user.role === 'owner' && (
            <EnrollmentCard t={t} language={language} />
          )}
          <MembersCard user={user} members={data.members} t={t} />
          <p className="image-hint">
            {preparing ? (
              <>
                <LoaderCircle className="spin" size={14} />
                {t('uploading')}
              </>
            ) : (
              <>
                <ImageIcon size={14} />
                {t('imageHint')}
              </>
            )}
          </p>
          {imageError && <div className="auth-error">{imageError}</div>}
        </div>
      </div>
    </>
  );
}
