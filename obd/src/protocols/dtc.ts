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
  /** Valeur des quatre chiffres hexadécimaux (P0420 → 0x0420 = 1056). */
  sequence: number;
}

export function decodeDtcBytes(a: number, b: number): DecodedDtc {
  const family = (a & 0xc0) >> 6;
  const type = (a & 0x30) >> 4;
  const familyInfo = DTC_FAMILIES[family] ?? { letter: 'P', system: 'Inconnu' };
  // Les quatre chiffres du code : type (0 générique / 1 constructeur), puis
  // les trois demi-octets utiles. Ex. 0x04 0x20 → P0420.
  const second = a & 0x0f;
  const third = (b & 0xf0) >> 4;
  const fourth = b & 0x0f;
  return {
    code: `${familyInfo.letter}${type}${second}${third}${fourth}`,
    letter: familyInfo.letter,
    type: type === 0 ? 'generic' : type === 1 ? 'manufacturer' : 'reserved',
    system: familyInfo.system,
    sequence: type * 4096 + second * 256 + third * 16 + fourth,
  };
}

const LETTER_INDEX: Record<string, number> = { P: 0b00, C: 0b01, B: 0b10, U: 0b11 };

export function encodeDtcCode(code: string): [number, number] | null {
  // Format normalisé SAE J2012 : une lettre puis QUATRE caractères hexadécimaux
  // (ex. P0420, P0300, U0100). Le premier chiffre encode le type de code.
  const m = /^([PCBU])([0-3])([0-9A-F])([0-9A-F])([0-9A-F])$/i.exec(code.trim());
  if (!m) return null;
  const letter = (m[1] as string).toUpperCase();
  const family = LETTER_INDEX[letter];
  if (family === undefined) return null;
  const type = Number(m[2]);
  const second = parseInt(m[3] as string, 16);
  const third = parseInt(m[4] as string, 16);
  const fourth = parseInt(m[5] as string, 16);
  return [(family << 6) | (type << 4) | second, (third << 4) | fourth];
}

export function isValidDtc(code: string): boolean {
  return /^[PCBU][0-3][0-9A-F]{3}$/i.test(code.trim());
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
  const idx = bytes.findIndex((b) => b === parseInt(responseMarker, 16));
  // Certains adaptateurs renvoient les données sans écho du mode : on interprète
  // alors la trame à partir du premier octet.
  let payload = idx === -1 ? bytes : bytes.slice(idx + 1);
  /*
   * Attention : le premier octet de la charge utile est le NOMBRE de codes
   * (mode 43 / 47 / 4A), suivi de N paires d'octets. La charge utile est donc
   * de longueur impaire. Ne pas retirer cet octet décalait toutes les paires
   * et produisait des codes inexistants — un vrai P0420 était lu « P0204 ».
   */
  if (payload.length % 2 === 1) payload = payload.slice(1);
  /*
   * Ne jamais filtrer les octets nuls : 0x00 est une valeur légitime (c'est le
   * 4e chiffre de P0300) et un filtrage décalait les paires.
   */
  for (let i = 0; i + 1 < payload.length; i += 2) {
    const a = payload[i] as number;
    const b = payload[i + 1] as number;
    if (a === 0 && b === 0) continue;
    codes.push(decodeDtcBytes(a, b).code);
  }
  return [...new Set(codes)];
}
