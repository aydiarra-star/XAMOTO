import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type ApiTest, type TestOutcome } from '../api';
import { useI18n, SAFETY_LABELS, OUTCOME_LABELS, labelOf, pickLabel } from '../i18n';
import { useAction, useAsync, formatDateTime } from '../hooks';
import { Card, CertaintyBadge, ErrorBox, Notice, SafetyBadge, SimulationBanner, Spinner } from '../components';

/**
 * Tests guidés (§17).
 *
 * Un test n'est validé QUE si l'utilisateur confirme ce qu'il a observé :
 * XAMOTO n'attribue jamais un résultat à sa place (§16). Le diagnostic est
 * recalculé après chaque résultat, et les autres hypothèses restent affichées.
 */
export default function GuidedTestsScreen(): JSX.Element {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const [openTest, setOpenTest] = useState<string | null>(null);
  const [form, setForm] = useState<{ outcome: TestOutcome; measuredValue: string; unit: string; note: string; origin: 'measured' | 'estimated' | 'documented' }>({
    outcome: 'ok',
    measuredValue: '',
    unit: '',
    note: '',
    origin: 'measured',
  });

  const state = useAsync(() => api.get<{ tests: ApiTest[] }>(`/api/diagnostics/${id}/tests`), [id]);
  const detail = useAsync(() => api.get<{ dataOrigin: string; simulationNotice: string | null }>(`/api/diagnostics/${id}`), [id]);

  const record = useAction(async (testKey: string) =>
    api.post<{ ok: boolean; recalculated: { certainty: string; safety: string; conclusionFr: string } }>(`/api/diagnostics/${id}/tests/${testKey}/result`, {
      outcome: form.outcome,
      measuredValue: form.measuredValue === '' ? null : Number(form.measuredValue),
      unit: form.unit === '' ? null : form.unit,
      note: form.note === '' ? null : form.note,
      origin: form.origin,
      // §16 : confirmation explicite, obligatoire.
      confirmed: true,
    }),
  );

  if (state.loading) return <Card><Spinner label={t('Chargement des tests…', 'Loading tests…')} /></Card>;

  const tests = state.data?.tests ?? [];
  const pending = tests.filter((test) => test.status === 'proposed');
  const done = tests.filter((test) => test.status !== 'proposed');

  return (
    <div>
      {detail.data?.simulationNotice && <SimulationBanner notice={detail.data.simulationNotice} />}

      <Card
        title={t('Tests guidés', 'Guided tests')}
        subtitle={t(
          'Chaque test indique ce qu’il permet de vérifier, le matériel nécessaire et le temps estimé. Un test non réalisable est un résultat en soi.',
          'Each test states what it verifies, the equipment needed and estimated time. A test that cannot be done is a result in itself.',
        )}
        actions={<Link className="button small ghost" to={`/diagnostics/${id}`}>{t('Voir le diagnostic', 'View diagnosis')}</Link>}
      >
        <div className="grid cols-3">
          <div className="stat">
            <div className="value mono">{pending.length}</div>
            <div className="label">{t('À réaliser', 'To do')}</div>
          </div>
          <div className="stat">
            <div className="value mono">{done.length}</div>
            <div className="label">{t('Réalisés', 'Completed')}</div>
          </div>
          <div className="stat">
            <div className="value mono">{tests.length}</div>
            <div className="label">{t('Total proposé', 'Total proposed')}</div>
          </div>
        </div>
      </Card>

      {tests.length === 0 && (
        <Notice tone="warn">
          {t(
            'Aucun test n’est proposé pour ce diagnostic : les données disponibles ne permettent pas de cibler une vérification utile.',
            'No test is proposed for this diagnosis: the available data does not allow targeting a useful check.',
          )}
        </Notice>
      )}

      <ErrorBox message={record.error} />
      {record.data && (
        <Notice tone="ok">
          {t('Test enregistré. Diagnostic recalculé.', 'Test saved. Diagnosis recomputed.')} <CertaintyBadge level={record.data.recalculated.certainty} /> <SafetyBadge level={record.data.recalculated.safety} />
          <div className="small">{record.data.recalculated.conclusionFr}</div>
        </Notice>
      )}

      {tests.map((test) => {
        const isOpen = openTest === test.testKey;
        const safety = labelOf(SAFETY_LABELS, test.safety, { fr: 'NORMAL', en: 'NORMAL', wo: '', icon: '🟢', color: '#22c55e' });
        return (
          <Card key={test.id}>
            <div className="row between">
              <div>
                <h2 style={{ marginBottom: 2 }}>
                  {locale === 'en' ? test.titleEn : test.titleFr}{' '}
                  <span className="badge outline" style={{ marginLeft: 6 }}>{test.status === 'proposed' ? t('à réaliser', 'to do') : t('réalisé', 'done')}</span>
                </h2>
                <div className="small muted">
                  {locale === 'en' ? test.objectiveEn : test.objectiveFr}
                </div>
              </div>
              <span className="row">
                <span className="badge outline" title={safety.fr}>
                  {safety.icon} {t('sécurité', 'safety')} {locale === 'en' ? safety.en : safety.fr}
                </span>
                {test.durationMin ? <span className="badge outline">{test.durationMin} min</span> : null}
                <span className="badge outline">{t('priorité', 'priority')} {test.priority}</span>
              </span>
            </div>

            <p className="small">{locale === 'en' ? test.reasonEn : test.reasonFr}</p>
            {test.equipment.length > 0 && (
              <p className="small muted">
                {t('Matériel', 'Equipment')} : {test.equipment.map((item) => item.replace(/_/g, ' ')).join(', ')}
              </p>
            )}

            {test.result && (
              <Notice tone={test.result.outcome === 'ok' ? 'ok' : 'warn'}>
                <strong>{pickLabel(OUTCOME_LABELS, test.result.outcome, locale, { fr: test.result.outcome, en: test.result.outcome, wo: '' })}</strong>
                {test.result.measuredValue !== null ? ` — ${test.result.measuredValue} ${test.result.unit ?? ''}` : ''}
                {test.result.note ? <div className="small">{test.result.note}</div> : null}
                <small>
                  {t('Enregistré le', 'Recorded on')} {formatDateTime(test.result.recordedAt, locale)} · {t('origine', 'origin')} {test.result.origin}
                </small>
              </Notice>
            )}

            <div className="row" style={{ marginTop: 10 }}>
              <button className="button small" onClick={() => setOpenTest(isOpen ? null : test.testKey)}>
                {isOpen ? t('Annuler', 'Cancel') : test.result ? t('Corriger le résultat', 'Correct the result') : t('Saisir le résultat', 'Enter the result')}
              </button>
            </div>

            {isOpen && (
              <div className="card" style={{ background: 'var(--bg-soft)', marginTop: 12 }}>
                <Notice tone="warn">
                  {t(
                    'Ne saisissez que ce que vous avez réellement observé ou mesuré. XAMOTO n’invente aucune valeur, et une valeur inventée fausserait tout le diagnostic.',
                    'Only enter what you actually observed or measured. XAMOTO invents no value, and an invented value would distort the whole diagnosis.',
                  )}
                </Notice>

                <div className="field-row" style={{ marginTop: 10 }}>
                  <div>
                    <label htmlFor={`outcome-${test.testKey}`}>{t('Résultat observé', 'Observed result')}</label>
                    <select id={`outcome-${test.testKey}`} value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value as TestOutcome })}>
                      {Object.keys(OUTCOME_LABELS).map((key) => (
                        <option key={key} value={key}>
                          {pickLabel(OUTCOME_LABELS, key, locale, { fr: key, en: key, wo: '' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`value-${test.testKey}`}>{t('Valeur mesurée (optionnel)', 'Measured value (optional)')}</label>
                    <input
                      id={`value-${test.testKey}`}
                      type="number"
                      step="0.01"
                      value={form.measuredValue}
                      onChange={(event) => setForm({ ...form, measuredValue: event.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`unit-${test.testKey}`}>{t('Unité', 'Unit')}</label>
                    <input id={`unit-${test.testKey}`} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="V, bar, Ω…" />
                  </div>
                  <div>
                    <label htmlFor={`origin-${test.testKey}`}>{t('Origine de la donnée', 'Data origin')}</label>
                    <select id={`origin-${test.testKey}`} value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value as typeof form.origin })}>
                      <option value="measured">{t('Mesuré par moi', 'Measured by me')}</option>
                      <option value="documented">{t('Documenté (carnet, facture)', 'Documented (logbook, invoice)')}</option>
                      <option value="estimated">{t('Estimé', 'Estimated')}</option>
                    </select>
                  </div>
                </div>

                <label htmlFor={`note-${test.testKey}`}>{t('Note (optionnel)', 'Note (optional)')}</label>
                <textarea id={`note-${test.testKey}`} rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />

                <div className="row" style={{ marginTop: 10 }}>
                  <button
                    className="button primary"
                    disabled={record.loading}
                    onClick={() => void record.run(test.testKey).then(() => state.reload())}
                  >
                    {t('Confirmer et enregistrer', 'Confirm and save')}
                  </button>
                  <span className="hint">{t('Le diagnostic sera recalculé immédiatement.', 'The diagnosis will be recomputed immediately.')}</span>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
