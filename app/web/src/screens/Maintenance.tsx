import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ApiMaintenanceItem, type ApiTrend, type ApiUsageFactors } from '../api';
import { useVehicles } from '../vehicle-context';
import { labelOf, useI18n, STATUS_LABELS } from '../i18n';
import { useAction, useAsync, formatDate, formatNumber } from '../hooks';
import { Card, EmptyState, ErrorBox, Notice, OriginBadge, Spinner } from '../components';

/** Entretien (§22) et maintenance prédictive (§23, V3). */
export default function MaintenanceScreen(): JSX.Element {
  const { vehicle, vehicles } = useVehicles();
  const { t, locale } = useI18n();
  const [usage, setUsage] = useState<ApiUsageFactors>({ dusty: false, mostlyCity: false, heavyHeat: false, shortTrips: false, noteFr: '' });
  const [done, setDone] = useState<Record<string, { odometerKm: string; performedAt: string }>>({});

  const plan = useAsync(() => api.get<{ plan: ApiMaintenanceItem[]; notice: string }>(`/api/vehicles/${vehicle?.id}/maintenance`), [vehicle?.id], { enabled: Boolean(vehicle) });
  const predictive = useAsync(
    () => api.post<{ plan: ApiMaintenanceItem[]; usageFactors: ApiUsageFactors }>(`/api/vehicles/${vehicle?.id}/maintenance/plan`, usage),
    [vehicle?.id, JSON.stringify(usage)],
    { enabled: Boolean(vehicle) },
  );
  const trends = useAsync(() => api.get<{ trends: ApiTrend[]; basedOnScans: number; noticeFr: string }>(`/api/vehicles/${vehicle?.id}/predictive`), [vehicle?.id], { enabled: Boolean(vehicle) });

  const record = useAction(async (item: ApiMaintenanceItem) =>
    api.post(`/api/vehicles/${vehicle?.id}/maintenance`, {
      kind: item.kind,
      labelFr: item.labelFr,
      labelEn: item.labelEn,
      performedAt: (done[item.kind]?.performedAt ?? new Date().toISOString()).slice(0, 10),
      odometerKm: done[item.kind]?.odometerKm ? Number(done[item.kind]?.odometerKm) : vehicle?.odometerKm ?? null,
      sourceId: item.sourceId,
      notes: null,
    }),
  );

  if (vehicles.length === 0) {
    return (
      <EmptyState
        title={t('Aucun véhicule', 'No vehicle')}
        message={t('Ajoutez un véhicule pour obtenir un plan d’entretien.', 'Add a vehicle to get a maintenance plan.')}
        action={<Link className="button primary" to="/vehicles">{t('Ajouter un véhicule', 'Add a vehicle')}</Link>}
      />
    );
  }

  const items = predictive.data?.plan ?? plan.data?.plan ?? [];
  const factors = predictive.data?.usageFactors;

  return (
    <div>
      <Card
        title={t('Plan d’entretien', 'Maintenance plan')}
        subtitle={vehicle ? `${vehicle.brand} ${vehicle.model} · ${formatNumber(vehicle.odometerKm)} km` : ''}
      >
        <Notice>
          {t(
            'Les intervalles affichés sont des plages usuelles attribuées à une source. Ils ne remplacent jamais le carnet d’entretien du constructeur, qui reste la référence.',
            'Displayed intervals are usual ranges attributed to a source. They never replace the manufacturer service book, which remains the reference.',
          )}
        </Notice>

        <h3>{t('Conditions d’utilisation', 'Usage conditions')}</h3>
        <p className="hint">{t('Ces facteurs ajustent les plages : usage sévère = entretien plus fréquent. XAMOTO indique toujours l’effet appliqué.', 'These factors adjust ranges: severe usage = more frequent servicing. XAMOTO always states the applied effect.')}</p>
        <div className="grid cols-4">
          {(
            [
              ['dusty', t('Zones poussiéreuses', 'Dusty areas')],
              ['mostlyCity', t('Surtout en ville', 'Mostly city driving')],
              ['heavyHeat', t('Forte chaleur', 'Heavy heat')],
              ['shortTrips', t('Trajets courts répétés', 'Repeated short trips')],
            ] as Array<[keyof ApiUsageFactors, string]>
          ).map(([key, label]) => (
            <label key={String(key)} className="row small" style={{ margin: 0 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={Boolean(usage[key])}
                onChange={(event) => setUsage({ ...usage, [key]: event.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        {factors && <p className="small muted">{factors.noteFr}</p>}
      </Card>

      <Card title={t('À faire', 'To do')}>
        <ErrorBox message={record.error} />
        {(plan.loading || predictive.loading) && <Spinner />}
        <table>
          <thead>
            <tr>
              <th>{t('Entretien', 'Service')}</th>
              <th>{t('Plage', 'Range')}</th>
              <th>{t('Prochaine échéance', 'Next due')}</th>
              <th>{t('État', 'Status')}</th>
              <th>{t('Source', 'Source')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const status = labelOf(STATUS_LABELS, item.status, { fr: item.status, en: item.status });
              return (
                <tr key={item.id}>
                  <td>
                    <strong>{locale === 'en' ? item.labelEn : item.labelFr}</strong>
                    <div className="small muted">{locale === 'en' ? item.explanationEn : item.explanationFr}</div>
                  </td>
                  <td className="small">{locale === 'en' ? item.rangeEn : item.rangeFr}</td>
                  <td className="small mono">
                    {item.nextDueKm ? `${formatNumber(item.nextDueKm)} km` : '—'}
                    {item.nextDueAt ? ` · ${formatDate(item.nextDueAt, locale)}` : ''}
                  </td>
                  <td>
                    <span className="badge outline">{locale === 'en' ? status.en : status.fr}</span>
                  </td>
                  <td className="small">
                    <OriginBadge origin={item.origin} />
                  </td>
                  <td>
                    <div className="row">
                      <input
                        type="number"
                        placeholder={t('km', 'km')}
                        style={{ width: 90 }}
                        value={done[item.kind]?.odometerKm ?? ''}
                        onChange={(event) => setDone({ ...done, [item.kind]: { odometerKm: event.target.value, performedAt: done[item.kind]?.performedAt ?? '' } })}
                      />
                      <button
                        className="button small"
                        disabled={record.loading}
                        onClick={() =>
                          void record.run(item).then((result) => {
                            if (result) {
                              plan.reload();
                              predictive.reload();
                            }
                          })
                        }
                      >
                        {t('Marquer fait', 'Mark done')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint">{plan.data?.notice}</p>
      </Card>

      <Card
        title={t('Tendances mesurées (maintenance prédictive)', 'Measured trends (predictive maintenance)')}
        subtitle={t(
          'XAMOTO affiche une tendance réelle sur vos scans successifs, jamais une prédiction de panne.',
          'XAMOTO shows a real trend over your successive scans, never a failure prediction.',
        )}
      >
        {trends.loading && <Spinner />}
        {(trends.data?.trends ?? []).length === 0 && !trends.loading && (
          <p className="hint">
            {t(
              'Pas encore assez de scans pour calculer une tendance : il faut au moins trois mesures de la même donnée. XAMOTO n’extrapole pas à partir de rien.',
              'Not enough scans yet to compute a trend: at least three measurements of the same value are needed. XAMOTO does not extrapolate from nothing.',
            )}
          </p>
        )}
        {(trends.data?.trends ?? []).length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{t('Mesure', 'Measurement')}</th>
                <th>{t('Première', 'First')}</th>
                <th>{t('Dernière', 'Latest')}</th>
                <th>{t('Évolution', 'Change')}</th>
                <th>{t('Scans', 'Scans')}</th>
                <th>{t('Origine', 'Origin')}</th>
              </tr>
            </thead>
            <tbody>
              {(trends.data?.trends ?? []).map((trend) => (
                <tr key={trend.key}>
                  <td>{trend.label}</td>
                  <td className="mono">
                    {trend.first} {trend.unit}
                  </td>
                  <td className="mono">
                    {trend.last} {trend.unit}
                  </td>
                  <td className="mono">
                    {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—'} {trend.delta} {trend.unit}
                  </td>
                  <td className="mono">{trend.samples}</td>
                  <td>
                    <OriginBadge origin={trend.origin} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="hint">{trends.data?.noticeFr}</p>
      </Card>
    </div>
  );
}
