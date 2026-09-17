import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type ApiDiagnostic, type ApiInspection } from '../api';
import { useVehicles } from '../vehicle-context';
import { useI18n } from '../i18n';
import { useAction, useAsync, formatDate } from '../hooks';
import { Card, EmptyState, ErrorBox, Notice, ScoreBar, Spinner } from '../components';

/**
 * Inspection avant achat (§24).
 *
 * Un rapport d'inspection exige un scan : sans données mesurées, XAMOTO
 * refuse de noter un véhicule. Les affirmations du vendeur sont enregistrées
 * séparément, et jamais prises pour des faits.
 */
export default function InspectionScreen(): JSX.Element {
  const { vehicle, vehicles } = useVehicles();
  const { t, locale } = useI18n();
  const [diagnosticId, setDiagnosticId] = useState('');
  const [displayedOdometerKm, setDisplayedOdometerKm] = useState('');
  const [sellerClaims, setSellerClaims] = useState('');
  const [notTestable, setNotTestable] = useState<string[]>([]);

  const diagnostics = useAsync(
    () => api.get<{ diagnostics: ApiDiagnostic[] }>(`/api/diagnostics?vehicleId=${vehicle?.id}&limit=20`),
    [vehicle?.id],
    { enabled: Boolean(vehicle) },
  );
  const history = useAsync(() => api.get<{ inspections: ApiInspection[] }>(`/api/vehicles/${vehicle?.id}/inspections`), [vehicle?.id], { enabled: Boolean(vehicle) });

  const run = useAction(async () =>
    api.post<{ id: string; inspection: ApiInspection; notice: string }>(`/api/vehicles/${vehicle?.id}/inspection`, {
      diagnosticSessionId: diagnosticId || null,
      displayedOdometerKm: displayedOdometerKm === '' ? null : Number(displayedOdometerKm),
      sellerClaims: sellerClaims
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      notTestable,
    }),
  );

  if (vehicles.length === 0) {
    return <EmptyState title={t('Aucun véhicule', 'No vehicle')} message={t('Ajoutez le véhicule à inspecter, puis lancez un scan.', 'Add the vehicle to inspect, then run a scan.')} action={<Link className="button primary" to="/vehicles">{t('Ajouter un véhicule', 'Add a vehicle')}</Link>} />;
  }

  const list = diagnostics.data?.diagnostics ?? [];
  const inspection = run.data?.inspection;

  const checklistKeys = [
    ['engine_oil', t('Huile et filtres', 'Oil and filters')],
    ['coolant', t('Refroidissement', 'Cooling')],
    ['battery', t('Batterie et charge', 'Battery and charging')],
    ['emissions', t('Émissions et dépollution', 'Emissions control')],
    ['ignition', t('Allumage', 'Ignition')],
    ['transmission', t('Transmission', 'Transmission')],
    ['brakes', t('Freinage (visuel)', 'Braking (visual)')],
    ['odometer', t('Cohérence du kilométrage', 'Odometer consistency')],
  ];

  return (
    <div>
      <Card
        title={t('Inspection avant achat', 'Pre-purchase inspection')}
        subtitle={t(
          'XAMOTO note uniquement ce qu’il observe dans les données lues. Une case non testée reste « non vérifiée » : elle n’est jamais présentée comme bonne.',
          'XAMOTO scores only what it observes in the read data. An untested item stays “not checked”: it is never presented as good.',
        )}
      >
        {!diagnostics.loading && list.length === 0 && (
          <Notice tone="warn">
            {t(
              'Aucun scan pour ce véhicule : XAMOTO refusera de produire une inspection. Lancez d’abord un scan (le simulateur est disponible si vous n’avez pas d’adaptateur).',
              'No scan for this vehicle: XAMOTO will refuse to produce an inspection. Run a scan first (the simulator is available if you have no adapter).',
            )}
          </Notice>
        )}

        <div className="field-row">
          <div>
            <label htmlFor="diag">{t('Scan de référence', 'Reference scan')}</label>
            <select id="diag" value={diagnosticId} onChange={(event) => setDiagnosticId(event.target.value)}>
              <option value="">{t('Le plus récent', 'Most recent')}</option>
              {list.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDate(item.startedAt, locale)} — {item.certainty}/{item.safety}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="odo">{t('Kilométrage affiché au compteur', 'Odometer displayed')}</label>
            <input id="odo" type="number" value={displayedOdometerKm} onChange={(event) => setDisplayedOdometerKm(event.target.value)} placeholder={vehicle ? String(vehicle.odometerKm) : ''} />
          </div>
        </div>

        <label htmlFor="claims">{t('Ce que le vendeur affirme (une ligne par affirmation)', 'What the seller claims (one claim per line)')}</label>
        <textarea id="claims" rows={3} value={sellerClaims} onChange={(event) => setSellerClaims(event.target.value)} placeholder={t('Ex : « entretien à jour », « jamais accidentée »', 'e.g. “full service history”, “never crashed”')} />
        <p className="hint">
          {t(
            'Ces affirmations sont enregistrées comme DÉCLARATIONS : XAMOTO ne les valide pas et ne les utilise pas comme mesure.',
            'These claims are stored as STATEMENTS: XAMOTO neither validates nor uses them as measurements.',
          )}
        </p>

        <h3>{t('Éléments que vous n’avez pas pu vérifier', 'Items you could not check')}</h3>
        <div className="grid cols-3">
          {checklistKeys.map(([key, label]) => (
            <label key={key} className="row small" style={{ margin: 0 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={notTestable.includes(key)}
                onChange={(event) => setNotTestable(event.target.checked ? [...notTestable, key] : notTestable.filter((item) => item !== key))}
              />
              {label}
            </label>
          ))}
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="button primary" disabled={run.loading} onClick={() => void run.run().then(() => history.reload())}>
            {t('Établir le rapport d’inspection', 'Produce the inspection report')}
          </button>
        </div>
        <ErrorBox message={run.error} />
      </Card>

      {inspection && (
        <Card title={t('Rapport d’inspection', 'Inspection report')} subtitle={`${inspection.targetVehicle.brand} ${inspection.targetVehicle.model} (${inspection.targetVehicle.year})`}>
          <div className="grid cols-2">
            <div>
              <ScoreBar label={t('Note globale (fondée sur les mesures)', 'Overall score (based on measurements)')} value={inspection.scores.overall} />
              <ScoreBar label={t('Moteur', 'Engine')} value={inspection.scores.engine} />
              <ScoreBar label={t('Émissions', 'Emissions')} value={inspection.scores.emissions} />
              <ScoreBar label={t('Électrique', 'Electrical')} value={inspection.scores.electrical} />
              <ScoreBar label={t('Cohérence des données', 'Data consistency')} value={inspection.scores.dataCoherence} />
              <p className="hint">
                {t(
                  'Cette note reflète uniquement les données lisibles en OBD. Elle ne dit rien de la carrosserie, des trains roulants ni de l’historique d’entretien.',
                  'This score reflects only OBD-readable data. It says nothing about bodywork, running gear or service history.',
                )}
              </p>
            </div>
            <div>
              <h3>{t('Points de vigilance', 'Watch points')}</h3>
              {inspection.redFlags.length === 0 ? <p className="hint">{t('Aucun point rouge détecté dans les données disponibles.', 'No red flag detected in the available data.')}</p> : (
                <ul className="clean">
                  {inspection.redFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              )}
              {inspection.notes.length > 0 && (
                <>
                  <h3>{t('Remarques', 'Notes')}</h3>
                  <ul className="clean small">
                    {inspection.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <h3>{t('Liste de contrôle', 'Checklist')}</h3>
          <table>
            <thead>
              <tr>
                <th>{t('Élément', 'Item')}</th>
                <th>{t('Verdict', 'Verdict')}</th>
                <th>{t('Détail', 'Detail')}</th>
              </tr>
            </thead>
            <tbody>
              {inspection.checklist.map((line) => (
                <tr key={line.key}>
                  <td>{locale === 'en' ? line.labelEn : line.labelFr}</td>
                  <td>
                    <span className="badge outline">
                      {line.verdict === 'ok'
                        ? t('conforme', 'ok')
                        : line.verdict === 'watch'
                          ? t('à surveiller', 'watch')
                          : line.verdict === 'problem'
                            ? t('problème', 'problem')
                            : t('non vérifié', 'not checked')}
                    </span>
                  </td>
                  <td className="small">{line.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Notice>{run.data?.notice}</Notice>
        </Card>
      )}

      <Card title={t('Inspections précédentes', 'Previous inspections')}>
        {history.loading && <Spinner />}
        {(history.data?.inspections ?? []).length === 0 && <p className="hint">{t('Aucune inspection enregistrée.', 'No inspection recorded.')}</p>}
        <ul className="clean">
          {(history.data?.inspections ?? []).map((item) => (
            <li key={item.id}>
              <strong>{formatDate(item.createdAt ?? null, locale)}</strong> — {item.targetVehicle.brand} {item.targetVehicle.model} · {t('note globale', 'overall score')} {item.scores.overall}/100
              {item.redFlags.length > 0 && <div className="small muted">{item.redFlags.join(' · ')}</div>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
