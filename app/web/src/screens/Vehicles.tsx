import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, type ApiVehicle } from '../api';
import { useVehicles } from '../vehicle-context';
import { useI18n } from '../i18n';
import { useAction } from '../hooks';
import { Card, EmptyState, ErrorBox, Spinner } from '../components';

const FUELS = [
  { value: 'essence', fr: 'Essence', en: 'Petrol' },
  { value: 'diesel', fr: 'Diesel', en: 'Diesel' },
  { value: 'hybride', fr: 'Hybride', en: 'Hybrid' },
  { value: 'hybride_rechargeable', fr: 'Hybride rechargeable', en: 'Plug-in hybrid' },
  { value: 'electrique', fr: 'Électrique', en: 'Electric' },
  { value: 'gpl', fr: 'GPL', en: 'LPG' },
  { value: 'flex', fr: 'Flex (éthanol)', en: 'Flex (ethanol)' },
];

const GEARBOXES = [
  { value: 'manuelle', fr: 'Manuelle', en: 'Manual' },
  { value: 'automatique', fr: 'Automatique', en: 'Automatic' },
  { value: 'robotisee', fr: 'Robotisée', en: 'Automated' },
  { value: 'cvt', fr: 'CVT', en: 'CVT' },
  { value: 'inconnue', fr: 'Inconnue', en: 'Unknown' },
];

export default function VehiclesScreen(): JSX.Element {
  const { vehicles, reload, addVehicle, select } = useVehicles();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(vehicles.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nickname: '',
    brand: '',
    model: '',
    year: new Date().getFullYear() - 5,
    engine: '',
    fuelType: 'essence',
    gearbox: 'manuelle',
    plate: '',
    vin: '',
    odometerKm: 0,
  });

  const demo = useAction(async (scenario: string) => api.post<{ vehicleId: string; diagnosticSessionId: string; notice: string }>('/api/demo/vehicle', { scenario }));

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const vehicle = await addVehicle({
        ...form,
        year: Number(form.year),
        odometerKm: Number(form.odometerKm),
        vin: form.vin.trim() === '' ? undefined : form.vin.trim().toUpperCase(),
      });
      setShowForm(false);
      navigate(`/vehicles/${vehicle.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('Ajout impossible.', 'Could not add the vehicle.'));
    }
  }

  return (
    <div>
      <Card
        title={t('Mes véhicules', 'My vehicles')}
        subtitle={t('Un véhicule = un historique complet : diagnostics, réparations, entretien et documents.', 'One vehicle = one full history: diagnoses, repairs, maintenance and documents.')}
        actions={
          <div className="row">
            <button className="button small" onClick={() => setShowForm((value) => !value)}>
              {showForm ? t('Fermer', 'Close') : t('Ajouter un véhicule', 'Add a vehicle')}
            </button>
            <Link className="button small ghost" to="/scan">{t('Scanner', 'Scan')}</Link>
          </div>
        }
      >
        <ErrorBox message={error} />
        {vehicles.length === 0 && <p className="hint">{t('Aucun véhicule enregistré pour le moment.', 'No vehicle registered yet.')}</p>}
        <div className="grid cols-2">
          {vehicles.map((vehicle: ApiVehicle) => (
            <div key={vehicle.id} className="stat">
              <div className="row between">
                <strong>{vehicle.nickname || `${vehicle.brand} ${vehicle.model}`}</strong>
                {vehicle.spec ? (
                  <span className="badge outline">{t('Fiche technique', 'Spec sheet')}</span>
                ) : (
                  <span className="badge outline">{t('Sans fiche technique', 'No spec sheet')}</span>
                )}
              </div>
              <div className="small muted">
                {vehicle.brand} {vehicle.model} · {vehicle.year} · {vehicle.engine}
                <br />
                {vehicle.fuelType} · {vehicle.gearbox} · {vehicle.odometerKm.toLocaleString('fr-FR')} km
                {vehicle.plate ? ` · ${vehicle.plate}` : ''}
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <Link className="button small primary" to={`/vehicles/${vehicle.id}`}>{t('Ouvrir', 'Open')}</Link>
                <button
                  className="button small ghost"
                  onClick={() => {
                    select(vehicle.id);
                    navigate('/scan');
                  }}
                >
                  {t('Scanner ce véhicule', 'Scan this vehicle')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {showForm && (
        <Card title={t('Ajouter un véhicule', 'Add a vehicle')} subtitle={t('Les champs marqués d’une étoile sont nécessaires pour que le moteur puisse travailler.', 'Fields marked with a star are required for the engine to work.')}>
          <form onSubmit={submit}>
            <div className="field-row">
              <div>
                <label htmlFor="nickname">{t('Surnom', 'Nickname')}</label>
                <input id="nickname" value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder={t('Ex : Taxi de Papa', 'e.g. Dad’s taxi')} />
              </div>
              <div>
                <label htmlFor="brand">{t('Marque *', 'Brand *')}</label>
                <input id="brand" required value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder="Toyota, Peugeot…" />
              </div>
              <div>
                <label htmlFor="model">{t('Modèle *', 'Model *')}</label>
                <input id="model" required value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="Corolla, 308…" />
              </div>
              <div>
                <label htmlFor="year">{t('Année *', 'Year *')}</label>
                <input id="year" type="number" min={1950} max={new Date().getFullYear() + 1} required value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })} />
              </div>
              <div>
                <label htmlFor="engine">{t('Motorisation *', 'Engine *')}</label>
                <input id="engine" required value={form.engine} onChange={(event) => setForm({ ...form, engine: event.target.value })} placeholder="1.6 16v, 2.0 HDi…" />
              </div>
              <div>
                <label htmlFor="fuelType">{t('Carburant', 'Fuel')}</label>
                <select id="fuelType" value={form.fuelType} onChange={(event) => setForm({ ...form, fuelType: event.target.value })}>
                  {FUELS.map((fuel) => (
                    <option key={fuel.value} value={fuel.value}>
                      {locale === 'en' ? fuel.en : fuel.fr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="gearbox">{t('Boîte de vitesses', 'Gearbox')}</label>
                <select id="gearbox" value={form.gearbox} onChange={(event) => setForm({ ...form, gearbox: event.target.value })}>
                  {GEARBOXES.map((gearbox) => (
                    <option key={gearbox.value} value={gearbox.value}>
                      {locale === 'en' ? gearbox.en : gearbox.fr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="odometerKm">{t('Kilométrage', 'Odometer (km)')}</label>
                <input id="odometerKm" type="number" min={0} value={form.odometerKm} onChange={(event) => setForm({ ...form, odometerKm: Number(event.target.value) })} />
              </div>
              <div>
                <label htmlFor="plate">{t('Immatriculation', 'Plate')}</label>
                <input id="plate" value={form.plate} onChange={(event) => setForm({ ...form, plate: event.target.value })} placeholder="DK-1234-AB" />
              </div>
              <div>
                <label htmlFor="vin">{t('VIN (17 caractères, optionnel)', 'VIN (17 characters, optional)')}</label>
                <input id="vin" value={form.vin} onChange={(event) => setForm({ ...form, vin: event.target.value })} maxLength={17} placeholder="VF1…" />
              </div>
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="button primary" type="submit">{t('Enregistrer le véhicule', 'Save vehicle')}</button>
              <span className="hint">{t('XAMOTO ne devine pas la fiche technique : si elle manque, il le dit.', 'XAMOTO does not guess the spec sheet: if it is missing, it says so.')}</span>
            </div>
          </form>
        </Card>
      )}

      {!showForm && vehicles.length === 0 && (
        <EmptyState
          title={t('Rien à afficher', 'Nothing to show')}
          message={t('Ajoutez un véhicule ci-dessus.', 'Add a vehicle above.')}
          action={<button className="button" onClick={() => setShowForm(true)}>{t('Ajouter un véhicule', 'Add a vehicle')}</button>}
        />
      )}

      <Card
        title={t('Tester sans véhicule réel', 'Test without a real vehicle')}
        subtitle={t('Un scénario simulé crée un véhicule de démonstration et lance un scan étiqueté MODE SIMULATION.', 'A simulated scenario creates a demo vehicle and runs a scan labelled SIMULATION MODE.')}
      >
        <ErrorBox message={demo.error} />
        <div className="row">
          {['normal_engine', 'weak_battery', 'engine_fault', 'multiple_dtc', 'high_temperature', 'intermittent_fault', 'diesel_egr_dpf', 'no_start'].map((scenario) => (
            <button
              key={scenario}
              className="button small"
              disabled={demo.loading}
              onClick={() =>
                void demo.run(scenario).then((result) => {
                  if (result) {
                    void reload();
                    navigate(`/diagnostics/${result.diagnosticSessionId}`);
                  }
                })
              }
            >
              {scenario.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        {demo.loading && <div style={{ marginTop: 10 }}><Spinner label={t('Simulation en cours…', 'Running simulation…')} /></div>}
      </Card>
    </div>
  );
}
