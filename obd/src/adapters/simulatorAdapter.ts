/**
 * XAMOTO — Adaptateur simulateur (§30).
 *
 * Il implémente exactement la même interface qu'un adaptateur réel : le reste
 * de XAMOTO (moteur de données, moteur de diagnostic, IA, UI) ne sait donc
 * jamais s'il parle à une voiture ou à une simulation — SAUF par le champ
 * `source: 'simulator'` et l'origine `simulated`, qui doivent être affichés.
 *
 * §47-2 : « Ne jamais présenter une simulation comme une donnée réelle. »
 */
import type { PidKey, DataOrigin } from '@xamoto/shared';
import { PID_BY_KEY } from '../protocols/pids.js';
import { ObdSimulator, SCENARIOS, type SimulationScenarioId, type SimulatedState } from '../simulator/scenarios.js';
import type {
  AdapterCapabilities,
  ConnectOptions,
  DeviceInfo,
  DtcSample,
  ObdAdapter,
  PidSample,
  ScanSnapshot,
} from './types.js';
import { adapterRegistry, sessionId } from './types.js';

export interface SimulatorAdapterOptions {
  scenario?: SimulationScenarioId;
  seed?: number;
  /** Pas de simulation entre deux appels, en secondes. */
  stepSeconds?: number;
  /** Étiquette affichée dans l'interface. */
  label?: string;
}

export class SimulatorAdapter implements ObdAdapter {
  readonly id = 'simulator';
  readonly name = 'Simulateur OBD XAMOTO';
  readonly capabilities: AdapterCapabilities = {
    readPids: true,
    readDtcs: true,
    clearDtcs: true,
    readFreezeFrame: true,
    readVin: true,
    multiEcu: false,
    isSimulator: true,
    protocols: ['ISO 15765-4 CAN (11 bit, 500 kbaud) — simulé'],
  };

  private sim: ObdSimulator;
  private device: DeviceInfo | null = null;
  private state: SimulatedState | null = null;
  private stepSeconds: number;
  private label: string;

  constructor(options: SimulatorAdapterOptions = {}) {
    this.sim = new ObdSimulator(options.scenario ?? 'normal_engine', options.seed ?? 42);
    this.stepSeconds = options.stepSeconds ?? 5;
    this.label = options.label ?? 'Simulateur OBD XAMOTO';
  }

  get scenario() {
    return this.sim.scenario;
  }

  /** Change de scénario (utilisé par le mode démo §31). */
  setScenario(scenario: SimulationScenarioId, seed = 42): void {
    this.sim = new ObdSimulator(scenario, seed);
    this.state = null;
  }

  async connect(options: ConnectOptions = {}): Promise<DeviceInfo> {
    options.onProgress?.('Initialisation du simulateur', 20);
    this.state = this.sim.tick(0);
    this.device = {
      id: `sim-${this.sim.scenario.id}`,
      label: `${this.label} — ${this.sim.scenario.labelFr}`,
      kind: 'simulator',
      model: 'XAMOTO Simulator v1',
      firmware: 'sim-1.0.0',
      protocol: 'ISO 15765-4 CAN (11 bit, 500 kbaud) — simulé',
      batteryVoltage: this.readingValue('battery_voltage'),
    };
    options.onProgress?.('Simulateur prêt (MODE SIMULATION)', 30);
    return this.device;
  }

  async disconnect(): Promise<void> {
    this.device = null;
  }

  isConnected(): boolean {
    return this.device !== null;
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.device;
  }

  private ensureState(): SimulatedState {
    if (!this.state) this.state = this.sim.tick(0);
    return this.state;
  }

  private readingValue(key: PidKey): number | null {
    return this.ensureState().readings.find((r) => r.key === key)?.value ?? null;
  }

  async readPids(pidKeys?: PidKey[]): Promise<PidSample[]> {
    const state = this.ensureState();
    const wanted = pidKeys ? new Set(pidKeys) : null;
    return state.readings
      .filter((r) => (wanted ? wanted.has(r.key) : true))
      .map((r) => {
        const def = PID_BY_KEY.get(r.key);
        return {
          key: r.key,
          obdPid: def?.obd ?? '--',
          label: def?.labelFr ?? r.key,
          value: r.value,
          unit: def?.unit ?? '',
          supported: r.supported,
          // §33 : origine toujours « simulé ».
          origin: (r.supported ? 'simulated' : 'unknown') as DataOrigin,
          capturedAt: new Date().toISOString(),
          condition: def?.condition ?? 'unknown',
        };
      });
  }

  async readDtcs(mode: 3 | 7 | 10 = 3): Promise<DtcSample[]> {
    const state = this.ensureState();
    const wanted: Array<DtcSample['status']> = mode === 3 ? ['stored', 'active'] : mode === 7 ? ['pending'] : ['permanent'];
    return state.dtcCodes
      .filter((d) => wanted.includes(d.status))
      .map((d) => ({
        code: d.code,
        status: d.status,
        occurrences: d.occurrences,
        lastSeenAt: new Date().toISOString(),
        freezeFrame: d.freezeFrame,
        origin: 'simulated' as const,
      }));
  }

  async clearDtcs(): Promise<{ cleared: boolean; noteFr: string; noteEn: string }> {
    // En simulation, l'effacement n'agit pas sur le scénario : c'est justement
    // ce qui permet de démontrer la fonction « le défaut est revenu » (§19).
    return {
      cleared: true,
      noteFr:
        'MODE SIMULATION : l’effacement est simulé. Le scénario continue de produire le défaut afin de démontrer le comportement réel d’un code qui revient.',
      noteEn:
        'SIMULATION MODE: clearing is simulated. The scenario keeps producing the fault in order to demonstrate a code that comes back.',
    };
  }

  async readVin(): Promise<string | null> {
    return this.sim.scenario.demoVehicle.vin ?? null;
  }

  async scan(options: ConnectOptions = {}): Promise<ScanSnapshot> {
    const startedAt = new Date().toISOString();
    if (!this.device) await this.connect(options);
    // Avance la simulation : les valeurs évoluent comme sur un vrai véhicule.
    this.state = this.sim.tick(this.stepSeconds);

    options.onProgress?.('Lecture des mesures simulées', 45);
    const readings = await this.readPids(options.pidKeys);

    options.onProgress?.('Lecture des codes défaut simulés', 75);
    const dtcs = [...(await this.readDtcs(3)), ...(await this.readDtcs(7)), ...(await this.readDtcs(10))];
    const merged = [...new Map(dtcs.map((d) => [d.code, d])).values()];
    const mil = this.sim.milStatus(this.ensureState());

    const unsupported = readings.filter((r) => !r.supported).map((r) => r.key);
    options.onProgress?.('Scan simulé terminé', 100);

    return {
      sessionId: sessionId(),
      vehicleId: options.vehicle?.id ?? 'demo-vehicle',
      source: 'simulator',
      protocol: 'ISO 15765-4 CAN — simulé',
      startedAt,
      finishedAt: new Date().toISOString(),
      device: this.device,
      readings,
      dtcs: merged,
      milOn: mil.milOn,
      unsupportedPids: unsupported,
      warnings: [],
      notes: [
        {
          fr: `MODE SIMULATION — scénario « ${this.sim.scenario.labelFr} ». ${this.sim.scenario.descriptionFr} Aucune donnée ne provient d’un véhicule réel.`,
          en: `SIMULATION MODE — scenario "${this.sim.scenario.labelEn}". ${this.sim.scenario.descriptionEn} No data comes from a real vehicle.`,
        },
        ...(mil.flashing
          ? [
              {
                fr: 'Le voyant moteur clignote dans ce scénario : c’est le signal conventionnel d’un risque pour le catalyseur et d’un arrêt immédiat recommandé.',
                en: 'The check-engine light is flashing in this scenario: the conventional signal of catalyst risk and an immediate stop recommendation.',
              },
            ]
          : []),
      ],
    };
  }
}

adapterRegistry.register('simulator', () => new SimulatorAdapter());
export { SCENARIOS };
