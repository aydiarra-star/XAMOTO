/**
 * XAMOTO — Faux pilote Bluetooth pour les tests.
 *
 * Il ne simule pas un véhicule : il simule **un pont Bluetooth** qui transmet
 * des trames ELM327, exactement comme le ferait un boîtier appairé. Les tests
 * peuvent donc vérifier le transport (écho, marqueur `>`, délais, erreurs) sans
 * aucun matériel, et sans jamais confondre ce pont avec un véhicule.
 */
import type { BluetoothDevice, BluetoothDriver, BluetoothLink, BluetoothLinkKind } from '@xamoto/obd';

export interface FakeDeviceSpec {
  address: string;
  name: string;
  kind?: BluetoothLinkKind;
  paired?: boolean;
  rssi?: number | null;
  services?: string[];
}

/** Réponses d'un ELM327 réel, telles qu'on les observe sur une liaison série. */
export const ELM327_REPLIES: Record<string, string> = {
  ATZ: 'ELM327 v1.5',
  ATE0: 'OK',
  ATL0: 'OK',
  ATS0: 'OK',
  ATSP0: 'OK',
  ATDPN: 'A6',
  ATI: 'ELM327 v1.5',
  ATRV: '12.6V',
  '0100': '41 00 BE 3E B8 13',
  '0120': '41 20 80 00 00 00',
  '0140': '41 40 00 00 00 00',
  '0160': 'NO DATA',
  '0101': '41 01 82 07 61 00',
  '0105': '41 05 7B',
  '010C': '41 0C 0C 80',
  '0111': '41 11 32',
  '0142': '41 42 0D AC',
  '03': '43 01 04 20 00 00',
  '07': '47 00',
  '0A': '4A 00',
};

export interface FakeLinkOptions {
  replies?: Record<string, string>;
  /** Délai simulé avant chaque réponse (ms). */
  latencyMs?: number;
  /** Renvoient l'écho de la commande, comme un ELM327 non configuré. */
  echo?: boolean;
  /** Aucune réponse n'est envoyée : la liaison reste muette. */
  silent?: boolean;
}

export class FakeBluetoothLink implements BluetoothLink {
  private handlers: Array<(chunk: string) => void> = [];
  private open_ = true;
  readonly received: string[] = [];

  constructor(private options: FakeLinkOptions = {}) {}

  write(data: string): void {
    if (!this.open_) throw new Error('Liaison fermée');
    const command = data.replace(/\r/g, '').trim();
    this.received.push(command);
    if (this.options.silent) return;

    const reply = this.options.replies?.[command.toUpperCase()] ?? this.options.replies?.[command] ?? 'NO DATA';
    const echo = this.options.echo === false ? '' : `${command}\r`;
    const payload = `${echo}${reply}\r>`;
    const latency = this.options.latencyMs ?? 1;
    setTimeout(() => {
      if (this.open_) for (const handler of this.handlers) handler(payload);
    }, latency).unref?.();
  }

  onData(handler: (chunk: string) => void): void {
    this.handlers.push(handler);
  }

  async close(): Promise<void> {
    this.open_ = false;
    this.handlers = [];
  }

  isOpen(): boolean {
    return this.open_;
  }

  /** Envoie un fragment brut (utile pour tester les réponses découpées). */
  emit(chunk: string): void {
    for (const handler of this.handlers) handler(chunk);
  }
}

export class FakeBluetoothDriver implements BluetoothDriver {
  readonly id: string;
  readonly label: string;
  readonly kinds: BluetoothLinkKind[] = ['spp', 'ble'];
  devices: BluetoothDevice[];
  /** Adresses dont l'ouverture doit échouer, pour tester les erreurs. */
  failOpen: string[] = [];
  lastLink: FakeBluetoothLink | null = null;
  listCalls = 0;
  listError: Error | null = null;

  constructor(
    options: {
      id?: string;
      label?: string;
      devices?: FakeDeviceSpec[];
      /** Pilote « non disponible » : ni matériel, ni permission. */
      available?: boolean;
      link?: FakeLinkOptions;
    } = {},
  ) {
    this.id = options.id ?? 'fake-bluetooth';
    this.label = options.label ?? 'Pilote Bluetooth de test';
    this.available_ = options.available ?? true;
    this.linkOptions = options.link ?? {};
    this.devices = (options.devices ?? [
      { address: 'AA:BB:CC:11:22:33', name: 'ELM327 v1.5', kind: 'spp', paired: true },
      { address: 'AA:BB:CC:44:55:66', name: 'Vgate iCar Pro', kind: 'ble', paired: true, rssi: -62, services: ['0000fff0-0000-1000-8000-00805f9b34fb'] },
      { address: 'AA:BB:CC:77:88:99', name: 'Enceinte JBL', kind: 'ble', paired: true, rssi: -80 },
    ]).map((spec) => ({
      address: spec.address,
      name: spec.name,
      kind: spec.kind ?? 'spp',
      paired: spec.paired ?? true,
      rssi: spec.rssi ?? null,
      services: spec.services ?? [],
      likelyObdAdapter: false,
      reasonFr: '',
      reasonEn: '',
    }));
  }

  private available_: boolean;
  private linkOptions: FakeLinkOptions;

  available(): boolean {
    return this.available_;
  }

  async list(): Promise<BluetoothDevice[]> {
    this.listCalls += 1;
    if (this.listError) throw this.listError;
    return this.devices;
  }

  async open(address: string): Promise<BluetoothLink> {
    if (this.failOpen.includes(address)) throw new Error('appareil hors de portée');
    this.lastLink = new FakeBluetoothLink(this.linkOptions);
    return this.lastLink;
  }
}
