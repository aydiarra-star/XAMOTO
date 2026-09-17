/**
 * XAMOTO — Transport Wi-Fi / TCP pour adaptateur ELM327 (§7).
 *
 * De nombreux adaptateurs ELM327 « Wi-Fi » créent un point d'accès et exposent
 * une passerelle TCP (souvent 192.168.0.10:35000). Ce transport permet donc de
 * faire un VRAI scan depuis le serveur XAMOTO, sans dépendre du navigateur.
 *
 * Ce transport ne connaît pas le diagnostic : il ouvre une liaison, envoie des
 * commandes, renvoie les réponses brutes. Toute l'interprétation appartient à
 * `Elm327Adapter` puis au moteur de diagnostic.
 */
import { createConnection, type Socket } from 'node:net';
import type { ConnectionKind } from '@xamoto/shared';
import type { ObdTransport } from './types.js';

export interface TcpTransportOptions {
  host: string;
  port?: number;
  /** Délai maximal d'établissement de la connexion. */
  connectTimeoutMs?: number;
  /** Délai par défaut pour une commande. */
  timeoutMs?: number;
  label?: string;
}

/** Adresses les plus courantes des passerelles ELM327 Wi-Fi. */
export const COMMON_ELM327_HOSTS = ['192.168.0.10', '192.168.1.5', '192.168.4.1', '10.0.0.10'] as const;
export const COMMON_ELM327_PORTS = [35000, 23, 2000] as const;

export class TcpTransport implements ObdTransport {
  readonly kind: ConnectionKind = 'wifi';
  readonly label: string;

  private socket: Socket | null = null;
  private buffer = '';
  private pending: { resolve: (value: string) => void; reject: (error: Error) => void; timer: NodeJS.Timeout; frameEnd: RegExp } | null = null;
  private readonly host: string;
  private readonly port: number;
  private readonly connectTimeoutMs: number;
  private readonly timeoutMs: number;

  constructor(options: TcpTransportOptions) {
    this.host = options.host;
    this.port = options.port ?? 35000;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 5000;
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.label = options.label ?? `ELM327 Wi-Fi ${this.host}:${this.port}`;
  }

  async open(): Promise<void> {
    if (this.socket) return;
    await new Promise<void>((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Adaptateur injoignable sur ${this.host}:${this.port}. Vérifiez que vous êtes bien connecté au réseau Wi-Fi de l’adaptateur.`));
      }, this.connectTimeoutMs);

      socket.once('connect', () => {
        clearTimeout(timer);
        this.socket = socket;
        resolve();
      });
      socket.once('error', (error) => {
        clearTimeout(timer);
        this.socket = null;
        reject(new Error(`Liaison impossible avec ${this.host}:${this.port} (${error.message}).`));
      });
      socket.on('data', (chunk: Buffer) => this.onData(chunk.toString('latin1')));
      socket.on('close', () => {
        this.socket = null;
        if (this.pending) {
          clearTimeout(this.pending.timer);
          this.pending.reject(new Error('Liaison interrompue par l’adaptateur.'));
          this.pending = null;
        }
      });
    });
  }

  async close(): Promise<void> {
    if (!this.socket) return;
    const socket = this.socket;
    this.socket = null;
    await new Promise<void>((resolve) => {
      socket.end(() => resolve());
      setTimeout(() => {
        socket.destroy();
        resolve();
      }, 300);
    });
  }

  isOpen(): boolean {
    return this.socket !== null;
  }

  /**
   * Envoie une commande ELM327 et attend la fin de trame (`>`).
   * Le caractère `>` est le marqueur universel de fin de réponse de l'ELM327.
   */
  request(command: string, timeoutMs = this.timeoutMs): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Liaison fermée : appelez open() avant toute commande.'));
        return;
      }
      const previous = this.pending;
      if (previous) {
        clearTimeout(previous.timer);
        previous.reject(new Error('Commande précédente interrompue par une nouvelle commande.'));
      }
      this.buffer = '';
      const timer = setTimeout(() => {
        if (this.pending) this.pending = null;
        reject(new Error(`Aucune réponse de l’adaptateur pour « ${command} » (délai ${timeoutMs} ms).`));
      }, timeoutMs);

      this.pending = { resolve, reject, timer, frameEnd: /[>\r\n]/ };
      this.socket.write(`${command}\r`);
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    const pending = this.pending;
    if (!pending) return;
    if (this.buffer.includes('>')) {
      this.pending = null;
      clearTimeout(pending.timer);
      pending.resolve(this.buffer.replace(/>/g, '').trim());
    }
  }
}
