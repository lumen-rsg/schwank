'use client';

import { useState } from 'react';
import {
  Check,
  Droplets,
  Edit3,
  History,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { dateKey } from '../../client/dates';
import { formatDate } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import { ConfirmAction, Empty, PageTitle } from '../../components/app-ui';
import type { Language } from '../../i18n';
import {
  waterDailyHistoryWindow,
  waterHistoryWindow,
} from '../health/health-calculations';
import type { Data, Post, T } from '../types';

type WaterRange = 7 | 30 | 90;

export function WaterView({
  data,
  user,
  post,
  t,
  language,
  waterHistoryLoading,
  loadOlderWaterHistory,
}: {
  data: Data;
  user: AuthUser;
  post: Post;
  t: T;
  language: Language;
  waterHistoryLoading: boolean;
  loadOlderWaterHistory: () => Promise<boolean>;
}) {
  const today = dateKey(new Date());
  const [range, setRange] = useState<WaterRange>(7);
  const [editingId, setEditingId] = useState<number | null>(null);
  const total = Number(
    data.waterHistoryDays.find((day) => day.day === today)?.amountMl ?? 0,
  );
  const remaining = Math.max(0, user.waterGoal - total);
  const percent = Math.min(100, (total / user.waterGoal) * 100);
  const loadedHistory = waterHistoryWindow(data.water, range);
  const history = waterDailyHistoryWindow(data.waterHistoryDays, range);
  const maximum = Math.max(
    user.waterGoal,
    ...history.daily.map((day) => day.amountMl),
  );
  const goalDays = history.daily.filter(
    (day) => day.amountMl >= user.waterGoal,
  ).length;
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
            <progress
              className="sr-only"
              value={Math.min(total, user.waterGoal)}
              max={user.waterGoal}
              aria-label={t('waterProgress', {
                current: total,
                goal: user.waterGoal,
              })}
            />
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
            <Field
              name="drunkOn"
              label={t('date')}
              type="date"
              max={today}
              defaultValue={today}
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
      <article className="panel table-panel water-history-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('waterHistory')}</h2>
            <span>{t('privateWater')}</span>
          </div>
          <History size={17} />
        </div>
        <fieldset className="water-range-tabs">
          <legend className="sr-only">{t('historyRange')}</legend>
          {([7, 30, 90] as WaterRange[]).map((days) => (
            <button
              type="button"
              className={range === days ? 'selected' : ''}
              aria-pressed={range === days}
              onClick={() => setRange(days)}
              key={days}
            >
              {t('lastDays', { count: days })}
            </button>
          ))}
        </fieldset>
        <div className="water-history-summary">
          <span>
            <small>{t('dailyAverage')}</small>
            <strong>{Math.round(history.totalMl / range)} ml</strong>
          </span>
          <span>
            <small>{t('waterGoalDays')}</small>
            <strong>{goalDays}</strong>
          </span>
        </div>
        <figure
          className="water-history-chart"
          aria-label={t('waterTrendLabel', { days: range })}
        >
          <div>
            {history.daily.map((day) => (
              <span key={day.day} title={`${day.day}: ${day.amountMl} ml`}>
                <i
                  style={{
                    height: `${Math.max(2, (day.amountMl / maximum) * 100)}%`,
                  }}
                />
              </span>
            ))}
          </div>
          <figcaption>
            {t('waterGoalLine', { count: user.waterGoal })}
          </figcaption>
          <ul className="sr-only">
            {history.daily.map((day) => (
              <li key={day.day}>
                {formatDate(day.day, language)}: {day.amountMl} ml
              </li>
            ))}
          </ul>
        </figure>
        <div className="water-entry-list water-history-list">
          {loadedHistory.visible.length ? (
            loadedHistory.visible.map((item) =>
              editingId === item.id ? (
                <form
                  className="water-edit-form"
                  key={item.id}
                  onSubmit={async (event) => {
                    const saved = await submitForm(
                      event,
                      post,
                      'water-update',
                      { id: String(item.id) },
                    );
                    if (saved) setEditingId(null);
                  }}
                >
                  <Field
                    name="amountMl"
                    label={t('customAmount')}
                    type="number"
                    min={1}
                    max={10_000}
                    step={1}
                    defaultValue={String(item.amountMl)}
                  />
                  <Field
                    name="drunkOn"
                    label={t('date')}
                    type="date"
                    max={today}
                    defaultValue={item.drunkOn}
                  />
                  <div className="water-edit-actions">
                    <button className="primary-button">
                      <Check size={14} /> {t('save')}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setEditingId(null)}
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </form>
              ) : (
                <div key={item.id}>
                  <span className="tinted-icon blue">
                    <Droplets size={15} />
                  </span>
                  <strong>{item.amountMl} ml</strong>
                  <small>{formatDate(item.drunkOn, language)}</small>
                  <div className="water-entry-actions">
                    <button
                      type="button"
                      aria-label={t('editWaterEntry', { count: item.amountMl })}
                      onClick={() => setEditingId(item.id)}
                    >
                      <Edit3 size={13} />
                    </button>
                    <ConfirmAction
                      label={t('deleteWaterEntry', { count: item.amountMl })}
                      title={t('deleteWaterTitle')}
                      description={t('deleteWaterWarning', {
                        count: item.amountMl,
                      })}
                      confirmLabel={t('delete')}
                      cancelLabel={t('cancel')}
                      onConfirm={() =>
                        post({ type: 'water-remove', id: item.id })
                      }
                    >
                      <Trash2 size={13} />
                    </ConfirmAction>
                  </div>
                </div>
              ),
            )
          ) : (
            <Empty>{t('noWaterHistory')}</Empty>
          )}
        </div>
        {data.waterHistoryHasMore && (
          <div className="history-pagination" aria-live="polite">
            <span>
              {t('historyEntriesLoaded', {
                loaded: data.water.length,
                total: data.waterHistoryCount,
              })}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={waterHistoryLoading}
              onClick={() => void loadOlderWaterHistory()}
            >
              <History size={14} aria-hidden="true" />
              {waterHistoryLoading
                ? t('loadingOlderHistory')
                : t('loadOlderHistory')}
            </button>
          </div>
        )}
      </article>
    </>
  );
}
