'use client';

import { useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Check,
  CircleDollarSign,
  CreditCard,
  Home,
  Pause,
  Play,
  Plus,
  WalletCards,
} from 'lucide-react';
import { formatDate, money, percentage } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import {
  Empty,
  PageTitle,
  PrivacyBadge,
  PrivacySelect,
} from '../../components/app-ui';
import type { CopyKey, Language } from '../../i18n';
import type { Data, Post, T } from '../types';

const expenseCategoryOptions: Array<{ value: string; key: CopyKey }> = [
  { value: 'groceries', key: 'groceries' },
  { value: 'housing', key: 'housing' },
  { value: 'rent', key: 'rent' },
  { value: 'utilities', key: 'utilities' },
  { value: 'subscriptions', key: 'subscriptions' },
  { value: 'loan', key: 'loanPayments' },
  { value: 'furniture', key: 'furniture' },
  { value: 'transport', key: 'transport' },
  { value: 'health', key: 'health' },
  { value: 'leisure', key: 'leisure' },
  { value: 'other', key: 'other' },
];
const expenseCategoryAliases: Record<string, string> = {
  Groceries: 'groceries',
  Housing: 'housing',
  Utilities: 'utilities',
  Furniture: 'furniture',
  Transport: 'transport',
  Other: 'other',
  Продукты: 'groceries',
  Жильё: 'housing',
  'Коммунальные услуги': 'utilities',
  Мебель: 'furniture',
  Транспорт: 'transport',
  Другое: 'other',
};
const spendingColors = [
  '#e86b43',
  '#708c67',
  '#557ea4',
  '#a6769d',
  '#d6a24b',
  '#4f9187',
  '#b96969',
  '#7f76b5',
  '#8a7865',
  '#6f8fa8',
  '#91926b',
];
const normalizedExpenseCategory = (category: string) =>
  expenseCategoryOptions.some((option) => option.value === category)
    ? category
    : expenseCategoryAliases[category] || 'other';
const expenseCategoryLabel = (category: string, t: T) => {
  const normalized = normalizedExpenseCategory(category);
  const option = expenseCategoryOptions.find(
    (candidate) => candidate.value === normalized,
  );
  return option ? t(option.key) : category;
};
export function SpendingView({
  data,
  total,
  post,
  t,
  language,
}: {
  data: Data;
  total: number;
  post: Post;
  t: T;
  language: Language;
}) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expenseSort, setExpenseSort] = useState('newest');
  const expenseForm = useRef<HTMLFormElement>(null);
  const categories = useMemo(() => {
    const totals = data.expenses.reduce<Record<string, number>>((all, item) => {
      const category = normalizedExpenseCategory(item.category);
      all[category] = (all[category] || 0) + Number(item.amount);
      return all;
    }, {});
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([category, value], index) => ({
        category,
        label: expenseCategoryLabel(category, t),
        value,
        color: spendingColors[index % spendingColors.length],
      }));
  }, [data.expenses, t]);
  const wheelBackground = useMemo(() => {
    if (!total) return '#ece8e0';
    let start = 0;
    return `conic-gradient(${categories
      .map((category) => {
        const end = start + (category.value / total) * 100;
        const segment = `${category.color} ${start}% ${end}%`;
        start = end;
        return segment;
      })
      .join(',')})`;
  }, [categories, total]);
  const visibleExpenses = useMemo(
    () =>
      data.expenses
        .filter(
          (expense) =>
            categoryFilter === 'all' ||
            normalizedExpenseCategory(expense.category) === categoryFilter,
        )
        .sort((left, right) => {
          if (expenseSort === 'highest')
            return Number(right.amount) - Number(left.amount);
          if (expenseSort === 'lowest')
            return Number(left.amount) - Number(right.amount);
          const direction = expenseSort === 'oldest' ? 1 : -1;
          return (
            direction * left.spentOn.localeCompare(right.spentOn) ||
            direction * (left.id - right.id)
          );
        }),
    [categoryFilter, data.expenses, expenseSort],
  );
  const monthlyCommitments = data.recurringPayments
    .filter((payment) => payment.active)
    .reduce(
      (sum, payment) =>
        sum +
        Number(payment.amount) / (payment.billingCycle === 'yearly' ? 12 : 1),
      0,
    );
  const nextMonth = new Date();
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const defaultDueDate = nextMonth.toISOString().slice(0, 10);
  const currentDate = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageTitle
        eyebrow={t('spendingEyebrow')}
        title={t('spending')}
        copy={t('spendingCopy')}
      />
      <div className="feature-grid">
        <article className="panel spend-hero">
          <span>{t('totalVisible')}</span>
          <strong>{money(total, language)}</strong>
          <div className="spending-wheel-layout">
            {categories.length ? (
              <>
                <figure
                  className="spending-wheel"
                  style={{ background: wheelBackground }}
                >
                  <span aria-hidden="true">
                    <b>{data.expenses.length}</b>
                    {t('entries')}
                  </span>
                  <figcaption className="sr-only">
                    {t('spendingBreakdown')}
                    <ul>
                      {categories.map((category) => (
                        <li key={category.category}>
                          {category.label}: {money(category.value, language)},{' '}
                          {t('percentOfSpending', {
                            percent: percentage(
                              category.value / total,
                              language,
                            ),
                          })}
                        </li>
                      ))}
                    </ul>
                  </figcaption>
                </figure>
                <div className="spending-wheel-legend">
                  {categories.map((category) => (
                    <button
                      type="button"
                      className={
                        categoryFilter === category.category ? 'active' : ''
                      }
                      aria-pressed={categoryFilter === category.category}
                      onClick={() =>
                        setCategoryFilter((current) =>
                          current === category.category
                            ? 'all'
                            : category.category,
                        )
                      }
                      key={category.category}
                    >
                      <i style={{ backgroundColor: category.color }} />
                      <span>{category.label}</span>
                      <span className="spending-wheel-value">
                        <b>{money(category.value, language)}</b>
                        <small>
                          {percentage(category.value / total, language)}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <Empty
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      expenseForm.current
                        ?.querySelector<HTMLInputElement>('[name="label"]')
                        ?.focus()
                    }
                  >
                    <Plus size={15} />
                    {t('addFirstExpense')}
                  </button>
                }
              >
                {t('noExpenses')}
              </Empty>
            )}
          </div>
        </article>
        <article className="panel entry-panel">
          <h2>{t('addExpense')}</h2>
          <p>{t('expenseHint')}</p>
          <form
            ref={expenseForm}
            className="form-grid"
            onSubmit={(event) => submitForm(event, post, 'expense')}
          >
            <Field
              name="label"
              label={t('whatWasIt')}
              placeholder={t('cleaningSupplies')}
            />
            <Field
              name="amount"
              label={t('amountRub')}
              type="number"
              min="0.01"
              max={1_000_000}
              step="0.01"
            />
            <label className="form-field">
              <span>{t('category')}</span>
              <select name="category" defaultValue="groceries">
                {expenseCategoryOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {t(option.key)}
                  </option>
                ))}
              </select>
            </label>
            <PrivacySelect t={t} />
            <button className="primary-button">
              <Plus size={16} />
              {t('addExpense')}
            </button>
          </form>
        </article>
      </div>
      <article className="panel recurring-panel">
        <div className="panel-heading recurring-heading">
          <div>
            <h2>{t('scheduledPayments')}</h2>
            <span>{t('scheduledPaymentsCopy')}</span>
          </div>
          <div className="commitment-total">
            <small>{t('monthlyCommitments')}</small>
            <strong>{money(monthlyCommitments, language)}</strong>
          </div>
        </div>
        <form
          className="recurring-form"
          onSubmit={(event) => submitForm(event, post, 'recurring-payment')}
        >
          <label className="form-field">
            <span>{t('paymentType')}</span>
            <select name="kind" defaultValue="subscription">
              <option value="subscription">{t('subscription')}</option>
              <option value="loan">{t('loanPayment')}</option>
              <option value="rent">{t('apartmentRent')}</option>
            </select>
          </label>
          <Field
            name="label"
            label={t('paymentName')}
            placeholder={t('paymentNamePlaceholder')}
          />
          <Field
            name="amount"
            label={t('paymentAmount')}
            type="number"
            min="0.01"
            max={1_000_000}
            step="0.01"
          />
          <label className="form-field">
            <span>{t('billingCycle')}</span>
            <select name="billingCycle" defaultValue="monthly">
              <option value="monthly">{t('monthly')}</option>
              <option value="yearly">{t('yearly')}</option>
            </select>
          </label>
          <Field
            name="nextDueOn"
            label={t('nextDueDate')}
            type="date"
            defaultValue={defaultDueDate}
          />
          <label className="form-field">
            <span>{t('loanRemaining')}</span>
            <input
              name="remainingAmount"
              type="number"
              min="0"
              step="any"
              placeholder={t('loanOnly')}
            />
          </label>
          <PrivacySelect t={t} />
          <button className="primary-button">
            <Plus size={16} />
            {t('addScheduledPayment')}
          </button>
        </form>
        <div className="payment-card-grid">
          {data.recurringPayments.length ? (
            data.recurringPayments.map((payment) => {
              const Icon =
                payment.kind === 'subscription'
                  ? CreditCard
                  : payment.kind === 'loan'
                    ? CircleDollarSign
                    : Home;
              const overdue =
                Boolean(payment.active) && payment.nextDueOn < currentDate;
              return (
                <section
                  className={`payment-card${!payment.active ? ' paused' : ''}${overdue ? ' overdue' : ''}`}
                  key={payment.id}
                >
                  <header>
                    <span className="payment-kind-icon">
                      <Icon size={17} />
                    </span>
                    <div>
                      <small>
                        {t(
                          payment.kind === 'subscription'
                            ? 'subscription'
                            : payment.kind === 'loan'
                              ? 'loanPayment'
                              : 'apartmentRent',
                        )}
                      </small>
                      <strong>{payment.label}</strong>
                    </div>
                    <PrivacyBadge visibility={payment.visibility} t={t} />
                  </header>
                  <div className="payment-amount-row">
                    <strong>{money(Number(payment.amount), language)}</strong>
                    <span>
                      {payment.billingCycle === 'yearly'
                        ? t('perYear')
                        : t('perMonth')}
                    </span>
                  </div>
                  <div className="payment-meta">
                    <span>
                      <CalendarClock size={14} />
                      {overdue ? t('overdue') : t('nextDue')}:{' '}
                      {formatDate(payment.nextDueOn, language)}
                    </span>
                    {payment.remainingAmount !== null && (
                      <span>
                        {t('remainingBalance')}:{' '}
                        {money(Number(payment.remainingAmount), language)}
                      </span>
                    )}
                    {!payment.owned && <span>{t('sharedHousemate')}</span>}
                  </div>
                  {payment.owned && (
                    <footer>
                      {payment.active && (
                        <button
                          type="button"
                          className="primary-button compact-button"
                          onClick={() =>
                            void post({
                              type: 'recurring-payment-pay',
                              id: payment.id,
                            })
                          }
                        >
                          <Check size={14} />
                          {t('recordPayment')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() =>
                          void post({
                            type: 'recurring-payment-toggle',
                            id: payment.id,
                            active: !payment.active,
                          })
                        }
                      >
                        {payment.active ? (
                          <Pause size={14} />
                        ) : (
                          <Play size={14} />
                        )}
                        {payment.active ? t('pause') : t('resume')}
                      </button>
                    </footer>
                  )}
                </section>
              );
            })
          ) : (
            <Empty>{t('noScheduledPayments')}</Empty>
          )}
        </div>
      </article>
      <article className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('recentExpenses')}</h2>
            <span>
              {t('visibleEntries', { count: visibleExpenses.length })}
            </span>
          </div>
          <div className="expense-controls">
            <label>
              <span>{t('filter')}</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">{t('allCategories')}</option>
                {expenseCategoryOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {t(option.key)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('sortBy')}</span>
              <select
                value={expenseSort}
                onChange={(event) => setExpenseSort(event.target.value)}
              >
                <option value="newest">{t('newest')}</option>
                <option value="oldest">{t('oldest')}</option>
                <option value="highest">{t('highestAmount')}</option>
                <option value="lowest">{t('lowestAmount')}</option>
              </select>
            </label>
          </div>
        </div>
        <div className="expense-list">
          {visibleExpenses.length ? (
            visibleExpenses.map((item) => (
              <div key={item.id}>
                <span className="expense-icon">
                  <WalletCards size={16} />
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small>
                    {expenseCategoryLabel(item.category, t)} ·{' '}
                    {formatDate(item.spentOn, language)}
                    {!item.owned ? ` · ${t('sharedHousemate')}` : ''}
                  </small>
                </div>
                <PrivacyBadge visibility={item.visibility} t={t} />
                <b>{money(Number(item.amount), language)}</b>
              </div>
            ))
          ) : (
            <Empty
              action={
                categoryFilter !== 'all' ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setCategoryFilter('all')}
                  >
                    {t('clearFilters')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      expenseForm.current
                        ?.querySelector<HTMLInputElement>('[name="label"]')
                        ?.focus()
                    }
                  >
                    <Plus size={15} />
                    {t('addFirstExpense')}
                  </button>
                )
              }
            >
              {t('noExpenses')}
            </Empty>
          )}
        </div>
      </article>
    </>
  );
}
