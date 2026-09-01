'use client';

import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  Pause,
  Pill,
  Play,
  Plus,
} from 'lucide-react';
import { dateKey } from '../../client/dates';
import { formatMoneyDate } from '../../client/format';
import { submitForm } from '../../client/forms';
import { Field } from '../../components/app-field';
import {
  Empty,
  PageTitle,
  PrivacyBadge,
  PrivacySelect,
} from '../../components/app-ui';
import type { Language } from '../../i18n';
import type { Data, Post, T } from '../types';

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
          <Field
            name="name"
            label={t('medicationName')}
            placeholder={t('medicationNamePlaceholder')}
          />
          <Field
            name="dosage"
            label={t('dosage')}
            placeholder={t('dosagePlaceholder')}
          />
          <Field
            name="scheduleTimes"
            label={t('dailyTimes')}
            placeholder="08:00, 20:00"
          />
          <Field
            name="startOn"
            label={t('startDate')}
            type="date"
            defaultValue={todayKey}
          />
          <label className="form-field">
            <span>{t('endDateOptional')}</span>
            <input name="endOn" type="date" min={todayKey} />
          </label>
          <PrivacySelect t={t} />
          <label className="form-field medication-instructions">
            <span>{t('instructionsOptional')}</span>
            <textarea
              name="instructions"
              maxLength={500}
              placeholder={t('medicationInstructionsPlaceholder')}
            />
          </label>
          <button className="primary-button">
            <Plus size={16} />
            {t('addMedication')}
          </button>
        </form>
      </article>
      <div className="medication-card-grid">
        {data.medications.length ? (
          data.medications.map((medication) => {
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
                  {formatMoneyDate(medication.startOn, language)}
                  {medication.endOn
                    ? ` – ${formatMoneyDate(medication.endOn, language)}`
                    : ''}
                </div>
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
                        <b>
                          <Check size={13} /> {t('taken')}
                        </b>
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
                  <footer>
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
      <p className="medical-disclaimer">
        <Info size={14} /> {t('medicationDisclaimer')}
      </p>
    </>
  );
}
