'use client';

import { useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Edit3,
  History,
  Info,
  Package,
  Pause,
  Pill,
  Play,
  Plus,
  Trash2,
  Undo2,
} from 'lucide-react';
import { dateKey } from '../../client/dates';
import { formatDate, formatDateTime } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import {
  ConfirmAction,
  Empty,
  PageTitle,
  PrivacyBadge,
  PrivacySelect,
} from '../../components/app-ui';
import type { Language } from '../../i18n';
import { medicationAdherence } from '../health/health-calculations';
import type { Data, Medication, Post, T } from '../types';

function MedicationFields({
  medication,
  today,
  t,
}: {
  medication?: Medication;
  today: string;
  t: T;
}) {
  return (
    <>
      <Field
        name="name"
        label={t('medicationName')}
        placeholder={t('medicationNamePlaceholder')}
        defaultValue={medication?.name}
      />
      <Field
        name="dosage"
        label={t('dosage')}
        placeholder={t('dosagePlaceholder')}
        defaultValue={medication?.dosage}
      />
      <Field
        name="scheduleTimes"
        label={t('dailyTimes')}
        placeholder="08:00, 20:00"
        defaultValue={medication?.scheduleTimes.join(', ')}
      />
      <Field
        name="startOn"
        label={t('startDate')}
        type="date"
        defaultValue={medication?.startOn ?? today}
      />
      <Field
        name="endOn"
        label={t('endDateOptional')}
        type="date"
        min={medication ? undefined : today}
        defaultValue={medication?.endOn ?? undefined}
      />
      <Field
        name="supplyRemaining"
        label={t('dosesRemainingOptional')}
        type="number"
        min={0}
        max={100_000}
        step={1}
        defaultValue={
          medication?.supplyRemaining === null ||
          medication?.supplyRemaining === undefined
            ? undefined
            : String(medication.supplyRemaining)
        }
      />
      <Field
        name="refillThreshold"
        label={t('refillThresholdOptional')}
        type="number"
        min={0}
        max={100_000}
        step={1}
        defaultValue={
          medication?.refillThreshold === null ||
          medication?.refillThreshold === undefined
            ? undefined
            : String(medication.refillThreshold)
        }
      />
      <PrivacySelect t={t} defaultValue={medication?.visibility} />
      <label className="form-field medication-instructions">
        <span>{t('instructionsOptional')}</span>
        <textarea
          name="instructions"
          maxLength={500}
          placeholder={t('medicationInstructionsPlaceholder')}
          defaultValue={medication?.instructions}
        />
      </label>
    </>
  );
}

export function MedicationsView({
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
  const todayKey = dateKey(new Date());
  const [editingId, setEditingId] = useState<number | null>(null);
  const activeToday = data.medications.filter(
    (medication) =>
      medication.active &&
      medication.startOn <= todayKey &&
      (!medication.endOn || medication.endOn >= todayKey),
  );
  const scheduledToday = activeToday.reduce(
    (count, medication) => count + medication.scheduleTimes.length,
    0,
  );
  const takenToday = data.medicationDoses.filter((dose) =>
    dose.scheduledFor.startsWith(todayKey),
  ).length;
  const ownedMedications = data.medications.filter(
    (medication) => medication.owned,
  );
  const ownedMedicationIds = new Set(
    ownedMedications.map((medication) => medication.id),
  );
  const ownedDoses = data.medicationDoses.filter((dose) =>
    ownedMedicationIds.has(dose.medicationId),
  );
  const adherence = medicationAdherence(ownedMedications, ownedDoses, 14);
  return (
    <>
      <PageTitle
        eyebrow={t('medicationEyebrow')}
        title={t('medications')}
        copy={t('medicationCopy')}
      />
      <div className="medication-summary-grid">
        <article className="panel medication-summary">
          <span className="tinted-icon violet">
            <Pill size={19} />
          </span>
          <div>
            <strong>{activeToday.length}</strong>
            <span>{t('activeMedications')}</span>
          </div>
        </article>
        <article className="panel medication-summary">
          <span className="tinted-icon green">
            <CheckCircle2 size={19} />
          </span>
          <div>
            <strong>
              {takenToday} / {scheduledToday}
            </strong>
            <span>{t('dosesToday')}</span>
          </div>
        </article>
      </div>
      <article className="panel medication-entry-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('addMedication')}</h2>
            <span>{t('medicationFormHint')}</span>
          </div>
          <Pill size={19} />
        </div>
        <form
          className="medication-form"
          onSubmit={(event) => submitForm(event, post, 'medication')}
        >
          <MedicationFields today={todayKey} t={t} />
          <button className="primary-button">
            <Plus size={16} />
            {t('addMedication')}
          </button>
        </form>
      </article>
      <div className="medication-card-grid">
        {data.medications.length ? (
          data.medications.map((medication) => {
            if (editingId === medication.id)
              return (
                <article
                  className="panel medication-card medication-edit-card"
                  key={medication.id}
                >
                  <form
                    className="medication-form medication-edit-form"
                    onSubmit={async (event) => {
                      const saved = await submitForm(
                        event,
                        post,
                        'medication-update',
                        { id: String(medication.id) },
                      );
                      if (saved) setEditingId(null);
                    }}
                  >
                    <MedicationFields
                      medication={medication}
                      today={todayKey}
                      t={t}
                    />
                    <div className="medication-edit-actions">
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
                </article>
              );
            const todayDoses = medication.scheduleTimes.map((time) => {
              const scheduledFor = `${todayKey}T${time}`;
              return {
                time,
                scheduledFor,
                dose: data.medicationDoses.find(
                  (candidate) =>
                    candidate.medicationId === medication.id &&
                    candidate.scheduledFor === scheduledFor,
                ),
              };
            });
            const inDateRange =
              medication.startOn <= todayKey &&
              (!medication.endOn || medication.endOn >= todayKey);
            const lowSupply =
              medication.supplyRemaining !== null &&
              medication.refillThreshold !== null &&
              medication.supplyRemaining <= medication.refillThreshold;
            return (
              <article
                className={`panel medication-card${medication.active ? '' : ' paused'}`}
                key={medication.id}
              >
                <header>
                  <span className="medication-icon">
                    <Pill size={18} />
                  </span>
                  <div>
                    <strong>{medication.name}</strong>
                    <span>{medication.dosage}</span>
                  </div>
                  <PrivacyBadge visibility={medication.visibility} t={t} />
                </header>
                {medication.instructions && <p>{medication.instructions}</p>}
                <div className="medication-dates">
                  <CalendarDays size={14} />
                  {formatDate(medication.startOn, language)}
                  {medication.endOn
                    ? ` – ${formatDate(medication.endOn, language)}`
                    : ''}
                </div>
                {medication.supplyRemaining !== null && (
                  <div
                    className={`medication-supply${lowSupply ? ' low' : ''}`}
                  >
                    <Package size={14} />
                    <span>
                      {t('dosesRemaining', {
                        count: medication.supplyRemaining,
                      })}
                    </span>
                    {lowSupply && <b>{t('refillDue')}</b>}
                  </div>
                )}
                {!medication.owned && (
                  <small>
                    {t('sharedByName', { name: medication.ownerName })}
                  </small>
                )}
                <div className="dose-list">
                  {todayDoses.map(({ time, scheduledFor, dose }) => (
                    <div className={dose ? 'taken' : ''} key={scheduledFor}>
                      <span>
                        <Clock3 size={14} /> {time}
                      </span>
                      {dose ? (
                        medication.owned ? (
                          <button
                            type="button"
                            aria-label={t('undoDoseAt', { time })}
                            onClick={() =>
                              void post({
                                type: 'medication-dose-remove',
                                id: dose.id,
                              })
                            }
                          >
                            <Undo2 size={13} /> {t('undoTaken')}
                          </button>
                        ) : (
                          <b>
                            <Check size={13} /> {t('taken')}
                          </b>
                        )
                      ) : medication.owned &&
                        medication.active &&
                        inDateRange ? (
                        <button
                          type="button"
                          onClick={() =>
                            void post({
                              type: 'medication-dose',
                              id: medication.id,
                              scheduledFor,
                            })
                          }
                        >
                          {t('markTaken')}
                        </button>
                      ) : (
                        <b>{t('scheduled')}</b>
                      )}
                    </div>
                  ))}
                </div>
                {medication.owned && (
                  <footer className="medication-card-actions">
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() => setEditingId(medication.id)}
                    >
                      <Edit3 size={14} /> {t('editMedication')}
                    </button>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() =>
                        void post({
                          type: 'medication-toggle',
                          id: medication.id,
                          active: !medication.active,
                        })
                      }
                    >
                      {medication.active ? (
                        <Pause size={14} />
                      ) : (
                        <Play size={14} />
                      )}
                      {medication.active ? t('pause') : t('resume')}
                    </button>
                    <ConfirmAction
                      label={t('deleteMedication', {
                        medication: medication.name,
                      })}
                      title={t('deleteMedicationTitle')}
                      description={t('deleteMedicationWarning', {
                        medication: medication.name,
                      })}
                      confirmLabel={t('delete')}
                      cancelLabel={t('cancel')}
                      className="danger-icon-button"
                      onConfirm={() =>
                        post({ type: 'medication-remove', id: medication.id })
                      }
                    >
                      <Trash2 size={14} />
                    </ConfirmAction>
                  </footer>
                )}
              </article>
            );
          })
        ) : (
          <article className="panel">
            <Empty>{t('noMedications')}</Empty>
          </article>
        )}
      </div>
      <article className="panel medication-history-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('adherenceHistory')}</h2>
            <span>{t('privateMedicationHistory')}</span>
          </div>
          <History size={19} />
        </div>
        <div className="adherence-summary">
          <div>
            <strong>{adherence.percent}%</strong>
            <span>{t('last14Days')}</span>
          </div>
          <progress
            value={adherence.taken}
            max={Math.max(1, adherence.expected)}
            aria-label={t('adherenceProgress', {
              taken: adherence.taken,
              scheduled: adherence.expected,
            })}
          />
          <b>
            {t('dosesRecorded', {
              taken: adherence.taken,
              scheduled: adherence.expected,
            })}
          </b>
        </div>
        <div className="medication-history-list">
          {ownedDoses.length ? (
            ownedDoses.slice(0, 16).map((dose) => {
              const medication = ownedMedications.find(
                (candidate) => candidate.id === dose.medicationId,
              );
              return (
                <div key={dose.id}>
                  <span className="tinted-icon violet">
                    <Pill size={14} />
                  </span>
                  <div>
                    <strong>{medication?.name ?? t('medications')}</strong>
                    <small>{formatDateTime(dose.takenAt, language)}</small>
                  </div>
                  <button
                    type="button"
                    aria-label={t('undoDose')}
                    onClick={() =>
                      void post({
                        type: 'medication-dose-remove',
                        id: dose.id,
                      })
                    }
                  >
                    <Undo2 size={13} /> {t('undo')}
                  </button>
                </div>
              );
            })
          ) : (
            <Empty>{t('noDoseHistory')}</Empty>
          )}
        </div>
      </article>
      <p className="medical-disclaimer">
        <Info size={14} /> {t('medicationDisclaimer')}
      </p>
    </>
  );
}
