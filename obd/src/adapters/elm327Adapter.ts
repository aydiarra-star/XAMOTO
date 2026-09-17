/**
 * XAMOTO — Adaptateur ELM327 générique (§7).
 *
 * Cet adaptateur fonctionne avec toute passerelle qui parle la syntaxe
 * ELM327 / STN (ELM327 v1.x, v2.x, OBDLink, Vgate, adaptateurs Wi-Fi,
 * Bluetooth SPP, USB série…). Le transport est injecté : c'est lui qui sait
 * s'il parle Bluetooth, BLE ou TCP.
 *
 * Aucune dépendance à un modèle précis n'existe dans le code métier.
 */
import type { PidKey } from '@xamoto/shared';
import {
  CORE_PID_KEYS,
  EXTENDED_PID_KEYS,
  PID_BY_KEY,
  PID_DEFINITIONS,
} from '../protocols/pids.js';
import { ELM_INIT_SEQUENCE, parseMode01, parseSupportedPids, protocolFromDpn, extractBytes } from '../protocols/elm327.js';
import { parseDtcResponse } from '../protocols/dtc.js';
import type {
  AdapterCapabilities,
  ConnectOptions,
  DeviceInfo,
  DtcSample,
  ObdAdapter,
  ObdTransport,
  PidSample,
  ScanSnapshot,
} from './types.js';
import { adapterRegistry, sessionId } from './types.js';

export interface Elm327AdapterOptions {
  transport: ObdTransport;
  id?: string;
  name?: string;
  /** Nombre de tentatives par commande (les liaisons Bluetooth sont instables). */
  retries?: number;
}

export class Elm327Adapter implements ObdAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AdapterCapabilities = {
    readPids: true,
    readDtcs: true,
    clearDtcs: true,
    readFreezeFrame: false,
    readVin: true,
    multiEcu: true,
    isSimulator: false,
    protocols: Object.values({
      can11_500: 'ISO 15765-4 CAN (11 bit, 500 kbaud)',
      can29: 'ISO 15765-4 CAN (29 bit, 500 kbaud)',
      iso9141: 'ISO 9141-2',
      kwp: 'ISO 14230-4 KWP',
      j1850: 'SAE J1850',
    }),
  };

  private device: DeviceInfo | null = null;
  private supportedPids = new Set<string>();
  private retries: number;

  constructor(private options: Elm327AdapterOptions) {
    this.id = options.id ?? 'elm327';
    this.name = options.name ?? 'Adaptateur ELM327 compatible';
    this.retries = options.retries ?? 2;
  }

  private get transport(): ObdTransport {
    return this.options.transport;
  }

  async connect(options: ConnectOptions = {}): Promise<DeviceInfo> {
    options.onProgress?.('Ouverture de la liaison', 5);
    await this.transport.open();

    for (const cmd of ELM_INIT_SEQUENCE) {
      await this.request(cmd);
    }
    options.onProgress?.('Protocole négocié', 15);

    const dpn = await this.request('ATDPN').catch(() => '');
    const protocol = protocolFromDpn(dpn);

    const version = await this.request('ATI').catch(() => '');
    const model = /ELM|STN|OBDLINK|VGATE/i.test(version) ? version.trim().split('\n')[0] : null;

    // Tension batterie lue par l'adaptateur (avant tout diagnostic).
    let batteryVoltage: number | null = null;
    try {
      const atrv = await this.request('ATRV');
      const m = /(\d+(?:\.\d+)?)\s*V/i.exec(atrv);
      if (m) batteryVoltage = Number(m[1]);
    } catch {
      batteryVoltage = null;
    }

    this.device = {
      id: this.id,
      label: model ?? this.name,
      kind: this.transport.kind,
      model,
      firmware: version.replace(/[\r\n]+/g, ' ').trim() || null,
      protocol,
      batteryVoltage,
    };

    options.onProgress?.('Lecture des PID supportés', 25);
    this.supportedPids = await this.discoverSupportedPids();
    options.onProgress?.('Prêt', 30);
    return this.device;
  }

  async disconnect(): Promise<void> {
    await this.transport.close();
    this.device = null;
    this.supportedPids.clear();
  }

  isConnected(): boolean {
    return this.transport.isOpen();
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.device;
  }

  private async request(command: string, timeoutMs = 1500): Promise<string> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        return await this.transport.request(command, timeoutMs);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Commande ${command} en échec`);
  }

  private async discoverSupportedPids(): Promise<Set<string>> {
    const masks: Record<string, ReturnType<typeof parseMode01>> = {};
    for (const mask of ['00', '20', '40', '60']) {
      try {
        const raw = await this.request(`01${mask}`);
        masks[mask] = parseMode01(raw, mask);
      } catch {
        // PID non supporté par le véhicule : information essentielle, pas une erreur.
      }
    }
    const supported = parseSupportedPids(masks);
    // Certains véhicules répondent mal aux masques : on garde au moins le noyau.
    return supported.size > 0 ? supported : new Set(PID_DEFINITIONS.map((p) => p.obd));
  }

  async readPids(pidKeys?: PidKey[]): Promise<PidSample[]> {
    const keys = pidKeys ?? [...CORE_PID_KEYS, ...EXTENDED_PID_KEYS];
    const targets = keys
      .map((k) => PID_BY_KEY.get(k))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    const samples: PidSample[] = [];
    const now = new Date().toISOString();

    for (const def of targets) {
      // §8 : distinguer explicitement disponible / non disponible.
      if (!this.supportedPids.has(def.obd)) {
        samples.push({
          key: def.key,
          obdPid: def.obd,
          label: def.labelFr,
          value: null,
          unit: def.unit,
          supported: false,
          origin: 'unknown',
          capturedAt: now,
          condition: def.condition,
        });
        continue;
      }
      try {
        const raw = await this.request(`01${def.obd}`);
        const parsed = parseMode01(raw, def.obd);
        const value = parsed.ok ? def.decode(parsed.bytes) : null;
        samples.push({
          key: def.key,
          obdPid: def.obd,
          label: def.labelFr,
          value,
          unit: def.unit,
          supported: parsed.ok && value !== null,
          origin: parsed.ok && value !== null ? 'measured' : 'unknown',
          capturedAt: now,
          condition: def.condition,
        });
      } catch {
        samples.push({
          key: def.key,
          obdPid: def.obd,
          label: def.labelFr,
          value: null,
          unit: def.unit,
          supported: false,
          origin: 'unknown',
          capturedAt: now,
          condition: def.condition,
        });
      }
    }
    return samples;
  }

  async readDtcs(mode: 3 | 7 | 10 = 3): Promise<DtcSample[]> {
    const modeHex = mode.toString(16).toUpperCase().padStart(2, '0');
    const raw = await this.request(modeHex);
    const codes = parseDtcResponse(raw, mode);
    const now = new Date().toISOString();
    const status = mode === 3 ? 'stored' : mode === 7 ? 'pending' : 'permanent';
    return codes.map((code) => ({
      code,
      status: status as DtcSample['status'],
      occurrences: 1,
      lastSeenAt: now,
      origin: 'measured' as const,
    }));
  }

  async clearDtcs(): Promise<{ cleared: boolean; noteFr: string; noteEn: string }> {
    const raw = await this.request('04');
    const cleared = /44|OK/i.test(raw) && !/NO DATA|ERROR|\?/i.test(raw);
    return {
      cleared,
      noteFr: cleared
        ? 'Les défauts ont été effacés par le calculateur. Un nouveau scan après usage réel du véhicule est nécessaire pour savoir si le problème persiste.'
        : 'L’effacement a été refusé par le calculateur. Les défauts restent mémorisés.',
      noteEn: cleared
        ? 'Faults were cleared by the ECU. A new scan after real driving is required to know whether the issue persists.'
        : 'The ECU refused the clear request. Faults remain stored.',
    };
  }

  async readVin(): Promise<string | null> {
    try {
      const raw = await this.request('0902');
      const bytes = extractBytes(raw);
      const text = bytes
        .filter((b) => b >= 0x20 && b < 0x7f)
        .map((b) => String.fromCharCode(b))
        .join('');
      return text.length >= 17 ? text.slice(0, 17) : null;
    } catch {
      // Tous les véhicules ne savent pas donner le VIN par OBD (§8).
      return null;
    }
  }

  async scan(options: ConnectOptions = {}): Promise<ScanSnapshot> {
    const startedAt = new Date().toISOString();
    const id = sessionId();
    const warnings: string[] = [];
    const notes: Array<{ fr: string; en: string }> = [];

    if (!this.isConnected()) await this.connect(options);

    options.onProgress?.('Lecture des mesures', 45);
    const readings = await this.readPids(options.pidKeys);

    const unsupported = readings.filter((r) => !r.supported).map((r) => r.key);
    if (unsupported.length > 0) {
      notes.push({
        fr: `${unsupported.length} mesure(s) non disponible(s) sur ce véhicule. XAMOTO les traitera comme « non disponibles » et non comme des valeurs normales.`,
        en: `${unsupported.length} measurement(s) not available on this vehicle. XAMOTO will treat them as "not available", never as normal values.`,
      });
    }

    options.onProgress?.('Lecture des codes défaut', 70);
    let dtcs: DtcSample[] = [];
    for (const mode of [3, 7, 10] as const) {
      try {
        const found = await this.readDtcs(mode);
        dtcs = [...dtcs, ...found];
      } catch (err) {
        warnings.push(`Lecture du mode ${mode.toString(16).toUpperCase()} impossible : ${(err as Error).message}`);
      }
    }
    // Dédoublonnage : un code permanent et mémorisé ne compte qu'une fois,
    // avec le statut le plus significatif.
    const byCode = new Map<string, DtcSample>();
    for (const dtc of dtcs) {
      const existing = byCode.get(dtc.code);
      if (!existing || existing.status === 'stored') byCode.set(dtc.code, dtc);
    }
    const merged = [...byCode.values()];

    // État du voyant (PID 01, octet A bit 7).
    let milOn = false;
    try {
      const raw = await this.request('0101');
      const parsed = parseMode01(raw, '01');
      if (parsed.ok && parsed.bytes.length > 0) {
        milOn = ((parsed.bytes[0] as number) & 0x80) !== 0;
      }
    } catch {
      milOn = merged.length > 0;
      warnings.push('État du voyant non lisible : déduit de la présence de défauts.');
    }

    options.onProgress?.('Scan terminé', 100);

    return {
      sessionId: id,
      vehicleId: options.vehicle?.id ?? 'unknown',
      source: 'obd',
      protocol: this.device?.protocol ?? null,
      startedAt,
      finishedAt: new Date().toISOString(),
      device: this.device,
      readings,
      dtcs: merged,
      milOn,
      unsupportedPids: unsupported,
      warnings,
      notes,
    };
  }
}

adapterRegistry.register('elm327', () => {
  throw new Error('Elm327Adapter nécessite un transport : utilisez new Elm327Adapter({ transport }).');
});
adapterRegistry.register('bluetooth-spp', () => {
  throw new Error('Transport Bluetooth SPP à fournir : new BluetoothTransport({ address, kind: \'spp\' }).');
});
adapterRegistry.register('ble', () => {
  throw new Error('Transport Bluetooth BLE à fournir : new BluetoothTransport({ address, kind: \'ble\' }).');
});
