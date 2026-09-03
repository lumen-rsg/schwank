'use client';

import { useState } from 'react';
import { Check, Edit3, History, Trash2 } from 'lucide-react';
import type { AuthUser } from '@/db/auth';
import { dateKey } from '../../client/dates';
import { formatDate } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import {
  ConfirmAction,
  Empty,
  PrivacyBadge,
  PrivacySelect,
} from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Nutrition, NutritionHistoryDay, Post, T } from '../types';
import {
  nutritionDailyHistoryWindow,
  nutritionHistoryWindow,
} from './nutrition-calculations';

type HistoryRange = 1 | 7 | 30 | 90;

export function NutritionHistory({
  items,
  user,
  post,
  t,
  language,
  historyDays,
  historyCount,
  hasMore,
  historyLoading,
  loadOlderHistory,
}: {
  items: Nutrition[];
  user: AuthUser;
  post: Post;
  t: T;
  language: Language;
  historyDays: NutritionHistoryDay[];
  historyCount: number;
  hasMore: boolean;
  historyLoading: boolean;
  loadOlderHistory: () => Promise<boolean>;
}) {
  const [range, setRange] = useState<HistoryRange>(7);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { visible } = nutritionHistoryWindow(items, range);
  const { totals, daily, entryCount } = nutritionDailyHistoryWindow(
    historyDays,
    range,
  );
  const maximumCalories = Math.max(
    user.calorieGoal,
    ...daily.map((day) => day.totals.calories),
  );
  return (
    <article className="panel nutrition-history-panel">
      <div className="panel-heading">
        <div>
          <h2>{t('nutritionHistory')}</h2>
          <span>{t('nutritionHistoryPrivate')}</span>
        </div>
        <History size={19} />
      </div>
      <fieldset className="nutrition-range-tabs">
        <legend className="sr-only">{t('historyRange')}</legend>
        {([1, 7, 30, 90] as HistoryRange[]).map((daysCount) => (
          <button
            type="button"
            className={range === daysCount ? 'selected' : ''}
            aria-pressed={range === daysCount}
            onClick={() => setRange(daysCount)}
            key={daysCount}
          >
            {daysCount === 1 ? t('today') : t('lastDays', { count: daysCount })}
          </button>
        ))}
      </fieldset>
      <div className="nutrition-history-summary">
        <span>
          <small>{t('averageCalories')}</small>
          <strong>{Math.round(totals.calories / range)}</strong>
          <b>kcal/{t('dayShort')}</b>
        </span>
        <span>
          <small>{t('averageProtein')}</small>
          <strong>{Math.round(totals.protein / range)}</strong>
          <b>g/{t('dayShort')}</b>
        </span>
        <span>
          <small>{t('loggedMeals')}</small>
          <strong>{entryCount}</strong>
          <b>{t('entries')}</b>
        </span>
      </div>
      <figure
        className="nutrition-history-chart"
        aria-label={t('nutritionTrendLabel', { days: range })}
      >
        <div>
          {daily.map(({ day, totals: dayTotals }) => (
            <span key={day} title={`${day}: ${dayTotals.calories} kcal`}>
              <i
                style={{
                  height: `${Math.max(2, (dayTotals.calories / maximumCalories) * 100)}%`,
                }}
              />
            </span>
          ))}
        </div>
        <figcaption>
          {t('calorieGoalLine', { count: user.calorieGoal })}
        </figcaption>
        <ul className="sr-only">
          {daily.map(({ day, totals: dayTotals }) => (
            <li key={day}>
              {formatDate(day, language)}: {dayTotals.calories} kcal
            </li>
          ))}
        </ul>
      </figure>
      <div className="data-table nutrition-table nutrition-history-list">
        {visible.length ? (
          visible.map((item) =>
            editingId === item.id ? (
              <form
                className="nutrition-edit-form"
                key={item.id}
                onSubmit={async (event) => {
                  const saved = await submitForm(
                    event,
                    post,
                    'nutrition-update',
                    { id: String(item.id) },
                  );
                  if (saved) setEditingId(null);
                }}
              >
                <Field
                  name="label"
                  label={t('meal')}
                  defaultValue={item.label}
                />
                <Field
                  name="calories"
                  label={`${t('calories')} (kcal)`}
                  type="number"
                  min={0}
                  max={20_000}
                  step={1}
                  defaultValue={String(item.calories)}
                />
                <Field
                  name="protein"
                  label={`${t('protein')} (g)`}
                  type="number"
                  min={0}
                  max={2_000}
                  step={1}
                  defaultValue={String(item.protein)}
                />
                <Field
                  name="carbs"
                  label={`${t('carbs')} (g)`}
                  type="number"
                  min={0}
                  max={2_000}
                  step={1}
                  defaultValue={String(item.carbs)}
                />
                <Field
                  name="fat"
                  label={`${t('fats')} (g)`}
                  type="number"
                  min={0}
                  max={2_000}
                  step={1}
                  defaultValue={String(item.fat)}
                />
                <Field
                  name="eatenOn"
                  label={t('mealDate')}
                  type="date"
                  max={dateKey(new Date())}
                  defaultValue={item.eatenOn}
                />
                <PrivacySelect t={t} defaultValue={item.visibility} />
                <div className="nutrition-edit-actions">
                  <button className="primary-button">
                    <Check size={14} />
                    {t('save')}
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
                <div className="nutrition-meal-copy">
                  <strong>{item.label}</strong>
                  <small>{formatDate(item.eatenOn, language)}</small>
                </div>
                <span>{item.calories} kcal</span>
                <span>{item.protein}P</span>
                <span>{item.carbs}C</span>
                <span>{item.fat}F</span>
                <PrivacyBadge visibility={item.visibility} t={t} />
                <div className="nutrition-row-actions">
                  <button
                    type="button"
                    aria-label={t('editMeal', { meal: item.label })}
                    onClick={() => setEditingId(item.id)}
                  >
                    <Edit3 size={13} />
                  </button>
                  <ConfirmAction
                    label={t('deleteMeal', { meal: item.label })}
                    title={t('deleteMealTitle')}
                    description={t('deleteMealWarning', { meal: item.label })}
                    confirmLabel={t('delete')}
                    cancelLabel={t('cancel')}
                    onConfirm={async () => {
                      const removed = await post({
                        type: 'nutrition-remove',
                        id: item.id,
                      });
                      if (removed && editingId === item.id) setEditingId(null);
                    }}
                  >
                    <Trash2 size={13} />
                  </ConfirmAction>
                </div>
              </div>
            ),
          )
        ) : (
          <Empty>{t('noNutritionHistory')}</Empty>
        )}
      </div>
      {hasMore && (
        <div className="history-pagination" aria-live="polite">
          <span>
            {t('historyEntriesLoaded', {
              loaded: items.length,
              total: historyCount,
            })}
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={historyLoading}
            onClick={() => void loadOlderHistory()}
          >
            <History size={14} aria-hidden="true" />
            {historyLoading ? t('loadingOlderHistory') : t('loadOlderHistory')}
          </button>
        </div>
      )}
    </article>
  );
}
