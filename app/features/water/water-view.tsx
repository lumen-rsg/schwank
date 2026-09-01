'use client';

import { Droplets, Lock, Plus } from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import { Empty, PageTitle } from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, Post, T } from '../types';

export function WaterView({
  data,
  user,
  post,
  t,
}: {
  data: Data;
  user: AuthUser;
  post: Post;
  t: T;
  language: Language;
}) {
  const total = data.water.reduce(
    (sum, item) => sum + Number(item.amountMl),
    0,
  );
  const remaining = Math.max(0, user.waterGoal - total);
  const percent = Math.min(100, (total / user.waterGoal) * 100);
  return (
    <>
      <PageTitle
        eyebrow={t('waterEyebrow')}
        title={t('water')}
        copy={t('waterCopy')}
      />
      <div className="water-grid">
        <article className="panel water-hero">
          <span className="tinted-icon blue">
            <Droplets size={22} />
          </span>
          <div className="water-number">
            <strong>{total}</strong>
            <span>ml</span>
          </div>
          <p>{t('mlRemaining', { count: remaining })}</p>
          <div className="water-progress">
            <i style={{ width: `${percent}%` }} />
          </div>
          <div className="water-goal-label">
            <span>{t('todayWater')}</span>
            <b>{user.waterGoal} ml</b>
          </div>
          <div className="quick-water">
            <span>{t('quickAdd')}</span>
            <div>
              {[250, 500, 750].map((amount) => (
                <button
                  type="button"
                  key={amount}
                  onClick={() => post({ type: 'water', amountMl: amount })}
                >
                  +{amount} ml
                </button>
              ))}
            </div>
          </div>
        </article>
        <article className="panel entry-panel">
          <h2>{t('addWater')}</h2>
          <p>
            <Lock size={12} />
            {t('privateWater')}
          </p>
          <form
            className="form-grid water-form"
            onSubmit={(event) => submitForm(event, post, 'water')}
          >
            <Field
              name="amountMl"
              label={t('customAmount')}
              type="number"
              min={1}
              max={10_000}
              step={1}
            />
            <button className="primary-button">
              <Plus size={16} />
              {t('addWater')}
            </button>
          </form>
          <form
            key={user.waterGoal}
            className="goal-form"
            onSubmit={(event) => submitForm(event, post, 'water-goal')}
          >
            <Field
              name="waterGoal"
              label={t('waterGoal')}
              type="number"
              min={250}
              max={10_000}
              step={1}
              defaultValue={String(user.waterGoal)}
            />
            <button className="secondary-button">{t('setGoal')}</button>
          </form>
        </article>
      </div>
      <article className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('waterEntries')}</h2>
            <span>{t('privateWater')}</span>
          </div>
          <Lock size={17} />
        </div>
        <div className="water-entry-list">
          {data.water.length ? (
            data.water.map((item) => (
              <div key={item.id}>
                <span className="tinted-icon blue">
                  <Droplets size={15} />
                </span>
                <strong>{item.amountMl} ml</strong>
                <small>
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </small>
              </div>
            ))
          ) : (
            <Empty>{t('noWater')}</Empty>
          )}
        </div>
      </article>
    </>
  );
}
