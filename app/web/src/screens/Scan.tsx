import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, type ApiScenario, type ApiScanResult, type ApiSymptom } from '../api';
import { useVehicles } from '../vehicle-context';
import { useI18n } from '../i18n';
import { useAction, useAsync, formatDateTime } from '../hooks';
import { Card, EmptyState, ErrorBox, Notice, SimulationBanner, Spinner } from '../components';

/**
 * Scan OBD (§7, §8, §30).
 *
 * Deux chemins possibles, toujours distingués :
 *   1. un véhicule réel via un adaptateur ELM327 (Wi-Fi) ;
 *   2. le simulateur, qui produit des données SIMULÉES et l'annonce partout.
 *
 * Règle : si un PID n'est pas supporté par le véhicule, XAMOTO l'indique comme
 * NON DISPONIBLE — il ne le remplace jamais par une valeur estimée.
 */
export default function ScanScreen(): JSX.Element {
  const { vehicle, vehicles } = useVehicles();
  const { t, locale } = useI18n();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'simulator' | 'obd'>('simulator');
  const [scenario, setScenario] = useState('engine_fault');
  const [samples, setSamples] = useState(5);
  const [analysisMode, setAnalysisMode] = useState<'standard' | 'guided' | 'inspection' | 'second_opinion' | 'post_repair'>('standard');
  const [symptoms, setSymptoms] = useState<Record<string, boolean>>({});
  const [host, setHost] = useState('192.168.0.10');
  const [port, setPort] = useState(35000);
  const [result, setResult] = useState<ApiScanResult | null>(null);

  const scenarios = useAsync(() => api.get<{ scenarios: ApiScenario[]; notice: string }>('/api/obd/simulator/scenarios'), []);
  const symptomList = useAsync(() => api.get<{ symptoms: ApiSymptom[] }>('/api/knowledge/symptoms'), []);
  const candidates = useAsync(() => api.get<{ hosts: string[]; ports: number[]; notice: string; bluetooth: Record<string, unknown> }>('/api/obd/candidates'), []);

  const probe = useAction(async (address: { host: string; port: number }) =>
    api.post<{ reachable: boolean; device?: unknown; error?: string; hint?: string }>('/api/obd/probe', address),
  );
  const scan = useAction(async () =>
    api.post<ApiScanResult>('/api/scans', {
      vehicleId: vehicle?.id,
      mode,
      scenario: mode === 'simulator' ? scenario : undefined,
      host: mode === 'obd' ? host : undefined,
      port: mode === 'obd' ? Number(port) : undefined,
      samples: Number(samples),
      symptoms: Object.entries(symptoms)
        .filter(([, present]) => present)
        .map(([key]) => ({ key, present: true })),
      analysisMode,
    }),
  );

  if (vehicles.length === 0) {
    return (
      <EmptyState
        title={t('Aucun véhicule sélectionné', 'No vehicle selected')}
        message={t('Ajoutez d’abord un véhicule : un diagnostic sans véhicule n’aurait aucun sens.', 'Add a vehicle first: a diagnosis without a vehicle would be meaningless.')}
        action={<a className="button primary" href="/vehicles">{t('Ajouter un véhicule', 'Add a vehicle')}</a>}
      />
    );
  }

  async function launch(): Promise<void> {
    const outcome = await scan.run();
    if (outcome) {
      setResult(outcome);
      navigate(`/diagnostics/${outcome.diagnosticSessionId}`);
    }
  }

  return (
    <div>
      {mode === 'simulator' && <SimulationBanner notice={t('Le simulateur XAMOTO produit des données réalistes mais non mesurées sur un véhicule.', 'The XAMOTO simulator produces realistic but not vehicle-measured data.')} />}

      <Card
        title={t('Connexion au véhicule', 'Vehicle connection')}
        subtitle={vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year}) · ${vehicle.engine}` : ''}
      >
        <div className="tabs">
          <button className={mode === 'simulator' ? 'active' : ''} onClick={() => setMode('simulator')}>
            🧪 {t('Simulateur', 'Simulator')}
          </button>
          <button className={mode === 'obd' ? 'active' : ''} onClick={() => setMode('obd')}>
            🔌 {t('Adaptateur OBD (ELM327 Wi-Fi)', 'OBD adapter (ELM327 Wi-Fi)')}
          </button>
        </div>

        {mode === 'simulator' && (
          <>
            <label htmlFor="scenario">{t('Scénario simulé', 'Simulated scenario')}</label>
            <select id="scenario" value={scenario} onChange={(event) => setScenario(event.target.value)}>
              {(scenarios.data?.scenarios ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {(locale === 'en' ? item.labelEn : item.labelFr) + ` — ${item.dtcCodes.join(', ') || t('aucun code', 'no code')}`}
                </option>
              ))}
            </select>
            <p className="hint">{scenarios.data?.notice}</p>
          </>
        )}

        {mode === 'obd' && (
          <>
            <Notice tone="warn">
              {t(
                'Un scan réel exige le contact mis, l’adaptateur branché sur la prise OBD et l’appareil connecté à son réseau Wi-Fi. XAMOTO n’affichera jamais de valeur si la lecture échoue.',
                'A real scan requires the ignition on, the adapter plugged into the OBD port and the device connected to its Wi-Fi network. XAMOTO will never display a value if the read fails.',
              )}
            </Notice>
            <div className="field-row" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="host">{t('Adresse de l’adaptateur', 'Adapter address')}</label>
                <input id="host" value={host} onChange={(event) => setHost(event.target.value)} />
              </div>
              <div>
                <label htmlFor="port">{t('Port', 'Port')}</label>
                <input id="port" type="number" value={port} onChange={(event) => setPort(Number(event.target.value))} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="button small" disabled={probe.loading} onClick={() => void probe.run({ host, port: Number(port) })}>
                {t('Tester la connexion', 'Test connection')}
              </button>
              {candidates.data?.hosts?.length ? (
                <span className="small muted">
                  {t('Adresses usuelles', 'Common addresses')} : {candidates.data.hosts.slice(0, 4).join(', ')} · {candidates.data.ports.join(', ')}
                </span>
              ) : null}
            </div>
            {probe.data?.reachable && <Notice tone="ok">{t('Adaptateur joignable. Vous pouvez lancer le scan.', 'Adapter reachable. You can start the scan.')}</Notice>}
            {probe.data && !probe.data.reachable && <Notice tone="danger">{probe.data.error} {probe.data.hint}</Notice>}
            <ErrorBox message={candidates.data?.notice === undefined ? candidates.error : null} />
            <p className="small muted">{candidates.data?.notice}</p>
          </>
        )}
      </Card>

      <Card title={t('Symptômes observés', 'Observed symptoms')} subtitle={t('Déclarez ce que vous constatez : le moteur les croise avec les mesures. Aucun symptôme n’est inventé.', 'Declare what you notice: the engine cross-checks them with measurements. No symptom is invented.')}>
        {symptomList.loading && <Spinner />}
        <div className="grid cols-3">
          {(symptomList.data?.symptoms ?? []).map((symptom) => (
            <label key={symptom.key} className="row small" style={{ margin: 0 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={Boolean(symptoms[symptom.key])}
                onChange={(event) => setSymptoms({ ...symptoms, [symptom.key]: event.target.checked })}
              />
              {locale === 'en' ? symptom.labelEn : symptom.labelFr}
            </label>
          ))}
        </div>
      </Card>

      <Card title={t('Paramètres du scan', 'Scan settings')}>
        <div className="field-row">
          <div>
            <label htmlFor="samples">{t('Nombre d’échantillons par mesure', 'Samples per measurement')}</label>
            <input id="samples" type="number" min={1} max={12} value={samples} onChange={(event) => setSamples(Number(event.target.value))} />
          </div>
          <div>
            <label htmlFor="analysisMode">{t('Type d’analyse', 'Analysis type')}</label>
            <select id="analysisMode" value={analysisMode} onChange={(event) => setAnalysisMode(event.target.value as typeof analysisMode)}>
              <option value="standard">{t('Diagnostic standard', 'Standard diagnosis')}</option>
              <option value="guided">{t('Parcours guidé', 'Guided flow')}</option>
              <option value="inspection">{t('Inspection avant achat', 'Pre-purchase inspection')}</option>
              <option value="second_opinion">{t('Seconde opinion', 'Second opinion')}</option>
              <option value="post_repair">{t('Après réparation', 'After repair')}</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="button primary" disabled={scan.loading} onClick={() => void launch()}>
            {scan.loading ? t('Lecture en cours…', 'Reading…') : t('Lancer le scan', 'Run scan')}
          </button>
          <span className="hint">{t('Un scan échoué n’enregistre rien : aucune donnée n’est fabriquée pour “remplir”.', 'A failed scan stores nothing: no data is fabricated to “fill in”.')}</span>
        </div>
        <ErrorBox message={scan.error} />
      </Card>

      {result && (
        <Card title={t('Résultat du scan', 'Scan result')} subtitle={formatDateTime(result.startedAt, locale)}>
          <div className="grid cols-4">
            <div className="stat">
              <div className="value mono">{result.dtcs.length}</div>
              <div className="label">{t('Codes défaut', 'Fault codes')}</div>
            </div>
            <div className="stat">
              <div className="value mono">{result.readings.filter((reading) => reading.supported).length}</div>
              <div className="label">{t('Mesures disponibles', 'Available readings')}</div>
            </div>
            <div className="stat">
              <div className="value mono">{result.unsupportedPids.length}</div>
              <div className="label">{t('Non disponibles', 'Not available')}</div>
            </div>
            <div className="stat">
              <div className="value mono">{result.milOn ? '⚠️' : '—'}</div>
              <div className="label">{t('Voyant moteur', 'MIL / check engine')}</div>
            </div>
          </div>
          <p className="hint">{result.simulationNotice}</p>
        </Card>
      )}
    </div>
  );
}
