import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ApiDiagnostic } from '../api';
import { useVehicles } from '../vehicle-context';
import { useI18n } from '../i18n';
import { useAction, useAsync, formatDateTime } from '../hooks';
import { Card, CertaintyBadge, EmptyState, ErrorBox, Notice, SafetyBadge, SimulationBanner, Spinner } from '../components';

interface Comparison {
  verdict: string;
  certainty: string;
  safety?: string;
  summaryFr: string;
  summaryEn: string;
  clearedCodes?: string[];
  persistingCodes?: string[];
  newCodes?: string[];
  readingsBefore?: Array<{ label: string; before: number | null; after: number | null; unit: string; delta: number | null }>;
  nextStepsFr?: string[];
  [key: string]: unknown;
}

/**
 * Post-réparation (§19).
 *
 * XAMOTO ne déclare jamais une réparation « définitive » : un défaut peut
 * revenir après plusieurs cycles de conduite. La comparaison montre les codes
 * disparus, ceux qui persistent et ceux qui apparaissent.
 */
export default function PostRepairScreen(): JSX.Element {
  const { vehicle, vehicles } = useVehicles();
  const { t, locale } = useI18n();
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  const [repairDescription, setRepairDescription] = useState('Réparation déclarée');
  const [kmSinceRepair, setKmSinceRepair] = useState('');

  const diagnostics = useAsync(
    () => api.get<{ diagnostics: ApiDiagnostic[] }>(`/api/diagnostics?vehicleId=${vehicle?.id}&limit=20`),
    [vehicle?.id],
    { enabled: Boolean(vehicle) },
  );
  const comparison = useAction(async () =>
    api.post<{ comparison: Comparison; notice: string }>(`/api/diagnostics/${beforeId}/compare`, {
      afterDiagnosticSessionId: afterId,
      repairDescription,
      kmSinceRepair: kmSinceRepair === '' ? null : Number(kmSinceRepair),
    }),
  );

  if (vehicles.length === 0) {
    return <EmptyState title={t('Aucun véhicule', 'No vehicle')} message={t('Ajoutez un véhicule puis lancez deux scans.', 'Add a vehicle then run two scans.')} action={<Link className="button primary" to="/vehicles">{t('Ajouter un véhicule', 'Add a vehicle')}</Link>} />;
  }

  const list = diagnostics.data?.diagnostics ?? [];
  const result = comparison.data?.comparison;

  return (
    <div>
      {list.some((item) => item.dataOrigin === 'simulated') && <SimulationBanner />}

      <Card
        title={t('Vérifier une réparation', 'Verify a repair')}
        subtitle={t(
          'Choisissez le diagnostic AVANT réparation et celui APRÈS. XAMOTO compare les mesures réelles, sans supposer que la réparation a fonctionné.',
          'Pick the diagnosis BEFORE the repair and the one AFTER. XAMOTO compares real measurements, without assuming the repair worked.',
        )}
      >
        {diagnostics.loading && <Spinner />}
        {!diagnostics.loading && list.length < 2 && (
          <Notice tone="warn">
            {t(
              'Il faut deux diagnostics sur ce véhicule (avant et après réparation) pour lancer une comparaison. Relancez un scan après avoir roulé.',
              'Two diagnoses on this vehicle are required (before and after repair) to run a comparison. Run a scan again after driving.',
            )}
          </Notice>
        )}

        <div className="field-row">
          <div>
            <label htmlFor="before">{t('Diagnostic avant réparation', 'Diagnosis before repair')}</label>
            <select id="before" value={beforeId} onChange={(event) => setBeforeId(event.target.value)}>
              <option value="">{t('Choisir…', 'Choose…')}</option>
              {list.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDateTime(item.startedAt, locale)} — {item.certainty} / {item.safety}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="after">{t('Diagnostic après réparation', 'Diagnosis after repair')}</label>
            <select id="after" value={afterId} onChange={(event) => setAfterId(event.target.value)}>
              <option value="">{t('Choisir…', 'Choose…')}</option>
              {list.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDateTime(item.startedAt, locale)} — {item.certainty} / {item.safety}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="desc">{t('Réparation déclarée', 'Declared repair')}</label>
            <input id="desc" value={repairDescription} onChange={(event) => setRepairDescription(event.target.value)} />
          </div>
          <div>
            <label htmlFor="km">{t('Kilomètres depuis la réparation', 'Kilometres since repair')}</label>
            <input id="km" type="number" value={kmSinceRepair} onChange={(event) => setKmSinceRepair(event.target.value)} />
          </div>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="button primary" disabled={!beforeId || !afterId || comparison.loading} onClick={() => void comparison.run()}>
            {t('Comparer', 'Compare')}
          </button>
          <span className="hint">{t('La réparation déclarée est enregistrée telle que vous la décrivez : XAMOTO ne la valide pas.', 'The declared repair is recorded as you describe it: XAMOTO does not validate it.')}</span>
        </div>
        <ErrorBox message={comparison.error} />
      </Card>

      {result && (
        <Card title={t('Résultat de la comparaison', 'Comparison result')}>
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="badge outline">{result.verdict}</span>
            <CertaintyBadge level={result.certainty} showHelp />
            {result.safety && <SafetyBadge level={result.safety} />}
          </div>
          <p>{locale === 'en' ? result.summaryEn : result.summaryFr}</p>

          <div className="grid cols-3">
            <div className="stat">
              <div className="value mono">{(result.persistingCodes ?? []).length}</div>
              <div className="label">{t('Codes qui persistent', 'Persisting codes')}</div>
              <div className="small">{(result.persistingCodes ?? []).join(', ') || '—'}</div>
            </div>
            <div className="stat">
              <div className="value mono">{(result.newCodes ?? []).length}</div>
              <div className="label">{t('Nouveaux codes', 'New codes')}</div>
              <div className="small">{(result.newCodes ?? []).join(', ') || '—'}</div>
            </div>
            <div className="stat">
              <div className="value mono">{(result.clearedCodes ?? []).length}</div>
              <div className="label">{t('Codes disparus', 'Cleared codes')}</div>
              <div className="small">{(result.clearedCodes ?? []).join(', ') || '—'}</div>
            </div>
          </div>

          {(result.readingsBefore ?? []).length > 0 && (
            <>
              <h3>{t('Mesures avant / après', 'Measurements before / after')}</h3>
              <table>
                <thead>
                  <tr>
                    <th>{t('Mesure', 'Measurement')}</th>
                    <th>{t('Avant', 'Before')}</th>
                    <th>{t('Après', 'After')}</th>
                    <th>{t('Écart', 'Delta')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.readingsBefore ?? []).map((line) => (
                    <tr key={line.label}>
                      <td>{line.label}</td>
                      <td className="mono">{line.before ?? '—'} {line.unit}</td>
                      <td className="mono">{line.after ?? '—'} {line.unit}</td>
                      <td className="mono">{line.delta ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {(result.nextStepsFr ?? []).length > 0 && (
            <>
              <h3>{t('À faire ensuite', 'What to do next')}</h3>
              <ul className="clean small">
                {(result.nextStepsFr ?? []).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </>
          )}

          <Notice tone="warn">{comparison.data?.notice}</Notice>
        </Card>
      )}
    </div>
  );
}
