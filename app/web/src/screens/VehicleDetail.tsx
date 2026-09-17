import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, type ApiMaintenanceItem, type ApiPassportEvent, type ApiScanSummary, type ApiVehicle } from '../api';
import { useI18n } from '../i18n';
import { useAction, useAsync, formatDate, formatDateTime, formatNumber } from '../hooks';
import { Card, EmptyState, ErrorBox, Notice, OriginBadge, SimulationBanner, Spinner } from '../components';
import { useVehicles } from '../vehicle-context';

interface PassportResponse {
  vehicle: ApiVehicle;
  summary: {
    vehicle?: { brand: string; model: string; year: number; engine: string; fuel_type: string; odometer_km: number; vin: string | null; plate: string };
    counts?: { diagnostics: number; repairs: number; maintenance: number; documents: number };
    scans?: number;
    lastDiagnostic?: { certainty: string; safety: string; conclusionFr: string; at: string; dataOrigin: string } | null;
  };
  counters: { diagnostics: number; repairs: number; maintenance: number; documents: number };
  firstEventAt: string | null;
  lastEventAt: string | null;
  events: ApiPassportEvent[];
  scans: ApiScanSummary[];
  notice?: string;
}

export default function VehicleDetailScreen(): JSX.Element {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { select, reload } = useVehicles();
  const [odometer, setOdometer] = useState('');
  const [note, setNote] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'read' | 'write' | 'diagnose'>('read');;
  const [actionError, setActionError] = useState<string | null>(null);

  const passport = useAsync(() => api.get<PassportResponse>(`/api/vehicles/${id}/passport`), [id]);
  const plan = useAsync(() => api.get<{ plan: ApiMaintenanceItem[] }>(`/api/vehicles/${id}/maintenance`), [id]);
  const shares = useAsync(
    () => api.get<{ shares: Array<{ id: string; userName: string | null; userEmail: string | null; garageName: string | null; permission: string; grantedAt: string; revokedAt: string | null }> }>(`/api/vehicles/${id}/shares`),
    [id],
  );

  const update = useAction(async (payload: Record<string, unknown>) => api.patch(`/api/vehicles/${id}`, payload));
  const addNote = useAction(async (body: Record<string, unknown>) => api.post(`/api/vehicles/${id}/documents`, body));
  const share = useAction(async (body: Record<string, unknown>) => api.post(`/api/vehicles/${id}/shares`, body));
  const revoke = useAction(async (shareId: string) => api.del(`/api/vehicles/${id}/shares/${shareId}`));
  const remove = useAction(async () => api.del(`/api/vehicles/${id}`));

  const vehicle = passport.data?.vehicle;
  if (passport.loading) return <Card><Spinner label={t('Chargement du véhicule…', 'Loading vehicle…')} /></Card>;
  if (passport.error) return <Card><ErrorBox message={passport.error} /><Link className="button" to="/vehicles">{t('Retour', 'Back')}</Link></Card>;
  if (!vehicle) return <EmptyState title={t('Véhicule introuvable', 'Vehicle not found')} message={passport.error ?? ''} action={<Link className="button" to="/vehicles">{t('Retour', 'Back')}</Link>} />;

  const events = passport.data?.events ?? [];
  const counters = passport.data?.counters;

  return (
    <div>
      {events.some((event) => event.origin === 'simulated') && <SimulationBanner />}

      <Card
        title={vehicle.nickname || `${vehicle.brand} ${vehicle.model}`}
        subtitle={`${vehicle.brand} ${vehicle.model} · ${vehicle.year} · ${vehicle.engine} · ${vehicle.fuelType}`}
        actions={
          <div className="row">
            <button
              className="button small primary"
              onClick={() => {
                select(vehicle.id);
                navigate('/scan');
              }}
            >
              {t('Lancer un scan', 'Run a scan')}
            </button>
            <Link className="button small" to="/maintenance">{t('Entretien', 'Maintenance')}</Link>
          </div>
        }
      >
        <div className="grid cols-4">
          <div className="stat">
            <div className="value mono">{formatNumber(vehicle.odometerKm)}</div>
            <div className="label">{t('Kilométrage', 'Odometer')}</div>
          </div>
          <div className="stat">
            <div className="value mono">{counters?.diagnostics ?? 0}</div>
            <div className="label">{t('Diagnostics', 'Diagnoses')}</div>
          </div>
          <div className="stat">
            <div className="value mono">{counters?.repairs ?? 0}</div>
            <div className="label">{t('Réparations', 'Repairs')}</div>
          </div>
          <div className="stat">
            <div className="value mono">{passport.data?.summary?.scans ?? 0}</div>
            <div className="label">{t('Scans', 'Scans')}</div>
          </div>
        </div>
        <div className="small muted" style={{ marginTop: 10 }}>
          {vehicle.vin ? `VIN ${vehicle.vin}` : t('VIN non renseigné', 'VIN not provided')} · {vehicle.plate || t('sans plaque', 'no plate')} ·{' '}
          {t('mis à jour le', 'updated')} {formatDate(vehicle.odometerUpdatedAt, locale)}
        </div>
      </Card>

      <div className="grid cols-2">
        <Card title={t('Fiche technique et plages usuelles', 'Spec sheet and usual ranges')} subtitle={t('Chaque valeur est attribuée à une source. Aucune valeur constructeur n’est inventée.', 'Every value is attributed to a source. No manufacturer value is invented.')}>
          {vehicle.spec ? (
            <ul className="clean">
              <li>{t('Huile moteur', 'Engine oil')} : {vehicle.spec.oilSpec ?? '—'}{vehicle.spec.oilCapacityL ? ` · ${vehicle.spec.oilCapacityL} L` : ''}</li>
              <li>{t('Liquide de refroidissement', 'Coolant')} : {vehicle.spec.coolantSpec ?? '—'}</li>
              <li>{t('Distribution', 'Timing')} : {vehicle.spec.timingType ?? '—'}{vehicle.spec.timingIntervalKm ? ` · ${formatNumber(vehicle.spec.timingIntervalKm)} km` : ''}</li>
              <li>{t('Bougies', 'Spark plugs')} : {vehicle.spec.sparkPlugSpec ?? t('non renseigné', 'not provided')}</li>
              <li>
                {t('Points de vigilance connus', 'Known watch points')} : {vehicle.spec.commonIssues.length > 0 ? vehicle.spec.commonIssues.join(' · ') : t('aucun renseigné', 'none provided')}
              </li>
              <li className="small muted">
                {t('Source', 'Source')} : {vehicle.spec.sourceId}
              </li>
            </ul>
          ) : (
            <Notice tone="warn">
              {t(
                'XAMOTO ne dispose pas de fiche technique pour ce modèle. Il ne fournira donc aucune valeur constructeur : les conseils s’appuient uniquement sur vos mesures réelles.',
                'XAMOTO has no spec sheet for this model. It will therefore provide no manufacturer value: advice relies only on your real measurements.',
              )}
            </Notice>
          )}
        </Card>

        <Card title={t('Mettre à jour', 'Update')}>
          <ErrorBox message={actionError} />
          <label htmlFor="odo">{t('Kilométrage actuel', 'Current odometer (km)')}</label>
          <div className="row">
            <input id="odo" type="number" min={0} value={odometer} onChange={(event) => setOdometer(event.target.value)} style={{ maxWidth: 180 }} />
            <button
              className="button"
              disabled={update.loading}
              onClick={() =>
                void update.run({ odometerKm: Number(odometer) }).then((result) => {
                  if (result) {
                    setOdometer('');
                    passport.reload();
                  } else setActionError(update.error);
                })
              }
            >
              {t('Enregistrer', 'Save')}
            </button>
          </div>

          <label htmlFor="doc">{t('Ajouter une note ou un document au passeport', 'Add a note or document to the passport')}</label>
          <textarea id="doc" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('Ex : vidange faite le 12/03, filtre à air changé…', 'e.g. oil change on 12 March, air filter replaced…')} />
          <div className="row" style={{ marginTop: 8 }}>
            <button
              className="button"
              disabled={addNote.loading || note.trim().length < 3}
              onClick={() =>
                void addNote
                  // §21 : le document est enregistré tel quel dans le passeport, sans interprétation.
                  .run({ kind: 'autre', title: note.trim() })
                  .then((result) => {
                    if (result) {
                      setNote('');
                      passport.reload();
                    }
                  })
              }
            >
              {t('Ajouter', 'Add')}
            </button>
          </div>
          <ErrorBox message={addNote.error} />

          <div style={{ marginTop: 16 }}>
            <button
              className="button danger small"
              disabled={remove.loading}
              onClick={() => {
                if (!window.confirm(t('Supprimer ce véhicule et tout son historique ?', 'Delete this vehicle and its entire history?'))) return;
                void remove.run().then((result) => {
                  if (result) {
                    void reload().then(() => navigate('/vehicles'));
                  }
                });
              }}
            >
              {t('Supprimer le véhicule', 'Delete vehicle')}
            </button>
          </div>
        </Card>
      </div>

      <Card title={t('Passeport du véhicule', 'Vehicle passport')} subtitle={t('Historique complet, y compris les données qui vous ont été fournies par un tiers.', 'Full history, including data provided by a third party.')}>
        <ErrorBox message={revoke.error} />
        {events.length === 0 && <p className="hint">{t('Aucun événement enregistré.', 'No event recorded.')}</p>}
        <table>
          <thead>
            <tr>
              <th>{t('Date', 'Date')}</th>
              <th>{t('Type', 'Type')}</th>
              <th>{t('Événement', 'Event')}</th>
              <th>{t('Origine', 'Origin')}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td className="small mono">{formatDateTime(event.occurredAt, locale)}</td>
                <td className="small">{event.type}</td>
                <td>
                  <strong>{locale === 'en' ? event.titleEn : event.titleFr}</strong>
                  {event.detail && <div className="small muted">{event.detail}</div>}
                </td>
                <td><OriginBadge origin={event.origin} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid cols-2">
        <Card title={t('Plan d’entretien', 'Maintenance plan')}>
          {plan.loading && <Spinner />}
          <ul className="clean">
            {(plan.data?.plan ?? []).map((item) => (
              <li key={item.id}>
                <strong>{locale === 'en' ? item.labelEn : item.labelFr}</strong> — {item.status === 'overdue' ? t('en retard', 'overdue') : item.status === 'due_soon' ? t('à prévoir', 'due soon') : t('à jour', 'up to date')}
                <div className="small muted">{locale === 'en' ? item.rangeEn : item.rangeFr}</div>
              </li>
            ))}
          </ul>
          <Link className="button small" to="/maintenance">{t('Voir le détail', 'See details')}</Link>
        </Card>

        <Card title={t('Partage et accès', 'Sharing and access')} subtitle={t('Chaque partage est révocable et journalisé. Aucune donnée n’est transmise sans votre accord.', 'Every share is revocable and logged. No data is transmitted without your consent.')}>
          <ErrorBox message={share.error} />
          <ul className="clean">
            {(shares.data?.shares ?? []).map((item) => (
              <li key={item.id}>
                <span className="row between">
                  <span>
                    {item.garageName ?? item.userEmail ?? item.userName ?? t('Destinataire inconnu', 'Unknown recipient')} — {item.permission}
                    <div className="small muted">{formatDate(item.grantedAt, locale)}</div>
                  </span>
                  {item.revokedAt ? (
                    <span className="badge outline">{t('révoqué', 'revoked')}</span>
                  ) : (
                    <button className="button small ghost" onClick={() => void revoke.run(item.id).then(() => shares.reload())}>
                      {t('Retirer', 'Revoke')}
                    </button>
                  )}
                </span>
              </li>
            ))}
            {(shares.data?.shares ?? []).length === 0 && <li className="muted">{t('Aucun partage actif.', 'No active share.')}</li>}
          </ul>
          <label htmlFor="shareEmail">{t('Partager avec un compte XAMOTO (e-mail)', 'Share with a XAMOTO account (e-mail)')}</label>
          <div className="row">
            <input
              id="shareEmail"
              type="email"
              value={shareEmail}
              onChange={(event) => setShareEmail(event.target.value)}
              placeholder="ami@exemple.com"
              style={{ maxWidth: 260 }}
            />
            <select
              value={sharePermission}
              onChange={(event) => setSharePermission(event.target.value as 'read' | 'write' | 'diagnose')}
              style={{ width: 'auto' }}
            >
              <option value="read">{t('Lecture', 'Read')}</option>
              <option value="diagnose">{t('Diagnostic', 'Diagnose')}</option>
              <option value="write">{t('Écriture', 'Write')}</option>
            </select>
            <button
              className="button small"
              disabled={share.loading || shareEmail.trim().length < 5}
              onClick={() =>
                void share.run({ email: shareEmail.trim(), permission: sharePermission }).then((result) => {
                  if (result) {
                    setShareEmail('');
                    shares.reload();
                  }
                })
              }
            >
              {t('Partager', 'Share')}
            </button>
          </div>
          <p className="hint">{t('Le partage n’accorde aucun droit de modification sans accord explicite du propriétaire.', 'Sharing never grants write rights without the owner’s explicit consent.')}</p>
        </Card>
      </div>

      {passport.data?.notice && <Notice>{passport.data.notice}</Notice>}
      {actionError && <ErrorBox message={actionError} />}
    </div>
  );
}
