/**
 * XAMOTO — Parsing bas niveau des réponses d'un adaptateur ELM327 / OBD-II.
 *
 * §7 : cette couche est *isolée*. Aucune autre partie de XAMOTO ne doit
 * connaître le format « 41 0C 1A F8 » ou la syntaxe `AT` des adaptateurs.
 */

export interface RawObdResponse {
  /** Ligne brute renvoyée par l'adaptateur. */
  raw: string;
  at: string;
  /** Octets utiles après retrait de l'en-tête de mode. */
  bytes: number[];
  ok: boolean;
  error?: string;
}

const IGNORED_LINES = [
  /^SEARCHING\.\.\.$/i,
  /^BUS INIT/i,
  /^STOPPED$/i,
  /^OK$/i,
  /^[A-Z]{2,3}\d?$/i,
];

/** Extrait les octets hexadécimaux d'une trame, en gérant l'en-tête CAN et les espaces. */
export function extractBytes(raw: string): number[] {
  const out: number[] = [];
  for (const line of raw.split(/[\r\n]+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (IGNORED_LINES.some((r) => r.test(trimmed)) && !/^[0-9A-F]{2}(\s|$)/i.test(trimmed)) continue;
    // Une trame CAN commence par un identifiant de 3 chiffres (ex. « 7E8 »).
    const body = /^[0-9A-F]{3}/i.test(trimmed) ? trimmed.slice(3) : trimmed;
    for (const token of body.split(/\s+/)) {
      if (!/^[0-9A-F]{1,2}$/i.test(token)) continue;
      out.push(parseInt(token, 16));
    }
  }
  return out;
}

/**
 * Interprète la réponse à une requête de mode 01 (PID).
 * Format typique : `41 0C 1A F8` → mode 0x41, PID 0x0C, données 0x1A 0xF8.
 */
export function parseMode01(raw: string, pid: string): RawObdResponse {
  const pidByte = parseInt(pid, 16);
  const lines = raw.split(/[\r\n]+/).filter((l) => l.trim().length > 0);
  if (/NO DATA|UNABLE TO CONNECT|CAN ERROR|BUS ERROR|\?/i.test(raw)) {
    return { raw, at: '', bytes: [], ok: false, error: 'Bus muet ou PID non supporté' };
  }
  for (const line of lines) {
    const bytes = extractBytes(line);
    if (bytes.length < 2) continue;
    const modeIdx = bytes.findIndex((b) => b === 0x41);
    if (modeIdx === -1) continue;
    if (bytes[modeIdx + 1] !== pidByte) continue;
    return { raw: line, at: '', bytes: bytes.slice(modeIdx + 2), ok: true };
  }
  return { raw, at: '', bytes: [], ok: false, error: 'Réponse mode 01 illisible' };
}

/**
 * Détermine les PID supportés à partir des masques 0100 / 0120 / 0140.
 * §8 : indispensable pour distinguer « donnée non disponible ».
 */
export function parseSupportedPids(masks: Record<string, RawObdResponse>): Set<string> {
  const supported = new Set<string>();
  const bases: Array<[string, number]> = [
    ['00', 0x00],
    ['20', 0x20],
    ['40', 0x40],
    ['60', 0x60],
  ];
  for (const [mask, base] of bases) {
    const res = masks[mask];
    if (!res?.ok || res.bytes.length < 4) continue;
    for (let i = 0; i < 32; i += 1) {
      const byteIndex = Math.floor(i / 8);
      const bit = 7 - (i % 8);
      const value = res.bytes[byteIndex];
      if (value === undefined) continue;
      if ((value >> bit) & 1) {
        const pidNum = base + i + 1;
        supported.add(pidNum.toString(16).toUpperCase().padStart(2, '0'));
      }
    }
  }
  return supported;
}

/** Commandes AT de la séquence d'initialisation recommandée. */
export const ELM_INIT_SEQUENCE = [
  'ATZ', // reset
  'ATE0', // écho off
  'ATL0', // saut de ligne off
  'ATS0', // espaces off
  'ATH1', // en-têtes on (utile pour multi-ECU)
  'ATSP0', // détection automatique du protocole
  'ATDPN', // numéro de protocole négocié
] as const;

export const PROTOCOL_NAMES: Record<string, string> = {
  '1': 'SAE J1850 PWM',
  '2': 'SAE J1850 VPW',
  '3': 'ISO 9141-2',
  '4': 'ISO 14230-4 (KWP 5 baud)',
  '5': 'ISO 14230-4 (KWP rapide)',
  '6': 'ISO 15765-4 CAN (11 bit, 500 kbaud)',
  '7': 'ISO 15765-4 CAN (29 bit, 500 kbaud)',
  '8': 'ISO 15765-4 CAN (11 bit, 250 kbaud)',
  '9': 'ISO 15765-4 CAN (29 bit, 250 kbaud)',
  A: 'SAE J1939 (CAN 29 bit, 250 kbaud)',
  B: 'SAE J1939 (CAN 29 bit, 500 kbaud)',
  C: 'ISO 27145 / WWH-OBD (CAN 29 bit, 500 kbaud)',
};

export function protocolFromDpn(raw: string): string | null {
  const cleaned = raw.replace(/[\r\n\s]/g, '').replace(/^ATDPN/i, '').toUpperCase();
  if (!cleaned || cleaned === 'NODATA' || cleaned === '?') return null;
  const auto = cleaned.startsWith('A');
  const key = auto ? cleaned.slice(1) : cleaned;
  const name = PROTOCOL_NAMES[key];
  if (!name) return null;
  return auto ? `Auto → ${name}` : name;
}
