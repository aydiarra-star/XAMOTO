import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type ApiReportSummary } from '../api';
import { useVehicles } from '../vehicle-context';
import { useI18n } from '../i18n';
import { useAction, useAsync, formatDateTime } from '../hooks';
import { Card, EmptyState, ErrorBox, Notice, Spinner } from '../components';

/**
 * Rapport partageable (§25).
 *
 * Le rapport est lisible par un tiers (garage, acheteur) via un lien ou un QR
 * code, sans compte XAMOTO. Il contient toujours ce qui a été mesuré, ce qui
 * manque, les niveaux de certitude et la mention de non-garantie.
 */
export default function ReportScreen(): JSX.Element {
  const { id = '' } = useParams();
  const { vehicle, vehicles } = useVehicles();
  const { t, locale } = useI18n();
  const [shareToken, setShareToken] = useState<string | null>(null);

  const diagnostics = useAsync(
    () => api.get<{ diagnostics: Array<{ id: string; startedAt: string; certainty: string; safety: string }> }>(`/api/diagnostics?vehicleId=${vehicle?.id}&limit=20`),
    [vehicle?.id],
    { enabled: Boolean(vehicle) },
  );
  const reports = useAsync(() => api.get<{ reports: ApiReportSummary[] }>('/api/reports'), []);

  const create = useAction(async (sessionId: string) =>
    api.post<{ id: string; shareToken: string; publicUrl: string; qrDataUrl: string }>('/api/reports', {
      vehicleId: vehicle?.id,
      sessionId,
      kind: 'diagnostic',
    }),
  );

  if (vehicles.length === 0) {
    return <EmptyState title={t('Aucun véhicule', 'No vehicle')} message={t('Ajoutez un véhicule pour générer un rapport.', 'Add a vehicle to generate a report.')} action={<Link className="button primary" to="/vehicles">{t('Ajouter un véhicule', 'Add a vehicle')}</Link>} />;
  }

  return (
    <div>
      <Card
        title={t('Rapports', 'Reports')}
        subtitle={t('Un rapport XAMOTO reste lisible même par une personne qui n’utilise pas l’application.', 'A XAMOTO report stays readable even by someone who does not use the app.')}
      >
        <ErrorBox message={reports.error ?? create.error} />

        <h3>{t('Créer un rapport', 'Create a report')}</h3>
        {diagnostics.loading && <Spinner />}
        <div className="row">
          {(diagnostics.data?.diagnostics ?? []).map((item) => (
            <button
              key={item.id}
              className={`button small ${item.id === id ? 'primary' : ''}`}
              disabled={create.loading}
              onClick={() =>
                void create.run(item.id).then((result) => {
                  if (result) {
                    setShareToken(result.shareToken);
                    reports.reload();
                  }
                })
              }
            >
              {formatDateTime(item.startedAt, locale)} · {item.certainty}/{item.safety}
            </button>
          ))}
        </div>

        {create.data && (
          <Notice tone="ok">
            <strong>{t('Rapport prêt à partager', 'Report ready to share')}</strong>
            <div className="small">
              <a href={`/api/reports/public/${create.data.shareToken}`} target="_blank" rel="noreferrer">
                {create.data.publicUrl}
              </a>
            </div>
            {create.data.qrDataUrl && <img src={create.data.qrDataUrl} alt="QR code du rapport" style={{ width: 140, height: 140, marginTop: 8, background: '#fff', borderRadius: 8 }} />}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="button small" onClick={() => void navigator.clipboard?.writeText(create.data!.publicUrl)}>
                {t('Copier le lien', 'Copy link')}
              </button>
            </div>
            <small>
              {t(
                'Toute personne disposant de ce lien peut lire le rapport. Vous pouvez le révoquer à tout moment.',
                'Anyone with this link can read the report. You can revoke it at any time.',
              )}
            </small>
          </Notice>
        )}

        <h3 style={{ marginTop: 18 }}>{t('Rapports enregistrés', 'Saved reports')}</h3>
        {reports.loading && <Spinner />}
        {(reports.data?.reports ?? []).length === 0 && !reports.loading && <p className="hint">{t('Aucun rapport pour le moment.', 'No report yet.')}</p>}
        <ul className="clean">
          {(reports.data?.reports ?? []).map((item) => (
            <li key={item.id}>
              <div className="row between">
                <span>
                  <strong>{item.title || item.kind}</strong>
                  <div className="small muted">
                    {item.vehicle ?? ''} · {formatDateTime(item.generatedAt, locale)} · {item.kind}
                  </div>
                </span>
                <span className="row">
                  {item.shareToken && (
                    <a className="button small ghost" href={`/api/reports/public/${item.shareToken}`} target="_blank" rel="noreferrer">
                      {t('Ouvrir', 'Open')}
                    </a>
                  )}
                  <button
                    className="button small danger"
                    onClick={() =>
                      void api.del(`/api/reports/${item.id}/share`).then(() => reports.reload())
                    }
                  >
                    {t('Révoquer le partage', 'Revoke share')}
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
        {shareToken && <p className="small muted">{t('Dernier jeton de partage', 'Latest share token')} : {shareToken}</p>}
      </Card>
    </div>
  );
}
