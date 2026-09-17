/**
 * XAMOTO — Transports de développement et de test.
 *
 * 1. `MemoryTransport` : rejoue une table de réponses — permet de tester le
 *    parsing ELM327 sans matériel.
 * 2. `UnavailableTransport` : transport « réel » non disponible sur la
 *    plateforme courante (ex. Web Bluetooth indisponible, pas d’adaptateur
 *    appairé). Il échoue proprement, avec un message compréhensible, au lieu
 *    de simuler une connexion (§47-1 et §47-10).
 */
import type { ConnectionKind } from '@xamoto/shared';
import type { ObdTransport } from './types.js';

export class MemoryTransport implements ObdTransport {
  readonly kind: ConnectionKind;
  readonly label: string;
  private open_ = false;
  public sent: string[] = [];

  constructor(
    private responses: Record<string, string>,
    options: { kind?: ConnectionKind; label?: string; defaultResponse?: string } = {},
  ) {
    this.kind = options.kind ?? 'usb';
    this.label = options.label ?? 'Transport mémoire (tests)';
    this.defaultResponse = options.defaultResponse ?? 'NO DATA';
  }

  private defaultResponse: string;

  async open(): Promise<void> {
    this.open_ = true;
  }

  async close(): Promise<void> {
    this.open_ = false;
  }

  isOpen(): boolean {
    return this.open_;
  }

  async request(command: string): Promise<string> {
    if (!this.open_) throw new Error('Transport fermé');
    const cmd = command.trim().toUpperCase();
    this.sent.push(cmd);
    const response = this.responses[cmd];
    if (response === undefined) return this.defaultResponse;
    return response;
  }
}

export class UnavailableTransport implements ObdTransport {
  readonly kind: ConnectionKind;
  readonly label: string;
  private reason: string;

  constructor(reason: string, kind: ConnectionKind = 'bluetooth') {
    this.reason = reason;
    this.kind = kind;
    this.label = 'Liaison indisponible';
  }

  async open(): Promise<void> {
    throw new Error(this.reason);
  }

  async close(): Promise<void> {
    /* rien à fermer */
  }

  isOpen(): boolean {
    return false;
  }

  async request(): Promise<string> {
    throw new Error(this.reason);
  }
}
