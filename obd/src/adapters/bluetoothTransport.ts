/**
 * XAMOTO — Transport Bluetooth (SPP et BLE) (§7, §29, §30, §47).
 *
 * Principe §7 : l'application ne parle JAMAIS à un modèle d'adaptateur. Elle
 * parle à un `ObdTransport`. Ce fichier apporte le transport Bluetooth, sans
 * ajouter la moindre dépendance : Node.js ne sait pas parler Bluetooth seul, et
 * la plateforme (application mobile Flutter, poste de travail avec un pont
 * série, Web Bluetooth) fournit un **pilote**.
 *
 *   Application → couche OBD → BluetoothTransport → pilote de plateforme → adaptateur ELM327
 *
 * Deux conséquences volontaires :
 *
 * 1. Aucun matériel n'est inventé. Si aucun pilote n'est enregistré,
 *    `listBluetoothDevices()` renvoie `available: false` et une liste vide, avec
 *    la raison — jamais une liste plausible (§47-1).
 * 2. Un appareil dont le nom ressemble à un adaptateur OBD est signalé comme
 *    « probable », avec le motif. XAMOTO ne déclare jamais qu'un boîtier
 *    fonctionne avant que l'adaptateur ELM327 ne l'ait confirmé (ATZ/ATI/ATDPN).
 */
import type { ConnectionKind } from '@xamoto/shared';
import type { ObdTransport } from './types.js';

/* ────────────────────────────── Erreurs typées ───────────────────────────── */

/** Aucun pilote Bluetooth n'est utilisable sur cette plateforme. */
export class BluetoothUnavailableError extends Error {
  readonly hintFr: string;
  readonly hintEn: string;
  constructor(message = 'Aucun pilote Bluetooth n’est disponible sur cet appareil.') {
    super(message);
    this.name = 'BluetoothUnavailableError';
    this.hintFr =
      'Le web n’expose pas le Bluetooth SPP. Sur téléphone, utilisez l’application XAMOTO (Flutter) qui fournit les pilotes SPP et BLE. Sur poste de travail, enregistrez un pilote série (par ex. createSerialBluetoothDriver avec « serialport »).';
    this.hintEn =
      'The web does not expose Bluetooth SPP. On a phone, use the XAMOTO app (Flutter), which provides the SPP and BLE drivers. On a workstation, register a serial driver (e.g. createSerialBluetoothDriver with "serialport").';
  }
}

/** L'appareil demandé n'a pas été trouvé (ou n'est plus appairé). */
export class BluetoothDeviceNotFoundError extends Error {
  constructor(address: string) {
    super(`Appareil Bluetooth introuvable : ${address}. Vérifiez qu’il est allumé, appairé et à portée.`);
    this.name = 'BluetoothDeviceNotFoundError';
  }
}

/** La liaison Bluetooth s'est ouverte puis a échoué. */
export class BluetoothLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BluetoothLinkError';
  }
}

/* ─────────────────────────── Appareils et pilotes ────────────────────────── */

export type BluetoothLinkKind = 'spp' | 'ble';

export interface BluetoothDevice {
  /** Adresse MAC (SPP) ou identifiant d'appareil (BLE : souvent un UUID). */
  address: string;
  /** Nom annoncé par l'appareil. Peut être vide : on ne l'invente pas. */
  name: string;
  kind: BluetoothLinkKind;
  paired: boolean;
  /** Puissance du signal si le pilote la fournit (négatif, en dBm). */
  rssi?: number | null;
  /** Services annoncés (BLE) — utile pour reconnaître un pont OBD. */
  services?: string[];
  /** Le nom ou les services évoquent un adaptateur OBD. Jamais une certitude. */
  likelyObdAdapter: boolean;
  reasonFr: string;
  reasonEn: string;
}

/** Liaison ouverte par un pilote : un tube de texte, rien de plus. */
export interface BluetoothLink {
  write(data: string): Promise<void> | void;
  /** Le pilote pousse les octets reçus au fur et à mesure. */
  onData(handler: (chunk: string) => void): void;
  close(): Promise<void> | void;
  isOpen(): boolean;
}

export interface BluetoothDriver {
  readonly id: string;
  readonly label: string;
  /** Types de liaisons que ce pilote sait ouvrir. */
  readonly kinds: BluetoothLinkKind[];
  /** Le pilote est-il utilisable maintenant (permission, matériel, module) ? */
  available(): boolean;
  list(options?: { timeoutMs?: number; onProgress?: (step: string, percent: number) => void }): Promise<BluetoothDevice[]>;
  open(
    address: string,
    options: { kind: BluetoothLinkKind; serviceUuid?: string; timeoutMs?: number },
  ): Promise<BluetoothLink>;
}

/** UUID standard du profil SPP (Serial Port Profile) — utilisé par les ELM327 « classiques ». */
export const BLUETOOTH_SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb';

/**
 * Services BLE annoncés par la majorité des adaptateurs ELM327 BLE.
 * Ces valeurs sont documentées et publiques ; elles ne garantissent pas qu'un
 * boîtier parle le protocole OBD, seulement qu'il en a la forme.
 */
export const COMMON_ELM327_BLE_SERVICES = [
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ff01-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
] as const;

/** Noms de modèles fréquemment rencontrés. Une correspondance reste une présomption. */
export const KNOWN_OBD_NAME_PATTERNS: RegExp[] = [
  /ELM\s?327/i,
  /\bOBD\s?II\b/i,
  /\bOBD2\b/i,
  /\bOBD\b/i,
  /VGATE/i,
  /V-?LINK/i,
  /KONNWEI/i,
  /OBDLINK/i,
  /\bSTN\d/i,
  /VEEPEAK/i,
  /\bICAR\b/i,
  /MINI\s?OBD/i,
  /AUTODIA/i,
  /\bXAMOTO\b/i,
];

/**
 * Décrit un appareil à partir de ce qu'il annonce. Le résultat distingue
 * clairement ce qui est observé (le nom, les services) de ce qui est supposé
 * (l'appareil parle OBD et fonctionnera).
 */
export function describeBluetoothDevice(input: {
  name: string;
  kind: BluetoothLinkKind;
  services?: string[];
}): { likelyObdAdapter: boolean; reasonFr: string; reasonEn: string } {
  const name = input.name.trim();
  const services = (input.services ?? []).map((s) => s.toLowerCase());
  const nameMatch = name ? KNOWN_OBD_NAME_PATTERNS.find((pattern) => pattern.test(name)) : undefined;
  const serviceMatch = services.find((s) => (COMMON_ELM327_BLE_SERVICES as readonly string[]).includes(s));
  const named = nameMatch ? nameMatch.source.replace(/\\/g, '') : null;

  if (nameMatch && serviceMatch) {
    return {
      likelyObdAdapter: true,
      reasonFr: `Le nom « ${name} » et le service BLE ${serviceMatch} correspondent à un adaptateur OBD courant. À confirmer par un test de liaison (ATZ / ATI).`,
      reasonEn: `Name "${name}" and BLE service ${serviceMatch} match a common OBD adapter. To be confirmed by a link test (ATZ / ATI).`,
    };
  }
  if (nameMatch) {
    return {
      likelyObdAdapter: true,
      reasonFr: `Le nom « ${name} » correspond au modèle d’un adaptateur OBD connu (motif « ${named} »). XAMOTO ne le déclare compatible qu’après un test de liaison (ATZ / ATI).`,
      reasonEn: `Name "${name}" matches a known OBD adapter model (pattern "${named}"). XAMOTO only declares it compatible after a link test (ATZ / ATI).`,
    };
  }
  if (serviceMatch) {
    return {
      likelyObdAdapter: true,
      reasonFr: `Le service BLE ${serviceMatch} est un service utilisé par des adaptateurs OBD. Le nom, lui, n’est pas parlant : cela reste une présomption.`,
      reasonEn: `BLE service ${serviceMatch} is used by OBD adapters. The name itself is not meaningful: this remains an assumption.`,
    };
  }
  return {
    likelyObdAdapter: false,
    reasonFr: name
      ? `L’appareil s’appelle « ${name} » : rien n’indique un adaptateur OBD. XAMOTO ne le filtrera pas, mais ne le recommandera pas non plus.`
      : 'L’appareil ne communique aucun nom : XAMOTO n’invente pas de description à partir d’une adresse.',
    reasonEn: name
      ? `The device is named "${name}": nothing indicates an OBD adapter. XAMOTO will not filter it out, but will not recommend it either.`
      : 'The device provides no name: XAMOTO does not invent a description from an address.',
  };
}

/* ───────────────────────────── Registre de pilotes ──────────────────────── */

const drivers = new Map<string, BluetoothDriver>();

export function registerBluetoothDriver(driver: BluetoothDriver): void {
  drivers.set(driver.id, driver);
}

export function unregisterBluetoothDriver(id: string): boolean {
  return drivers.delete(id);
}

export function listBluetoothDrivers(): BluetoothDriver[] {
  return [...drivers.values()];
}

export function availableBluetoothDrivers(): BluetoothDriver[] {
  return [...drivers.values()].filter((driver) => {
    try {
      return driver.available();
    } catch {
      return false;
    }
  });
}

export interface BluetoothAvailability {
  available: boolean;
  drivers: Array<{ id: string; label: string; kinds: BluetoothLinkKind[]; available: boolean }>;
  noticeFr: string;
  noticeEn: string;
  hintFr?: string;
  hintEn?: string;
}

/**
 * État réel du Bluetooth sur cette plateforme. Sur le web ou sur un serveur
 * sans pilote, `available` vaut `false` et XAMOTO le dit — l'interface mobile
 * reste la voie normale pour le Bluetooth SPP.
 */
export function bluetoothAvailability(): BluetoothAvailability {
  const all = listBluetoothDrivers();
  const usable = availableBluetoothDrivers();
  const available = usable.length > 0;
  const status: BluetoothAvailability = {
    available,
    drivers: all.map((driver) => ({
      id: driver.id,
      label: driver.label,
      kinds: [...driver.kinds],
      available: usable.some((d) => d.id === driver.id),
    })),
    noticeFr: available
      ? `Bluetooth prêt : ${usable.map((d) => d.label).join(', ')}.`
      : 'Bluetooth indisponible ici : aucun pilote n’est enregistré sur cette plateforme. XAMOTO n’affichera aucune liste d’appareils inventée.',
    noticeEn: available
      ? `Bluetooth ready: ${usable.map((d) => d.label).join(', ')}.`
      : 'Bluetooth unavailable here: no driver is registered on this platform. XAMOTO will not display an invented device list.',
  };
  if (!available) {
    const error = new BluetoothUnavailableError();
    status.hintFr = error.hintFr;
    status.hintEn = error.hintEn;
  }
  return status;
}

/**
 * Liste les appareils proposés par tous les pilotes disponibles.
 * Dédupliqué par adresse, les adaptateurs OBD probables en tête, puis les
 * appareils appairés, puis le signal le plus fort.
 */
export async function listBluetoothDevices(options: {
  timeoutMs?: number;
  onProgress?: (step: string, percent: number) => void;
  /** Filtrer sur un type de liaison. */
  kind?: BluetoothLinkKind;
} = {}): Promise<BluetoothDevice[]> {
  const usable = availableBluetoothDrivers().filter((driver) => !options.kind || driver.kinds.includes(options.kind));
  if (usable.length === 0) return [];

  const settled = await Promise.all(
    usable.map(async (driver) => {
      try {
        options.onProgress?.(`Recherche via ${driver.label}`, 20);
        return await driver.list({ timeoutMs: options.timeoutMs, onProgress: options.onProgress });
      } catch {
        // Un pilote qui échoue ne doit pas masquer les autres, et ne doit pas
        // produire d'appareil fictif.
        return [] as BluetoothDevice[];
      }
    }),
  );

  const byAddress = new Map<string, BluetoothDevice>();
  for (const device of settled.flat()) {
    const key = device.address.toLowerCase();
    const existing = byAddress.get(key);
    if (!existing) {
      byAddress.set(key, device);
      continue;
    }
    // Même appareil vu par deux pilotes : on conserve la description la plus
    // riche, et on privilégie SPP (plus rapide et plus stable pour l'OBD).
    const better =
      (device.kind === 'spp' && existing.kind !== 'spp') ||
      (device.kind === existing.kind && device.name.length > existing.name.length);
    if (better) byAddress.set(key, { ...device, paired: device.paired || existing.paired });
    else byAddress.set(key, { ...existing, paired: existing.paired || device.paired });
  }

  const devices = [...byAddress.values()].filter((device) => !options.kind || device.kind === options.kind);
  return devices.sort(compareDevices);
}

/** Ordre d'affichage : OBD probable, puis appairé, puis signal, puis nom. */
export function compareDevices(a: BluetoothDevice, b: BluetoothDevice): number {
  if (a.likelyObdAdapter !== b.likelyObdAdapter) return a.likelyObdAdapter ? -1 : 1;
  if (a.paired !== b.paired) return a.paired ? -1 : 1;
  const rssiA = a.rssi ?? -999;
  const rssiB = b.rssi ?? -999;
  if (rssiA !== rssiB) return rssiB - rssiA;
  return a.name.localeCompare(b.name, 'fr');
}

/* ─────────────────────────── Pilote série (SPP) ─────────────────────────── */

export interface SerialPortLike {
  write(data: string): void;
  close(): Promise<void> | void;
  isOpen(): boolean;
  on(event: 'data', handler: (chunk: string) => void): void;
}

/**
 * Pilote pour les hôtes qui disposent d'un pont série vers le Bluetooth SPP
 * (`/dev/rfcomm0` sous Linux, `COM5` sous Windows, via le paquet `serialport`).
 *
 * XAMOTO ne dépend pas de `serialport` : la fonction d'ouverture est injectée.
 * Le paquet n'est donc pas requis pour compiler ni pour tester.
 */
export function createSerialBluetoothDriver(config: {
  id?: string;
  label?: string;
  baudRate?: number;
  list: () => Promise<Array<{ path: string; name?: string; paired?: boolean }>>;
  open: (path: string, options: { baudRate: number }) => Promise<SerialPortLike>;
}): BluetoothDriver {
  const baudRate = config.baudRate ?? 38400;
  return {
    id: config.id ?? 'serial-spp',
    label: config.label ?? 'Bluetooth SPP (pont série)',
    kinds: ['spp'],
    available: () => true,
    async list() {
      const ports = await config.list();
      return ports.map((port) => {
        const name = port.name ?? '';
        const description = describeBluetoothDevice({ name, kind: 'spp' });
        return {
          address: port.path,
          name: name || port.path,
          kind: 'spp' as const,
          paired: port.paired ?? true,
          likelyObdAdapter: description.likelyObdAdapter,
          reasonFr: description.reasonFr,
          reasonEn: description.reasonEn,
        };
      });
    },
    async open(address) {
      const port = await config.open(address, { baudRate });
      return {
        write: (data: string) => port.write(data),
        onData: (handler: (chunk: string) => void) => port.on('data', handler),
        close: () => port.close(),
        isOpen: () => port.isOpen(),
      };
    },
  };
}

/* ──────────────────────────── Transport Bluetooth ───────────────────────── */

export interface BluetoothTransportOptions {
  /** Adresse MAC (SPP) ou identifiant (BLE) de l'adaptateur. */
  address: string;
  /** Nom affiché ; à défaut, l'adresse est utilisée telle quelle. */
  name?: string;
  kind?: BluetoothLinkKind;
  /** Pilote imposé. À défaut, le premier pilote disponible du bon type. */
  driverId?: string;
  serviceUuid?: string;
  /** Délai par commande (le Bluetooth est plus lent que le Wi-Fi). */
  timeoutMs?: number;
  /** Délai d'ouverture de la liaison. */
  openTimeoutMs?: number;
  onProgress?: (step: string, percent: number) => void;
}

export class BluetoothTransport implements ObdTransport {
  readonly kind: ConnectionKind;
  readonly label: string;

  private link: BluetoothLink | null = null;
  private buffer = '';
  private pending: {
    command: string;
    resolve: (value: string) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  } | null = null;
  private readonly options: BluetoothTransportOptions;
  private readonly linkKind: BluetoothLinkKind;
  private readonly timeoutMs: number;
  private readonly openTimeoutMs: number;

  constructor(options: BluetoothTransportOptions) {
    this.options = options;
    this.linkKind = options.kind ?? 'spp';
    this.kind = this.linkKind === 'ble' ? 'ble' : 'bluetooth';
    this.timeoutMs = options.timeoutMs ?? 3000;
    this.openTimeoutMs = options.openTimeoutMs ?? 8000;
    this.label = `ELM327 ${this.linkKind === 'ble' ? 'BLE' : 'Bluetooth'} — ${options.name ?? options.address}`;
  }

  private pickDriver(): BluetoothDriver {
    if (this.options.driverId) {
      const wanted = listBluetoothDrivers().find((driver) => driver.id === this.options.driverId);
      if (!wanted) {
        throw new BluetoothUnavailableError(`Aucun pilote Bluetooth nommé « ${this.options.driverId} » n’est enregistré.`);
      }
      if (!wanted.kinds.includes(this.linkKind)) {
        throw new BluetoothUnavailableError(
          `Le pilote « ${wanted.id} » ne sait pas ouvrir de liaison ${this.linkKind.toUpperCase()} (types pris en charge : ${wanted.kinds.join(', ')}).`,
        );
      }
      if (!wanted.available()) {
        throw new BluetoothUnavailableError(
          `Le pilote Bluetooth « ${wanted.id} » n’est pas disponible pour une liaison ${this.linkKind.toUpperCase()} : matériel absent, désactivé, ou permission refusée.`,
        );
      }
      return wanted;
    }
    const first = availableBluetoothDrivers().find((driver) => driver.kinds.includes(this.linkKind));
    if (first) return first;

    // Des pilotes existent peut-être mais sont hors service : le dire évite à
    // l'utilisateur de chercher un problème qui n'existe pas.
    const known = listBluetoothDrivers().filter((driver) => driver.kinds.includes(this.linkKind));
    if (known.length > 0) {
      throw new BluetoothUnavailableError(
        `Pilote(s) Bluetooth enregistré(s) mais indisponible(s) pour une liaison ${this.linkKind.toUpperCase()} : ${known.map((d) => d.id).join(', ')}. Le matériel est absent ou désactivé, ou la permission a été refusée.`,
      );
    }
    throw new BluetoothUnavailableError();
  }

  async open(): Promise<void> {
    if (this.link) return;
    const driver = this.pickDriver();
    this.options.onProgress?.(`Ouverture de la liaison ${this.linkKind.toUpperCase()}`, 10);

    const opening = driver.open(this.options.address, {
      kind: this.linkKind,
      serviceUuid: this.options.serviceUuid,
      timeoutMs: this.openTimeoutMs,
    });
    const timeout = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new BluetoothLinkError(`L’appareil ${this.options.address} n’a pas répondu dans le délai imparti (${this.openTimeoutMs} ms).`)), this.openTimeoutMs);
    });

    try {
      const link = await Promise.race([opening, timeout]);
      link.onData((chunk) => this.onData(chunk));
      this.link = link;
      this.options.onProgress?.('Liaison Bluetooth ouverte', 20);
    } catch (error) {
      if (error instanceof BluetoothUnavailableError || error instanceof BluetoothLinkError) throw error;
      throw new BluetoothLinkError(
        `Liaison Bluetooth impossible avec ${this.options.address} (${(error as Error).message}). Vérifiez que l’appareil est allumé, appairé et à portée.`,
      );
    }
  }

  async close(): Promise<void> {
    const link = this.link;
    this.link = null;
    this.buffer = '';
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new BluetoothLinkError('Liaison Bluetooth fermée avant la réponse de l’adaptateur.'));
      this.pending = null;
    }
    if (link) await link.close();
  }

  isOpen(): boolean {
    return this.link !== null && this.link.isOpen();
  }

  /**
   * Envoie une commande ELM327 et attend le marqueur de fin de réponse `>`.
   * Les liaisons Bluetooth renvoient souvent l'écho de la commande : il est
   * retiré, car il ne fait pas partie de la réponse.
   */
  request(command: string, timeoutMs = this.timeoutMs): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this.link) {
        reject(new BluetoothLinkError('Liaison Bluetooth fermée : appelez open() avant toute commande.'));
        return;
      }
      const previous = this.pending;
      if (previous) {
        clearTimeout(previous.timer);
        previous.reject(new BluetoothLinkError('Commande précédente interrompue par une nouvelle commande.'));
      }
      this.buffer = '';
      const timer = setTimeout(() => {
        if (this.pending) this.pending = null;
        reject(new BluetoothLinkError(`Aucune réponse de l’adaptateur Bluetooth pour « ${command} » (délai ${timeoutMs} ms).`));
      }, timeoutMs);

      this.pending = { command, resolve: (value) => resolve(value), reject, timer };
      try {
        void this.link.write(`${command}\r`);
      } catch (error) {
        clearTimeout(timer);
        this.pending = null;
        reject(new BluetoothLinkError(`Écriture impossible sur la liaison Bluetooth (${(error as Error).message}).`));
      }
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    const pending = this.pending;
    if (!pending) return;
    if (!this.buffer.includes('>')) return;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.resolve(cleanResponse(this.buffer, pending.command));
  }
}

/**
 * Nettoie une réponse brute d'ELM327 : retire les marqueurs de fin, les lignes
 * de service et l'écho éventuel de la commande.
 */
export function cleanResponse(raw: string, command?: string): string {
  let text = raw.replace(/>/g, '');
  const lines = text.split(/[\r\n]+/).filter((line) => line.trim().length > 0);
  const commandNormalized = command?.replace(/\s+/g, '').toUpperCase();
  const kept = lines.filter((line) => {
    if (/^(SEARCHING\.\.\.|BUS INIT|STOPPED|OK)$/i.test(line.trim())) return false;
    if (commandNormalized && line.replace(/\s+/g, '').toUpperCase() === commandNormalized) return false;
    return true;
  });
  return kept.join('\r').trim();
}
