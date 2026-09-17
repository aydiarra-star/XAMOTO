import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, type ApiAlert, type ApiDiagnostic, type ApiMaintenanceItem } from '../api';
import { useVehicles } from '../vehicle-context';
import { useI18n } from '../i18n';
import { useAsync, formatDate, formatNumber } from '../hooks';
import { Card, CertaintyBadge, EmptyState, ErrorBox, SafetyBadge, SimulationBanner, Spinner } from '../components';

/**
 * Accueil : l'utilisateur doit voir en un écran l'état de son véhicule, la
 * dernière conclusion du moteur, ce qui reste à vérifier et ce qui est prévu
 * en entretien. Aucune donnée n'est résumée au-delà de ce que le moteur a dit.
 */
export default function HomeScreen(): JSX.Element {
  const { vehicle, vehicles, loading: vehiclesLoading } = useVehicles();
  const { t, locale } = useI18n();
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);

  const diagnostics = useAsync(
    () => api.get<{ diagnostics: ApiDiagnostic[] }>(`/api/diagnostics?vehicleId=${vehicle?.id}&limit=5`),
    [vehicle?.id],
    { enabled: Boolean(vehicle) },
  );
  const maintenance = useAsync(
    () => api.get<{ plan: ApiMaintenanceItem[] }>(`/api/vehicles/${vehicle?.id}/maintenance`),
    [vehicle?.id],
    { enabled: Boolean(vehicle) },
  );

  useEffect(() => {
    api
      .get<{ alerts: ApiAlert[]; unread: number }>('/api/alerts')
      .then((result) => setAlerts(result.alerts.slice(0, 4)))
      .catch(() => setAlerts([]));
  }, [vehicle?.id]);

  if (vehiclesLoading) return <Card><Spinner label={t('Chargement de vos véhicules…', 'Loading your vehicles…')} /></Card>;

  if (vehicles.length === 0) {
    return (
      <EmptyState
        title={t('Bienvenue dans XAMOTO', 'Welcome to XAMOTO')}
        message={t(
          'Ajoutez un véhicule ou entrez en mode démonstration : XAMOTO vous montrera ce qu’il sait faire, avec des données clairement étiquetées comme simulées.',
          'Add a vehicle or enter demo mode: XAMOTO will show what it can do, with data clearly labelled as simulated.',
        )}
        action={<Link className="button primary" to="/vehicles">{t('Ajouter un véhicule', 'Add a vehicle')}</Link>}
      />
    );
  }

  const last = diagnostics.data?.diagnostics?.[0] ?? null;
  const dueItems = (maintenance.data?.plan ?? []).filter((item) => item.status === 'overdue' || item.status === 'due_soon');
  const lastScanSimulated = last?.dataOrigin === 'simulator';

  return (
    <div>
      {lastScanSimulated && <SimulationBanner />}

      <Card
        title={vehicle ? `${vehicle.nickname || `${vehicle.brand} ${vehicle.model}`}` : ''}
        subtitle={vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.year} · ${vehicle.engine} · ${formatNumber(vehicle.odometerKm)} km` : ''}
        actions={<Link className="button small" to={`/vehicles/${vehicle?.id}`}>{t('Fiche véhicule', 'Vehicle file')}</Link>}
      >
        <div className="grid cols-4">
          <Link className="stat" to="/scan" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="value">🔌</div>
            <div className="label">{t('Connecter / scanner', 'Connect / scan')}</div>
          </Link>
          <Link className="stat" to="/assistant" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="value">💬</div>
            <div className="label">{t('Poser une question', 'Ask a question')}</div>
          </Link>
          <Link className="stat" to="/maintenance" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="value mono">{dueItems.length}</div>
            <div className="label">{t('Entretiens à prévoir', 'Maintenance due')}</div>
          </Link>
          <Link className="stat" to="/alerts" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="value mono">{alerts.filter((alert) => !alert.readAt).length}</div>
            <div className="label">{t('Alertes non lues', 'Unread alerts')}</div>
          </Link>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card title={t('Dernier diagnostic', 'Latest diagnosis')} subtitle={last ? formatDate(last.startedAt, locale) : undefined}>
          <ErrorBox message={diagnostics.error} />
          {diagnostics.loading && <Spinner />}
          {!diagnostics.loading && !last && (
            <p className="hint">
              {t(
                'Aucun diagnostic enregistré pour ce véhicule. Lancez un scan (ou le mode démonstration) pour obtenir une première analyse.',
                'No diagnosis recorded for this vehicle yet. Run a scan (or demo mode) for a first analysis.',
              )}
            </p>
          )}
          {last && (
            <>
              <div className="row" style={{ marginBottom: 8 }}>
                <CertaintyBadge level={last.certainty} showHelp />
                <SafetyBadge level={last.safety} />
              </div>
              <p style={{ marginTop: 4 }}>{locale === 'en' ? last.conclusionEn : last.conclusionFr}</p>
              <div className="row" style={{ marginTop: 10 }}>
                <Link className="button small primary" to={`/diagnostics/${last.id}`}>{t('Voir le diagnostic', 'View diagnosis')}</Link>
                <Link className="button small" to={`/diagnostics/${last.id}/rouler`}>{t('Puis-je rouler ?', 'Can I drive?')}</Link>
                <Link className="button small" to={`/diagnostics/${last.id}/tests`}>{t('Tests guidés', 'Guided tests')}</Link>
              </div>
            </>
          )}
        </Card>

        <Card title={t('Entretien', 'Maintenance')} subtitle={t('Plages usuelles attribuées à une source, jamais des valeurs constructeur inventées.', 'Usual ranges from an attributed source, never invented manufacturer values.')}>
          {maintenance.loading && <Spinner />}
          {!maintenance.loading && dueItems.length === 0 && <p className="hint">{t('Rien à prévoir selon les données disponibles.', 'Nothing due based on available data.')}</p>}
          <ul className="clean">
            {dueItems.map((item) => (
              <li key={item.id}>
                <strong>{locale === 'en' ? item.labelEn : item.labelFr}</strong> — {item.status === 'overdue' ? t('en retard', 'overdue') : t('à prévoir', 'due soon')}
                <div className="small muted">{locale === 'en' ? item.rangeEn : item.rangeFr}</div>
              </li>
            ))}
          </ul>
          <Link className="button small" to="/maintenance">{t('Ouvrir le plan d’entretien', 'Open maintenance plan')}</Link>
        </Card>
      </div>

      <Card title={t('Alertes récentes', 'Recent alerts')}>
        {alerts.length === 0 && <p className="hint">{t('Aucune alerte pour le moment.', 'No alert yet.')}</p>}
        <ul className="clean">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <SafetyBadge level={alert.level} /> <strong>{locale === 'en' ? alert.titleEn : alert.titleFr}</strong>
              <div className="small muted">{locale === 'en' ? alert.bodyEn : alert.bodyFr}</div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t('Ce que XAMOTO ne fait pas', 'What XAMOTO does not do')}>
        <ul className="clean small">
          <li>{t('Il ne remplace pas un professionnel et n’engage aucune garantie sur l’état réel du véhicule.', 'It does not replace a professional and gives no guarantee on the actual state of the vehicle.')}</li>
          <li>{t('Il n’invente jamais une mesure, une valeur constructeur ou une cause.', 'It never invents a measurement, a manufacturer value or a cause.')}</li>
          <li>{t('Il dit « je ne dispose pas de cette donnée » quand l’information manque.', 'It says “I do not have this data” when information is missing.')}</li>
        </ul>
      </Card>
    </div>
  );
}
