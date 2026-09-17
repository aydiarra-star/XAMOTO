/**
 * XAMOTO — Décodage des codes défaut (SAE J2012).
 *
 * Un DTC se lit sur 2 octets : les 2 bits de poids fort donnent la famille,
 * les 2 suivants le type (générique / constructeur), les 3 derniers l'octet
 * hexadécimal du code.
 */

export const DTC_FAMILIES: Record<number, { letter: string; system: string }> = {
  0b00: { letter: 'P', system: 'Groupe motopropulseur' },
  0b01: { letter: 'C', system: 'Châssis' },
  0b10: { letter: 'B', system: 'Carrosserie' },
  0b11: { letter: 'U', system: 'Réseau de communication' },
};

export interface DecodedDtc {
  code: string;
  letter: string;
  /** 0 = générique SAE, 1 = constructeur, 2/3 = réservé. */
  type: 'generic' | 'manufacturer' | 'reserved';
  system: string;
  /** Numéro de séquence, ex. 420 pour P0420. */
  sequence: number;
}

export function decodeDtcBytes(a: number, b: number): DecodedDtc {
  const family = (a & 0xc0) >> 6;
  const type = (a & 0x30) >> 4;
  const familyInfo = DTC_FAMILIES[family] ?? { letter: 'P', system: 'Inconnu' };
  const digit1 = a & 0x0f;
  const digit2 = (b & 0xf0) >> 4;
  const digit3 = b & 0x0f;
  return {
    code: `${familyInfo.letter}${digit1}${digit2}${digit3}`,
    letter: familyInfo.letter,
    type: type === 0 ? 'generic' : type === 1 ? 'manufacturer' : 'reserved',
    system: familyInfo.system,
    sequence: digit1 * 256 + digit2 * 16 + digit3,
  };
}

const LETTER_INDEX: Record<string, number> = { P: 0b00, C: 0b01, B: 0b10, U: 0b11 };

export function encodeDtcCode(code: string): [number, number] | null {
  const m = /^([PCBU])([0-3])([0-9A-F])([0-9A-F])$/i.exec(code.trim());
  if (!m) return null;
  const letter = (m[1] as string).toUpperCase();
  const family = LETTER_INDEX[letter];
  if (family === undefined) return null;
  const d1 = Number(m[2]);
  const d2 = parseInt(m[3] as string, 16);
  const d3 = parseInt(m[4] as string, 16);
  return [(family << 6) | (0 << 4) | d1, (d2 << 4) | d3];
}

export function isValidDtc(code: string): boolean {
  return /^[PCBU][0-3][0-9A-F]{2}$/i.test(code.trim());
}

/**
 * Décode une réponse DTC (mode 03 / 07 / 0A) en liste de codes.
 * Le premier octet de chaque réponse donne le nombre de codes (mode 43 / 47 / 4A).
 */
export function parseDtcResponse(raw: string, expectedMode: 3 | 7 | 10 = 3): string[] {
  const cleaned = raw.replace(/[\r\n]+/g, ' ').replace(/SEARCHING\.\.\./gi, '').trim();
  if (!cleaned || /NO DATA/i.test(cleaned)) return [];
  const responseMarker = (expectedMode + 0x40).toString(16).toUpperCase().padStart(2, '0');
  const codes: string[] = [];
  const tokens = cleaned.split(/\s+/).filter((t) => /^[0-9A-F]{2,}$/i.test(t));
  let bytes: number[] = [];
  for (const token of tokens) {
    const hex = token.toUpperCase();
    if (hex.length === 2) bytes.push(parseInt(hex, 16));
    else if (hex.length === 4 || hex.length === 6) {
      for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
  }
  // On cherche la réponse `43` (ou 47/4A) puis on lit les paires d'octets.
  let idx = bytes.findIndex((b) => b === parseInt(responseMarker, 16));
  if (idx === -1) {
    // Certains adaptateurs renvoient les données sans écho du mode : on tente
    // d'interpréter directement les paires valides.
    idx = 0;
    bytes = bytes.filter((b) => b !== 0x00);
  } else {
    bytes = bytes.slice(idx + 1);
  }
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const a = bytes[i] as number;
    const b = bytes[i + 1] as number;
    if (a === 0 && b === 0) continue;
    codes.push(decodeDtcBytes(a, b).code);
  }
  return [...new Set(codes)];
}
