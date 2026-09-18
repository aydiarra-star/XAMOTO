import { api, type ApiAlert } from '../api';
import { useVehicles } from '../vehicle-context';
import { useI18n } from '../i18n';
import { useAction, useAsync, formatDateTime } from '../hooks';
import { Card, EmptyState, ErrorBox, Notice, SafetyBadge, Spinner } from '../components';
import { Link } from 'react-router-dom';

/** Alertes et notifications (§22) : factuelles, jamais alarmistes sans donnée. */
export default function AlertsScreen(): JSX.Element {
  const { vehicles } = useVehicles();
  const { t, locale } = useI18n();

  const alerts = useAsync(() => api.get<{ alerts: ApiAlert[]; unread: number }>('/api/alerts'), []);
  const markRead = useAction(async (payload: { all?: boolean; ids?: string[] }) => api.post('/api/alerts/read', payload));

  if (vehicles.length === 0) {
    return (
      <EmptyState
        title={t('Aucune alerte', 'No alert')}
        message={t('Ajoutez un véhicule et lancez un scan : les alertes sont produites à partir de données réelles.', 'Add a vehicle and run a scan: alerts are produced from real data.')}
        action={<Link className="button primary" to="/vehicles">{t('Ajouter un véhicule', 'Add a vehicle')}</Link>}
      />
    );
  }

  const list = alerts.data?.alerts ?? [];

  return (
    <div>
      <Card
        title={t('Alertes', 'Alerts')}
        subtitle={t('Une alerte XAMOTO repose toujours sur une donnée ou une échéance identifiée.', 'A XAMOTO alert is always based on a named datum or schedule item.')}
        actions={
          <button className="button small" disabled={markRead.loading} onClick={() => void markRead.run({ all: true }).then(() => alerts.reload())}>
            {t('Tout marquer comme lu', 'Mark all as read')}
          </button>
        }
      >
        <ErrorBox message={alerts.error} />
        {alerts.loading && <Spinner />}
        {!alerts.loading && list.length === 0 && <p className="hint">{t('Aucune alerte enregistrée.', 'No alert recorded.')}</p>}
        <ul className="clean">
          {list.map((alert) => (
            <li key={alert.id}>
              <div className="row between">
                <span className="row">
                  <SafetyBadge level={alert.level} />
                  <strong>{locale === 'en' ? alert.titleEn : alert.titleFr}</strong>
                  {!alert.readAt && <span className="badge outline">{t('non lue', 'unread')}</span>}
                </span>
                <span className="small muted mono">{formatDateTime(alert.createdAt, locale)}</span>
              </div>
              <div className="small">{locale === 'en' ? alert.bodyEn : alert.bodyFr}</div>
            </li>
          ))}
        </ul>
        {list.length > 0 && (
          <Notice>
            {t(
              'XAMOTO n’envoie pas d’alerte sans donnée : une alerte signifie qu’une mesure, un code défaut ou une échéance justifie votre attention.',
              'XAMOTO sends no alert without data: an alert means a measurement, a fault code or a schedule item deserves your attention.',
            )}
          </Notice>
        )}
      </Card>
    </div>
  );
}
