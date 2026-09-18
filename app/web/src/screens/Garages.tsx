import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ApiDiagnostic, type ApiGarage, type ApiPart } from '../api';
import { useVehicles } from '../vehicle-context';
import { useI18n } from '../i18n';
import { useAction, useAsync } from '../hooks';
import { Card, EmptyState, ErrorBox, Notice, Spinner } from '../components';

/**
 * Réseau de garages (§26), devis (§27) et pièces (§28).
 *
 * La carte utilise OpenStreetMap (§34) : aucune donnée de localisation n'est
 * inventée. Si un garage n'a pas de coordonnées, il est affiché sans carte.
 * XAMOTO ne classe pas les garages par « qualité » : il affiche des faits.
 */
export default function GaragesScreen(): JSX.Element {
  const { vehicle } = useVehicles();
  const { t, locale } = useI18n();
  const [country, setCountry] = useState('SN');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ApiGarage | null>(null);
  const [share, setShare] = useState({ consent: false, includeMeasurements: true, includeDtcList: true, includeHistory: false, message: '' });
  const [diagnosticId, setDiagnosticId] = useState('');

  const garages = useAsync(() => api.get<{ garages: ApiGarage[]; total: number; noticeFr: string; attribution: string }>(`/api/garages?country=${country}${city ? `&city=${encodeURIComponent(city)}` : ''}${specialty ? `&specialty=${encodeURIComponent(specialty)}` : ''}`), [country, city, specialty]);
  const parts = useAsync(() => api.get<{ parts: ApiPart[]; noticeFr: string }>(`/api/parts${search ? `?search=${encodeURIComponent(search)}` : ''}`), [search]);
  const diagnostics = useAsync(
    () => api.get<{ diagnostics: ApiDiagnostic[] }>(`/api/diagnostics?vehicleId=${vehicle?.id}&limit=10`),
    [vehicle?.id],
    { enabled: Boolean(vehicle) },
  );
  const shareDiagnostic = useAction(async () =>
    api.post(`/api/garages/${selected?.id}/share-diagnostic`, {
      vehicleId: vehicle?.id,
      diagnosticSessionId: diagnosticId,
      includeMeasurements: share.includeMeasurements,
      includeDtcList: share.includeDtcList,
      includeHistory: share.includeHistory,
      message: share.message || undefined,
      consent: true,
    }),
  );

  const mapGarages = useMemo(() => (garages.data?.garages ?? []).filter((garage) => garage.lat !== null && garage.lon !== null), [garages.data]);

  const bbox = useMemo(() => {
    if (mapGarages.length === 0) return null;
    const lats = mapGarages.map((garage) => garage.lat as number);
    const lons = mapGarages.map((garage) => garage.lon as number);
    return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLon: Math.min(...lons), maxLon: Math.max(...lons) };
  }, [mapGarages]);

  const mapSrc = bbox
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.minLon - 0.15}%2C${bbox.minLat - 0.1}%2C${bbox.maxLon + 0.15}%2C${bbox.maxLat + 0.1}&layer=mapnik&marker=${mapGarages[0]?.lat}%2C${mapGarages[0]?.lon}`
    : null;

  if (!vehicle) {
    return (
      <EmptyState
        title={t('Choisissez un véhicule', 'Choose a vehicle')}
        message={t('Le partage d’un diagnostic à un garage nécessite un véhicule et un diagnostic.', 'Sharing a diagnosis with a garage requires a vehicle and a diagnosis.')}
        action={<Link className="button primary" to="/vehicles">{t('Mes véhicules', 'My vehicles')}</Link>}
      />
    );
  }

  return (
    <div>
      <Card
        title={t('Garages', 'Garages')}
        subtitle={t('Annuaire de professionnels, avec leurs équipements et spécialités déclarés. XAMOTO ne garantit pas la qualité d’un garage.', 'Directory of professionals with their declared equipment and specialties. XAMOTO does not guarantee a garage’s quality.')}
      >
        <div className="field-row">
          <div>
            <label htmlFor="country">{t('Pays', 'Country')}</label>
            <select id="country" value={country} onChange={(event) => setCountry(event.target.value)}>
              <option value="SN">Sénégal</option>
              <option value="CI">Côte d’Ivoire</option>
              <option value="ML">Mali</option>
              <option value="BF">Burkina Faso</option>
              <option value="CM">Cameroun</option>
              <option value="FR">France</option>
            </select>
          </div>
          <div>
            <label htmlFor="city">{t('Ville', 'City')}</label>
            <input id="city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Dakar" />
          </div>
          <div>
            <label htmlFor="specialty">{t('Spécialité', 'Specialty')}</label>
            <input id="specialty" value={specialty} onChange={(event) => setSpecialty(event.target.value)} placeholder={t('électronique, diesel…', 'electronics, diesel…')} />
          </div>
        </div>
        <ErrorBox message={garages.error} />
        {garages.loading && <Spinner />}
        <div className="grid cols-2" style={{ marginTop: 12 }}>
          {(garages.data?.garages ?? []).map((garage) => (
            <div key={garage.id} className="stat">
              <div className="row between">
                <strong>{garage.name}</strong>
                {garage.verified ? <span className="badge outline">{t('vérifié', 'verified')}</span> : <span className="badge outline">{t('non vérifié', 'not verified')}</span>}
              </div>
              <div className="small muted">
                {garage.city}, {garage.country}
                {garage.rating !== null ? ` · ${garage.rating}/5` : ''}
              </div>
              {garage.specialties.length > 0 && <div className="small">{t('Spécialités', 'Specialties')} : {garage.specialties.join(', ')}</div>}
              {garage.equipment.length > 0 && <div className="small">{t('Équipement', 'Equipment')} : {garage.equipment.join(', ')}</div>}
              <div className="small">{garage.acceptsXamotoDiagnostics ? t('Accepte les diagnostics XAMOTO', 'Accepts XAMOTO diagnostics') : t('Ne déclare pas accepter les diagnostics XAMOTO', 'Does not declare accepting XAMOTO diagnostics')}</div>
              {garage.phone && <div className="small">{t('Téléphone', 'Phone')} : {garage.phone}</div>}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="button small" onClick={() => setSelected(garage)}>{t('Partager un diagnostic', 'Share a diagnosis')}</button>
                {garage.lat !== null && garage.lon !== null && (
                  <a className="button small ghost" href={`https://www.openstreetmap.org/?mlat=${garage.lat}&mlon=${garage.lon}#map=16/${garage.lat}/${garage.lon}`} target="_blank" rel="noreferrer">
                    {t('Ouvrir la carte', 'Open map')}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="small muted">{garages.data?.noticeFr}</p>
        <p className="small muted">{garages.data?.attribution}</p>
      </Card>

      {mapSrc && (
        <Card title={t('Carte (OpenStreetMap)', 'Map (OpenStreetMap)')} subtitle={t('Seuls les garages disposant de coordonnées connues apparaissent.', 'Only garages with known coordinates appear.')}>
          <iframe title="Carte des garages XAMOTO" className="map" src={mapSrc} loading="lazy" />
        </Card>
      )}

      {selected && (
        <Card
          title={`${t('Partager un diagnostic avec', 'Share a diagnosis with')} ${selected.name}`}
          subtitle={t('Vous choisissez précisément ce qui est transmis. Rien n’est envoyé sans votre consentement explicite.', 'You choose exactly what is transmitted. Nothing is sent without your explicit consent.')}
        >
          <ErrorBox message={shareDiagnostic.error} />
          {shareDiagnostic.data ? <Notice tone="ok">{t('Diagnostic transmis. Vous pouvez retirer cet accès à tout moment.', 'Diagnosis sent. You can revoke this access at any time.')}</Notice> : null}

          <label htmlFor="diag">{t('Diagnostic à partager', 'Diagnosis to share')}</label>
          <select id="diag" value={diagnosticId} onChange={(event) => setDiagnosticId(event.target.value)}>
            <option value="">{t('Choisir…', 'Choose…')}</option>
            {(diagnostics.data?.diagnostics ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {new Date(item.startedAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR')} — {item.certainty}/{item.safety}
              </option>
            ))}
          </select>

          <div className="grid cols-3" style={{ marginTop: 10 }}>
            <label className="row small" style={{ margin: 0 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={share.includeMeasurements} onChange={(event) => setShare({ ...share, includeMeasurements: event.target.checked })} />
              {t('Mesures', 'Measurements')}
            </label>
            <label className="row small" style={{ margin: 0 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={share.includeDtcList} onChange={(event) => setShare({ ...share, includeDtcList: event.target.checked })} />
              {t('Codes défaut', 'Fault codes')}
            </label>
            <label className="row small" style={{ margin: 0 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={share.includeHistory} onChange={(event) => setShare({ ...share, includeHistory: event.target.checked })} />
              {t('Historique du véhicule', 'Vehicle history')}
            </label>
          </div>

          <label htmlFor="message">{t('Message (optionnel)', 'Message (optional)')}</label>
          <textarea id="message" rows={2} value={share.message} onChange={(event) => setShare({ ...share, message: event.target.value })} />

          <label className="row small" style={{ marginTop: 10 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={share.consent} onChange={(event) => setShare({ ...share, consent: event.target.checked })} />
            {t(
              'Je consens explicitement au partage de ces éléments avec ce garage.',
              'I explicitly consent to sharing these items with this garage.',
            )}
          </label>

          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="button primary"
              disabled={!share.consent || !diagnosticId || shareDiagnostic.loading}
              onClick={() => void shareDiagnostic.run()}
            >
              {t('Transmettre au garage', 'Send to garage')}
            </button>
            <button className="button ghost" onClick={() => setSelected(null)}>{t('Annuler', 'Cancel')}</button>
          </div>
          <p className="hint">
            {t(
              'Le partage est journalisé dans l’historique du véhicule. Sans coche de consentement, le serveur refuse la transmission.',
              'The share is logged in the vehicle history. Without the consent checkbox, the server refuses the transmission.',
            )}
          </p>
        </Card>
      )}

      <Card
        title={t('Pièces et correspondances', 'Parts and cross-references')}
        subtitle={t('Références, équivalents et disponibilité déclarée. XAMOTO n’invente aucune référence.', 'References, equivalents and declared availability. XAMOTO invents no reference.')}
      >
        <label htmlFor="partSearch">{t('Rechercher une pièce', 'Search a part')}</label>
        <input id="partSearch" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('filtre à huile, plaquettes…', 'oil filter, brake pads…')} />
        {parts.loading && <Spinner />}
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>{t('Pièce', 'Part')}</th>
              <th>{t('Références', 'References')}</th>
              <th>{t('Équivalents', 'Equivalents')}</th>
              <th>{t('Prix indicatif', 'Indicative price')}</th>
              <th>{t('Disponibilité', 'Availability')}</th>
            </tr>
          </thead>
          <tbody>
            {(parts.data?.parts ?? []).map((part) => (
              <tr key={part.id}>
                <td>
                  <strong>{locale === 'en' ? part.nameEn : part.nameFr}</strong>
                  <div className="small muted">{part.category}</div>
                </td>
                <td className="small mono">{part.oemReferences.join(', ') || '—'}</td>
                <td className="small">{part.equivalents.join(', ') || '—'}</td>
                <td className="small mono">{part.typicalPriceXof ? `${part.typicalPriceXof.toLocaleString('fr-FR')} FCFA` : t('non renseigné', 'not provided')}</td>
                <td className="small">{part.availabilitySn ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">{parts.data?.noticeFr}</p>
        <Notice>
          {t(
            'Le prix affiché est une information de référence, jamais un devis. XAMOTO ne recommande aucune pièce sans test préalable.',
            'The displayed price is reference information, never a quote. XAMOTO recommends no part without a prior test.',
          )}
        </Notice>
      </Card>
    </div>
  );
}
