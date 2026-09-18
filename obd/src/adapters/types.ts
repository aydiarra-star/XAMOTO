/**
 * XAMOTO — Couche d'abstraction adaptateur (§7).
 *
 * Architecture imposée par le cahier des charges :
 *
 *   Application → couche OBD → abstraction protocole → moteur de données → moteur de diagnostic
 *
 * Règle absolue : aucune partie de l'application ne parle directement à un
 * modèle d'adaptateur. Tout passe par `ObdAdapter`. Ajouter un adaptateur
 * (ELM327, OBDLink, STN, CAN natif, simulateur…) = implémenter cette interface.
 */
import type { ConnectionKind, DataOrigin, ObdSession, PidKey, Vehicle } from '@xamoto/shared';

export interface AdapterCapabilities {
  readPids: boolean;
  readDtcs: boolean;
  clearDtcs: boolean;
  readFreezeFrame: boolean;
  readVin: boolean;
  multiEcu: boolean;
  /** Le simulateur est signalé explicitement : l'UI l'affiche (§30). */
  isSimulator: boolean;
  protocols: string[];
}

export interface DeviceInfo {
  id: string;
  label: string;
  kind: ConnectionKind;
  model?: string | null;
  firmware?: string | null;
  protocol?: string | null;
  /** Tension lue sur la broche 16 du connecteur — utile avant tout diagnostic. */
  batteryVoltage?: number | null;
}

export interface PidSample {
  key: PidKey;
  obdPid: string;
  label: string;
  value: number | null;
  unit: string;
  supported: boolean;
  origin: DataOrigin;
  capturedAt: string;
  condition?: 'cold' | 'warm' | 'running' | 'idle' | 'unknown';
}

export interface DtcSample {
  code: string;
  status: 'active' | 'pending' | 'permanent' | 'stored';
  occurrences: number;
  lastSeenAt: string;
  freezeFrame?: Record<string, number | string | null>;
  origin: DataOrigin;
}

export interface ScanSnapshot {
  sessionId: string;
  vehicleId: string;
  source: 'obd' | 'simulator';
  protocol: string | null;
  startedAt: string;
  finishedAt: string;
  device: DeviceInfo | null;
  readings: PidSample[];
  dtcs: DtcSample[];
  milOn: boolean;
  /** PID demandés mais non supportés par le véhicule (§8). */
  unsupportedPids: string[];
  warnings: string[];
  notes: Array<{ fr: string; en: string }>;
}

export interface ConnectOptions {
  vehicle?: Partial<Vehicle>;
  /** Durée maximale de la séquence d'acquisition, en ms. */
  timeoutMs?: number;
  /** PID à interroger en priorité. */
  pidKeys?: PidKey[];
  onProgress?: (stage: string, percent: number) => void;
}

export interface ObdAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AdapterCapabilities;
  /** Établit la liaison et négocie le protocole. */
  connect(options?: ConnectOptions): Promise<DeviceInfo>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getDeviceInfo(): DeviceInfo | null;
  /** Lecture des PID supportés puis des PID demandés. */
  readPids(pidKeys?: PidKey[]): Promise<PidSample[]>;
  /** Lecture des DTC. `mode` : 3 = mémorisés, 7 = en cours, 10 = permanents. */
  readDtcs(mode?: 3 | 7 | 10): Promise<DtcSample[]>;
  /** §18 : effacement seulement lorsque c'est pertinent. */
  clearDtcs(): Promise<{ cleared: boolean; noteFr: string; noteEn: string }>;
  readVin?(): Promise<string | null>;
  /** Réalise une session complète et renvoie un instantané exploitable. */
  scan(options?: ConnectOptions): Promise<ScanSnapshot>;
}

/* ─────────────────────────── Transport de bas niveau ─────────────────────── */

/**
 * Un transport sait seulement « envoyer une commande, recevoir une réponse ».
 * Il peut s'agir de Bluetooth SPP, BLE, USB série, Wi-Fi/TCP (ELM327 Wi-Fi),
 * ou d'une passerelle matérielle. Le transport ne connaît PAS le diagnostic.
 */
export interface ObdTransport {
  readonly kind: ConnectionKind;
  readonly label: string;
  open(): Promise<void>;
  close(): Promise<void>;
  isOpen(): boolean;
  /** Envoie une commande et renvoie la réponse brute (chaîne ELM327). */
  request(command: string, timeoutMs?: number): Promise<string>;
}

export type AdapterFactory<T extends ObdAdapter = ObdAdapter> = () => T;

/**
 * Regître d'adaptateurs : découverte + instanciation par identifiant.
 * Permet d'ajouter un adaptateur sans modifier le reste du système (§7).
 */
export class AdapterRegistry {
  private factories = new Map<string, AdapterFactory>();

  register(id: string, factory: AdapterFactory): void {
    this.factories.set(id, factory);
  }

  unregister(id: string): void {
    this.factories.delete(id);
  }

  has(id: string): boolean {
    return this.factories.has(id);
  }

  list(): string[] {
    return [...this.factories.keys()];
  }

  create(id: string): ObdAdapter {
    const factory = this.factories.get(id);
    if (!factory) throw new Error(`Adaptateur inconnu : ${id}. Disponibles : ${this.list().join(', ')}`);
    return factory();
  }
}

/** Regître partagé — les adaptateurs s'y enregistrent à l'import. */
export const adapterRegistry = new AdapterRegistry();

export function sessionId(): string {
  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type { ObdSession };
