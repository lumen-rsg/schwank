'use client';

import { useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Check,
  CircleDollarSign,
  CreditCard,
  Edit3,
  History,
  Home,
  Pause,
  Play,
  Plus,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { dateKey } from '../../client/dates';
import { formatDate, money, percentage } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import {
  ConfirmAction,
  Empty,
  PageTitle,
  PrivacyBadge,
  PrivacySelect,
} from '../../components/app-ui';
import type { CopyKey, Language } from '../../i18n';
import {
  expensesInRange,
  monthlyBudgetSpend,
  normalizeExpenseCategory,
  type SpendingRange,
} from '../../../lib/spending-calculations';
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
const expenseCategoryLabel = (category: string, t: T) => {
  const normalized = normalizeExpenseCategory(category);
  const option = expenseCategoryOptions.find(
    (candidate) => candidate.value === normalized,
  );
  return option ? t(option.key) : category;
};
export function SpendingView({
  data,
  post,
  t,
  language,
}: {
  data: Data;
  post: Post;
  t: T;
  language: Language;
}) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expenseSort, setExpenseSort] = useState('newest');
  const [dateRange, setDateRange] = useState<SpendingRange>('month');
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const expenseForm = useRef<HTMLFormElement>(null);
  const currentDate = dateKey(new Date());
  const rangeExpenses = useMemo(
    () => expensesInRange(data.expenses, dateRange, currentDate),
    [currentDate, data.expenses, dateRange],
  );
  const rangeTotal = rangeExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0,
  );
  const categories = useMemo(() => {
    const totals = rangeExpenses.reduce<Record<string, number>>((all, item) => {
      const category = normalizeExpenseCategory(item.category);
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
  }, [rangeExpenses, t]);
  const wheelBackground = useMemo(() => {
    if (!rangeTotal) return '#ece8e0';
    let start = 0;
    return `conic-gradient(${categories
      .map((category) => {
        const end = start + (category.value / rangeTotal) * 100;
        const segment = `${category.color} ${start}% ${end}%`;
        start = end;
        return segment;
      })
      .join(',')})`;
  }, [categories, rangeTotal]);
  const visibleExpenses = useMemo(
    () =>
      rangeExpenses
        .filter(
          (expense) =>
            categoryFilter === 'all' ||
            normalizeExpenseCategory(expense.category) === categoryFilter,
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
    [categoryFilter, expenseSort, rangeExpenses],
  );
  const paymentHistory = data.expenses.filter(
    (expense) => expense.recurringPaymentId !== null,
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
  return (
    <>
      <PageTitle
        eyebrow={t('spendingEyebrow')}
        title={t('spending')}
        copy={t('spendingCopy')}
      />
      <div className="feature-grid">
        <article className="panel spend-hero">
          <div className="spend-summary-heading">
            <span>{t('totalVisible')}</span>
            <label>
              <span className="sr-only">{t('dateRange')}</span>
              <select
                value={dateRange}
                onChange={(event) =>
                  setDateRange(event.target.value as SpendingRange)
                }
              >
                <option value="month">{t('currentMonth')}</option>
                <option value="30-days">{t('last30Days')}</option>
                <option value="90-days">{t('last90Days')}</option>
                <option value="all">{t('allTime')}</option>
              </select>
            </label>
          </div>
          <strong>{money(rangeTotal, language)}</strong>
          <div className="spending-wheel-layout">
            {categories.length ? (
              <>
                <figure
                  className="spending-wheel"
                  style={{ background: wheelBackground }}
                >
                  <span aria-hidden="true">
                    <b>{rangeExpenses.length}</b>
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
                              category.value / rangeTotal,
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
                          {percentage(category.value / rangeTotal, language)}
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
                    onClick={() => {
                      if (data.expenses.length) {
                        setDateRange('all');
                        return;
                      }
                      expenseForm.current
                        ?.querySelector<HTMLInputElement>('[name="label"]')
                        ?.focus();
                    }}
                  >
                    <Plus size={15} />
                    {data.expenses.length
                      ? t('showAllExpenses')
                      : t('addFirstExpense')}
                  </button>
                }
              >
                {data.expenses.length
                  ? t('noExpensesInRange')
                  : t('noExpenses')}
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
            <Field
              name="spentOn"
              label={t('transactionDate')}
              type="date"
              defaultValue={currentDate}
              max={currentDate}
            />
            <PrivacySelect t={t} />
            <button className="primary-button">
              <Plus size={16} />
              {t('addExpense')}
            </button>
          </form>
        </article>
      </div>
      <article className="panel budget-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('monthlyBudgets')}</h2>
            <span>{t('monthlyBudgetsCopy')}</span>
          </div>
        </div>
        <form
          className="budget-form"
          onSubmit={(event) => submitForm(event, post, 'spending-budget')}
        >
          <label className="form-field">
            <span>{t('budgetCategory')}</span>
            <select name="category" defaultValue="all">
              <option value="all">{t('totalBudget')}</option>
              {expenseCategoryOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {t(option.key)}
                </option>
              ))}
            </select>
          </label>
          <Field
            name="monthlyLimit"
            label={t('monthlyLimitRub')}
            type="number"
            min="0.01"
            max={1_000_000}
            step="0.01"
          />
          <button className="primary-button">
            <Check size={15} />
            {t('saveBudget')}
          </button>
        </form>
        {data.spendingBudgets.length ? (
          <div className="budget-grid">
            {data.spendingBudgets.map((budget) => {
              const spent = monthlyBudgetSpend(
                data.expenses,
                budget.category,
                currentDate,
              );
              const limit = Number(budget.monthlyLimit);
              const remaining = limit - spent;
              const label =
                budget.category === 'all'
                  ? t('totalBudget')
                  : expenseCategoryLabel(budget.category, t);
              return (
                <section
                  className={`budget-card${remaining < 0 ? ' over' : ''}`}
                  key={budget.id}
                >
                  <header>
                    <strong>{label}</strong>
                    <ConfirmAction
                      className="task-icon-button danger"
                      label={t('removeBudget', { category: label })}
                      title={t('removeBudgetTitle')}
                      description={t('removeBudgetWarning', {
                        category: label,
                      })}
                      confirmLabel={t('delete')}
                      cancelLabel={t('cancel')}
                      onConfirm={() =>
                        post({
                          type: 'spending-budget-remove',
                          id: budget.id,
                        })
                      }
                    >
                      <Trash2 size={13} />
                    </ConfirmAction>
                  </header>
                  <progress
                    max={limit}
                    value={Math.min(spent, limit)}
                    aria-label={t('budgetProgress', {
                      category: label,
                      spent: money(spent, language),
                      limit: money(limit, language),
                    })}
                  />
                  <div>
                    <span>{t('spentThisMonth')}</span>
                    <b>{money(spent, language)}</b>
                  </div>
                  <small>
                    {remaining >= 0
                      ? t('budgetRemaining', {
                          amount: money(remaining, language),
                        })
                      : t('budgetOver', {
                          amount: money(Math.abs(remaining), language),
                        })}
                  </small>
                </section>
              );
            })}
          </div>
        ) : (
          <Empty>{t('noBudgets')}</Empty>
        )}
      </article>
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
                    <div className="payment-card-actions">
                      <PrivacyBadge visibility={payment.visibility} t={t} />
                      {Boolean(payment.owned) && (
                        <>
                          <button
                            type="button"
                            className="task-icon-button"
                            aria-label={t('editPayment', {
                              payment: payment.label,
                            })}
                            onClick={() =>
                              setEditingPaymentId((current) =>
                                current === payment.id ? null : payment.id,
                              )
                            }
                          >
                            <Edit3 size={13} />
                          </button>
                          <ConfirmAction
                            className="task-icon-button danger"
                            label={t('deletePayment', {
                              payment: payment.label,
                            })}
                            title={t('deletePaymentTitle')}
                            description={t('deletePaymentWarning', {
                              payment: payment.label,
                            })}
                            confirmLabel={t('delete')}
                            cancelLabel={t('cancel')}
                            onConfirm={async () => {
                              const removed = await post({
                                type: 'recurring-payment-remove',
                                id: payment.id,
                              });
                              if (removed) setEditingPaymentId(null);
                            }}
                          >
                            <Trash2 size={13} />
                          </ConfirmAction>
                        </>
                      )}
                    </div>
                  </header>
                  {editingPaymentId === payment.id && (
                    <form
                      className="payment-edit-form"
                      onSubmit={async (event) => {
                        const saved = await submitForm(
                          event,
                          post,
                          'recurring-payment-update',
                          { id: String(payment.id) },
                        );
                        if (saved) setEditingPaymentId(null);
                      }}
                    >
                      <label className="form-field">
                        <span>{t('paymentType')}</span>
                        <select name="kind" defaultValue={payment.kind}>
                          <option value="subscription">
                            {t('subscription')}
                          </option>
                          <option value="loan">{t('loanPayment')}</option>
                          <option value="rent">{t('apartmentRent')}</option>
                        </select>
                      </label>
                      <Field
                        name="label"
                        label={t('paymentName')}
                        defaultValue={payment.label}
                        maxLength={100}
                      />
                      <Field
                        name="amount"
                        label={t('paymentAmount')}
                        type="number"
                        min="0.01"
                        max={1_000_000}
                        step="0.01"
                        defaultValue={String(payment.amount)}
                      />
                      <label className="form-field">
                        <span>{t('billingCycle')}</span>
                        <select
                          name="billingCycle"
                          defaultValue={payment.billingCycle}
                        >
                          <option value="monthly">{t('monthly')}</option>
                          <option value="yearly">{t('yearly')}</option>
                        </select>
                      </label>
                      <Field
                        name="nextDueOn"
                        label={t('nextDueDate')}
                        type="date"
                        defaultValue={payment.nextDueOn}
                      />
                      <Field
                        name="remainingAmount"
                        label={t('loanRemaining')}
                        type="number"
                        min={0}
                        max={1_000_000}
                        defaultValue={
                          payment.remainingAmount === null
                            ? ''
                            : String(payment.remainingAmount)
                        }
                        required={false}
                      />
                      <PrivacySelect t={t} defaultValue={payment.visibility} />
                      <div className="payment-edit-actions">
                        <button className="primary-button">
                          <Check size={14} />
                          {t('save')}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setEditingPaymentId(null)}
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </form>
                  )}
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
      <article className="panel payment-history-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('paymentHistory')}</h2>
            <span>{t('paymentHistoryCopy')}</span>
          </div>
          <History size={18} aria-hidden="true" />
        </div>
        {paymentHistory.length ? (
          <div className="payment-history-list">
            {paymentHistory.map((expense) => (
              <div key={expense.id}>
                <span className="expense-icon">
                  <Check size={15} />
                </span>
                <div>
                  <strong>{expense.label}</strong>
                  <small>{formatDate(expense.spentOn, language)}</small>
                </div>
                <PrivacyBadge visibility={expense.visibility} t={t} />
                <b>{money(Number(expense.amount), language)}</b>
              </div>
            ))}
          </div>
        ) : (
          <Empty>{t('noPaymentHistory')}</Empty>
        )}
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
              <div
                className={`expense-row${editingExpenseId === item.id ? ' editing' : ''}`}
                key={item.id}
              >
                <span className="expense-icon">
                  <WalletCards size={16} />
                </span>
                {editingExpenseId === item.id ? (
                  <form
                    className="expense-edit-form"
                    onSubmit={async (event) => {
                      const saved = await submitForm(
                        event,
                        post,
                        'expense-update',
                        { id: String(item.id) },
                      );
                      if (saved) setEditingExpenseId(null);
                    }}
                  >
                    <Field
                      name="label"
                      label={t('whatWasIt')}
                      defaultValue={item.label}
                      maxLength={100}
                    />
                    <Field
                      name="amount"
                      label={t('amountRub')}
                      type="number"
                      min="0.01"
                      max={1_000_000}
                      step="0.01"
                      defaultValue={String(item.amount)}
                    />
                    <label className="form-field">
                      <span>{t('category')}</span>
                      <select
                        name="category"
                        defaultValue={normalizeExpenseCategory(item.category)}
                      >
                        {expenseCategoryOptions.map((option) => (
                          <option value={option.value} key={option.value}>
                            {t(option.key)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      name="spentOn"
                      label={t('transactionDate')}
                      type="date"
                      defaultValue={item.spentOn}
                      max={currentDate}
                    />
                    <PrivacySelect t={t} defaultValue={item.visibility} />
                    <div className="expense-edit-actions">
                      <button className="primary-button">
                        <Check size={14} />
                        {t('save')}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setEditingExpenseId(null)}
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <strong>{item.label}</strong>
                      <small>
                        {expenseCategoryLabel(item.category, t)} ·{' '}
                        {formatDate(item.spentOn, language)}
                        {item.recurringPaymentId !== null
                          ? ` · ${t('scheduledPayment')}`
                          : ''}
                        {!item.owned ? ` · ${t('sharedHousemate')}` : ''}
                      </small>
                    </div>
                    <PrivacyBadge visibility={item.visibility} t={t} />
                    <b>{money(Number(item.amount), language)}</b>
                    {Boolean(item.owned) && (
                      <div className="expense-item-actions">
                        <button
                          type="button"
                          className="task-icon-button"
                          aria-label={t('editExpense', {
                            expense: item.label,
                          })}
                          onClick={() => setEditingExpenseId(item.id)}
                        >
                          <Edit3 size={13} />
                        </button>
                        <ConfirmAction
                          className="task-icon-button danger"
                          label={t('deleteExpense', {
                            expense: item.label,
                          })}
                          title={t('deleteExpenseTitle')}
                          description={t('deleteExpenseWarning', {
                            expense: item.label,
                          })}
                          confirmLabel={t('delete')}
                          cancelLabel={t('cancel')}
                          onConfirm={async () => {
                            const removed = await post({
                              type: 'expense-remove',
                              id: item.id,
                            });
                            if (removed) setEditingExpenseId(null);
                          }}
                        >
                          <Trash2 size={13} />
                        </ConfirmAction>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          ) : (
            <Empty
              action={
                data.expenses.length &&
                (categoryFilter !== 'all' || dateRange !== 'all') ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setCategoryFilter('all');
                      setDateRange('all');
                    }}
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
              {data.expenses.length ? t('noExpensesInRange') : t('noExpenses')}
            </Empty>
          )}
        </div>
      </article>
    </>
  );
}
