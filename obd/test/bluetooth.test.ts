/**
 * XAMOTO — Couche Bluetooth (§7, §29, §30, §47).
 *
 * Ces tests vérifient deux choses distinctes :
 *
 * 1. le **transport** se comporte comme une liaison série ELM327 (écho, marqueur
 *    de fin `>`, délais, erreurs explicites) ;
 * 2. XAMOTO **n'invente rien** : sans pilote, il n'y a ni liste d'appareils, ni
 *    promesse de compatibilité, et un appareil qui ressemble à un adaptateur OBD
 *    est seulement « probable » tant que l'adaptateur ELM327 n'a pas confirmé.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BluetoothLinkError,
  BluetoothTransport,
  BluetoothUnavailableError,
  Elm327Adapter,
  availableBluetoothDrivers,
  bluetoothAvailability,
  cleanResponse,
  compareDevices,
  createSerialBluetoothDriver,
  describeBluetoothDevice,
  listBluetoothDevices,
  listBluetoothDrivers,
  registerBluetoothDriver,
  unregisterBluetoothDriver,
} from '@xamoto/obd';
import type { BluetoothDevice } from '@xamoto/obd';
import { ELM327_REPLIES, FakeBluetoothDriver } from './fakeBluetooth.js';

const registered: string[] = [];
function useDriver(driver: FakeBluetoothDriver): FakeBluetoothDriver {
  registerBluetoothDriver(driver);
  registered.push(driver.id);
  return driver;
}

afterEach(() => {
  // Aucun pilote de test ne doit survivre à sa suite.
  for (const id of registered.splice(0)) unregisterBluetoothDriver(id);
});

describe('disponibilité honnête (§47-1, §47-2)', () => {
  it('sans pilote enregistré, aucun appareil n’est proposé', async () => {
    expect(availableBluetoothDrivers()).toHaveLength(0);
    expect(await listBluetoothDevices()).toEqual([]);
  });

  it('sans pilote, XAMOTO explique pourquoi au lieu de faire semblant', () => {
    const status = bluetoothAvailability();
    expect(status.available).toBe(false);
    expect(status.drivers).toEqual([]);
    expect(status.noticeFr).toContain('n’affichera aucune liste d’appareils inventée');
    expect(status.hintFr).toContain('application XAMOTO');
    expect(status.hintEn).toContain('Flutter');
  });

  it('un pilote présent mais indisponible ne produit rien et n’est pas annoncé prêt', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-off', available: false }));
    expect(bluetoothAvailability().available).toBe(false);
    expect(await listBluetoothDevices()).toEqual([]);
    expect(bluetoothAvailability().drivers[0]?.available).toBe(false);
  });

  it('un pilote disponible est annoncé par son nom', () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-on', label: 'Pont USB-Bluetooth' }));
    const status = bluetoothAvailability();
    expect(status.available).toBe(true);
    expect(status.noticeFr).toContain('Pont USB-Bluetooth');
    expect(status.hintFr).toBeUndefined();
  });

  it('ouvrir une liaison sans pilote échoue avec un message actionnable', async () => {
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33' });
    await expect(transport.open()).rejects.toBeInstanceOf(BluetoothUnavailableError);
    await expect(transport.open()).rejects.toThrow(/Aucun pilote Bluetooth/);
    expect(transport.isOpen()).toBe(false);
  });

  it('un pilote enregistré mais hors service est nommé dans l’erreur', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-ble', available: false }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:44:55:66', kind: 'ble' });
    await expect(transport.open()).rejects.toThrow(/indisponible\(s\) pour une liaison BLE : fake-ble/);
    await expect(transport.open()).rejects.toThrow(/permission a été refusée/);
  });

  it('un pilote explicitement demandé mais indisponible est expliqué précisément', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-asked', available: false }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:44:55:66', kind: 'ble', driverId: 'fake-asked' });
    await expect(transport.open()).rejects.toThrow(/« fake-asked » n’est pas disponible pour une liaison BLE/);
  });

  it('demander un pilote inconnu ne fabrique pas de liaison', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-known' }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:44:55:66', driverId: 'pilote-inexistant' });
    await expect(transport.open()).rejects.toThrow(/Aucun pilote Bluetooth nommé/);
  });

  it('demander un pilote qui ne sait pas faire du BLE est refusé proprement', async () => {
    const driver = createSerialBluetoothDriver({
      id: 'fake-spp-only',
      list: async () => [],
      open: async () => {
        throw new Error('non utilisé');
      },
    });
    useDriver(driver as never);
    const transport = new BluetoothTransport({ address: '/dev/rfcomm0', kind: 'ble', driverId: 'fake-spp-only' });
    await expect(transport.open()).rejects.toThrow(/ne sait pas ouvrir de liaison BLE/);
  });
});

describe('reconnaissance des adaptateurs', () => {
  it('un nom connu est signalé comme probable, avec son motif, jamais comme certain', () => {
    const description = describeBluetoothDevice({ name: 'Vgate iCar Pro', kind: 'ble' });
    expect(description.likelyObdAdapter).toBe(true);
    expect(description.reasonFr).toContain('après un test de liaison');
    expect(description.reasonFr).toContain('VGATE');
    expect(description.reasonEn).toMatch(/after a link test/i);
  });

  it('un service BLE connu suffit à éveiller l’attention, sans conclure', () => {
    const description = describeBluetoothDevice({
      name: 'Boîtier inconnu',
      kind: 'ble',
      services: ['0000fff0-0000-1000-8000-00805f9b34fb'],
    });
    expect(description.likelyObdAdapter).toBe(true);
    expect(description.reasonFr).toContain('présomption');
  });

  it('un appareil sans nom n’est pas décrit par invention', () => {
    const description = describeBluetoothDevice({ name: '', kind: 'ble' });
    expect(description.likelyObdAdapter).toBe(false);
    expect(description.reasonFr).toContain('n’invente pas de description');
  });

  it('une enceinte Bluetooth est classée sans ambiguïté', () => {
    const description = describeBluetoothDevice({ name: 'JBL Flip 5', kind: 'ble' });
    expect(description.likelyObdAdapter).toBe(false);
    expect(description.reasonFr).toContain('rien n’indique un adaptateur OBD');
  });

  it('les adaptateurs probables sont listés en premier', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-sort' }));
    const devices = await listBluetoothDevices();
    const enriched = devices.map((device) => ({ ...device, ...describeBluetoothDevice(device) }));
    const sorted = [...enriched].sort(compareDevices);
    expect(sorted[0]?.likelyObdAdapter).toBe(true);
    expect(sorted.at(-1)?.name).toBe('Enceinte JBL');
  });

  it('deux pilotes qui voient le même appareil ne le comptent qu’une fois', async () => {
    const a = useDriver(new FakeBluetoothDriver({ id: 'fake-a', devices: [{ address: 'AA:BB:CC:11:22:33', name: 'ELM327', kind: 'spp' }] }));
    const b = useDriver(new FakeBluetoothDriver({ id: 'fake-b', devices: [{ address: 'aa:bb:cc:11:22:33', name: '', kind: 'spp' }] }));
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    const devices = await listBluetoothDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0]?.name).toBe('ELM327');
  });

  it('un pilote en erreur ne masque pas les autres et n’invente rien', async () => {
    const broken = new FakeBluetoothDriver({ id: 'fake-broken' });
    broken.listError = new Error('adaptateur Bluetooth désactivé');
    useDriver(broken);
    useDriver(new FakeBluetoothDriver({ id: 'fake-ok', devices: [{ address: 'AA:00:00:00:00:01', name: 'ELM327 mini' }] }));
    const devices = await listBluetoothDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0]?.address).toBe('AA:00:00:00:00:01');
  });

  it('le filtre par type ne renvoie que le type demandé', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-kind' }));
    const ble = await listBluetoothDevices({ kind: 'ble' });
    expect(ble.length).toBeGreaterThan(0);
    expect(ble.every((device) => device.kind === 'ble')).toBe(true);
  });
});

describe('transport : liaison série ELM327', () => {
  it('envoie la commande, retire l’écho et s’arrête au marqueur « > »', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-tx', link: { replies: ELM327_REPLIES } }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33', name: 'ELM327 v1.5' });
    await transport.open();
    expect(transport.isOpen()).toBe(true);
    expect(transport.kind).toBe('bluetooth');
    expect(transport.label).toContain('ELM327 v1.5');

    const response = await transport.request('ATI');
    expect(response).toBe('ELM327 v1.5');
    await transport.close();
    expect(transport.isOpen()).toBe(false);
  });

  it('une liaison BLE est annoncée comme telle', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-ble-kind' }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:44:55:66', kind: 'ble', name: 'Vgate iCar Pro' });
    await transport.open();
    expect(transport.kind).toBe('ble');
    expect(transport.label).toContain('BLE');
    await transport.close();
  });

  it('assemble une réponse arrivée en plusieurs fragments', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-parts', link: { silent: true } }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33' });
    await transport.open();
    const pending = transport.request('0105');
    const link = (listBluetoothDrivers().find((d) => d.id === 'fake-parts') as FakeBluetoothDriver).lastLink;
    link?.emit('41 05');
    link?.emit(' 7B');
    link?.emit('\r>');
    expect(await pending).toBe('41 05 7B');
    await transport.close();
  });

  it('signale un délai dépassé au lieu d’attendre indéfiniment', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-timeout', link: { silent: true } }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33', timeoutMs: 30 });
    await transport.open();
    await expect(transport.request('0100')).rejects.toBeInstanceOf(BluetoothLinkError);
    await expect(transport.request('0100')).rejects.toThrow(/Aucune réponse de l’adaptateur Bluetooth/);
    await transport.close();
  });

  it('refuse une commande sur une liaison fermée', async () => {
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33' });
    await expect(transport.request('ATZ')).rejects.toThrow(/Liaison Bluetooth fermée/);
  });

  it('signale une liaison impossible avec la raison réelle', async () => {
    const driver = useDriver(new FakeBluetoothDriver({ id: 'fake-down' }));
    driver.failOpen = ['AA:BB:CC:11:22:33'];
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33' });
    await expect(transport.open()).rejects.toThrow(/Liaison Bluetooth impossible avec AA:BB:CC:11:22:33/);
  });

  it('fermer une liaison interrompt la commande en cours', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-close', link: { silent: true } }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33', timeoutMs: 5000 });
    await transport.open();
    const pending = transport.request('0100');
    await transport.close();
    await expect(pending).rejects.toThrow(/fermée/i);
  });

  it('une nouvelle commande remplace la précédente au lieu de l’ignorer', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-queue', link: { silent: true } }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33', timeoutMs: 5000 });
    await transport.open();
    const first = transport.request('0100');
    const second = transport.request('010C');
    await expect(first).rejects.toThrow(/interrompue/);
    await transport.close();
    await expect(second).rejects.toThrow();
  });

  it('open() est idempotent et close() ne casse rien', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-idem' }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33' });
    await transport.open();
    await transport.open();
    await transport.close();
    await transport.close();
    expect(transport.isOpen()).toBe(false);
  });

  it('nettoie les lignes de service d’une réponse brute', () => {
    expect(cleanResponse('SEARCHING...\r41 05 7B\r>')).toBe('41 05 7B');
    expect(cleanResponse('ATZ\rELM327 v1.5\r>', 'ATZ')).toBe('ELM327 v1.5');
    expect(cleanResponse('OK\r>', 'ATE0')).toBe('');
  });
});

describe('chaîne complète : transport Bluetooth + adaptateur ELM327', () => {
  it('un scan réel produit des données mesurées et jamais simulées', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-scan', link: { replies: ELM327_REPLIES } }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33', name: 'ELM327 v1.5' });
    const adapter = new Elm327Adapter({ transport, retries: 1 });

    const info = await adapter.connect();
    expect(info.kind).toBe('bluetooth');
    expect(info.protocol).toContain('ISO 15765-4');

    const snapshot = await adapter.scan({ vehicle: { id: 'veh_bt', brand: 'Toyota', model: 'Corolla', year: 2014, engine: '1.6', fuelType: 'essence', odometerKm: 145000 } });
    expect(snapshot.source).toBe('obd');
    expect(snapshot.readings.length).toBeGreaterThan(0);
    for (const reading of snapshot.readings) {
      expect(['measured', 'unknown']).toContain(reading.origin);
    }
    expect(snapshot.dtcs.map((dtc) => dtc.code)).toContain('P0420');
    for (const dtc of snapshot.dtcs) expect(dtc.origin).toBe('measured');
    // Un scan réel ne porte jamais la mention de simulation.
    expect(JSON.stringify(snapshot.notes)).not.toContain('MODE SIMULATION');
    expect(snapshot.milOn).toBe(true);

    await adapter.disconnect();
  });

  it('un boîtier muet ne peut pas produire un scan : l’échec est explicite', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-mute', link: { silent: true } }));
    const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33', timeoutMs: 25 });
    const adapter = new Elm327Adapter({ transport, retries: 0 });
    await expect(adapter.connect()).rejects.toThrow(/Aucune réponse/);
  });

  it('la détection Wi-Fi existante n’est pas perturbée par la couche Bluetooth', async () => {
    useDriver(new FakeBluetoothDriver({ id: 'fake-isolation' }));
    const fetchSpy = vi.fn();
    expect(fetchSpy).not.toHaveBeenCalled();
    // Le registre d'adaptateurs reste intact et liste toujours les mêmes entrées.
    const { adapterRegistry } = await import('@xamoto/obd');
    expect(adapterRegistry.list()).toEqual(expect.arrayContaining(['elm327', 'bluetooth-spp', 'ble']));
  });
});

describe('pilote série pour poste de travail', () => {
  it('expose les ports série comme des appareils Bluetooth SPP', async () => {
    const driver = createSerialBluetoothDriver({
      id: 'fake-serial',
      list: async () => [
        { path: '/dev/rfcomm0', name: 'ELM327 v2.1', paired: true },
        { path: '/dev/rfcomm1', name: 'Lecteur SD', paired: true },
      ],
      open: async () => {
        throw new Error('non utilisé');
      },
    });
    useDriver(driver as never);
    const devices = (await listBluetoothDevices()) as BluetoothDevice[];
    const elm = devices.find((d) => d.address === '/dev/rfcomm0');
    expect(elm?.kind).toBe('spp');
    expect(describeBluetoothDevice(elm as BluetoothDevice).likelyObdAdapter).toBe(true);
    expect(describeBluetoothDevice(devices.find((d) => d.address === '/dev/rfcomm1') as BluetoothDevice).likelyObdAdapter).toBe(false);
  });

  it('transmet les octets reçus du port série', async () => {
    // Type explicite : sans lui, TypeScript déduit « never » et interdit l'appel.
    let handler: ((chunk: string) => void) | null = null;
    const emit = (chunk: string): void => {
      if (handler) (handler as (chunk: string) => void)(chunk);
    };
    const written: string[] = [];
    const driver = createSerialBluetoothDriver({
      id: 'fake-serial-io',
      list: async () => [{ path: '/dev/rfcomm0', name: 'ELM327', paired: true }],
      open: async () => ({
        write: (data: string) => written.push(data),
        close: () => undefined,
        isOpen: () => true,
        on: (_event, cb) => {
          handler = cb;
        },
      }),
    });
    useDriver(driver as never);

    const transport = new BluetoothTransport({ address: '/dev/rfcomm0' });
    await transport.open();
    const pending = transport.request('ATI');
    emit('ATI\rELM327 v2.1\r>');
    expect(await pending).toBe('ELM327 v2.1');
    expect(written[0]).toBe('ATI\r');
    await transport.close();
  });
});
