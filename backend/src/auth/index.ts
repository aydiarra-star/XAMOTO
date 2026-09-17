/**
 * XAMOTO — Authentification et permissions (§36, §37).
 *
 * – Mots de passe : scrypt avec sel aléatoire (aucun mot de passe en clair).
 * – Sessions : jeton signé HMAC-SHA256, haché en base (révocation possible).
 * – Permissions : aucune donnée véhicule n'est accessible sans autorisation.
 *   L'accès se fait par propriété, partage explicite ou organisation.
 */
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@xamoto/shared';
import { config } from '../config.js';
import { all, audit, get, id, now, run, type Row } from '../db/index.js';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  locale: string;
  country: string;
  plan: string;
  organizationId: string | null;
}

/* ───────────────────────────── Mots de passe ───────────────────────────── */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/* ─────────────────────────────── Jetons ───────────────────────────────── */

const base64url = (input: Buffer | string): string => Buffer.from(input).toString('base64url');

function sign(payload: string): string {
  return createHmac('sha256', config.jwtSecret).update(payload).digest('base64url');
}

export interface SessionToken {
  token: string;
  expiresAt: string;
}

export function createSession(userId: string, userAgent?: string): SessionToken {
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600_000).toISOString();
  const sessionId = randomUUID();
  const payload = JSON.stringify({ sub: userId, sid: sessionId, exp: expiresAt });
  const encoded = base64url(payload);
  const token = `${encoded}.${sign(encoded)}`;

  run('INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, user_agent) VALUES (?,?,?,?,?,?)', [
    sessionId,
    userId,
    createHmac('sha256', config.jwtSecret).update(token).digest('hex'),
    now(),
    expiresAt,
    userAgent ?? null,
  ]);

  return { token, expiresAt };
}

export function verifyToken(token: string): { userId: string; sessionId: string } | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  if (expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;

  let payload: { sub?: string; sid?: string; exp?: string };
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as typeof payload;
  } catch {
    return null;
  }
  if (!payload.sub || !payload.sid || !payload.exp) return null;
  if (new Date(payload.exp).getTime() < Date.now()) return null;

  const session = get<{ revoked_at: string | null; expires_at: string }>('SELECT revoked_at, expires_at FROM sessions WHERE id = ?', [payload.sid]);
  if (!session || session.revoked_at) return null;

  return { userId: payload.sub, sessionId: payload.sid };
}

export function revokeSession(sessionId: string): void {
  run('UPDATE sessions SET revoked_at = ? WHERE id = ?', [now(), sessionId]);
}

export function revokeAllSessions(userId: string): void {
  run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [now(), userId]);
}

/* ─────────────────────────── Utilisateurs ─────────────────────────────── */

export function userFromRow(row: Row): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    role: String(row.role) as Role,
    locale: String(row.locale ?? 'fr'),
    country: String(row.country ?? 'SN'),
    plan: String(row.plan ?? 'free'),
    organizationId: row.organization_id ? String(row.organization_id) : null,
  };
}

export function findUserById(userId: string): AuthUser | null {
  const row = get<Row>('SELECT * FROM users WHERE id = ?', [userId]);
  return row ? userFromRow(row) : null;
}

export function findUserByEmail(email: string): Row | undefined {
  return get<Row>('SELECT * FROM users WHERE lower(email) = lower(?)', [email]);
}

export function createUser(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  country?: string;
  locale?: string;
  role?: Role;
  organizationId?: string | null;
  plan?: string;
}): AuthUser {
  const userId = id('usr');
  const timestamp = now();
  run(
    'INSERT INTO users (id, email, password_hash, full_name, phone, country, locale, role, organization_id, plan, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [
      userId,
      input.email.toLowerCase(),
      hashPassword(input.password),
      input.fullName,
      input.phone ?? null,
      input.country ?? 'SN',
      input.locale ?? 'fr',
      input.role ?? 'user',
      input.organizationId ?? null,
      input.plan ?? 'free',
      timestamp,
      timestamp,
    ],
  );
  audit('user.created', 'users', userId, userId, { email: input.email });
  return findUserById(userId) as AuthUser;
}

/* ──────────────────────────── Fastify guards ──────────────────────────── */

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    sessionId?: string;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    reply.code(401).send({ error: { code: 'unauthenticated', message: 'Authentification requise.' } });
    return;
  }
  const verified = verifyToken(header.slice(7));
  if (!verified) {
    reply.code(401).send({ error: { code: 'invalid_session', message: 'Session expirée ou invalide. Reconnectez-vous.' } });
    return;
  }
  const user = findUserById(verified.userId);
  if (!user) {
    reply.code(401).send({ error: { code: 'unknown_user', message: 'Compte introuvable.' } });
    return;
  }
  request.user = user;
  request.sessionId = verified.sessionId;
}

export async function optionalAuth(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return;
  const verified = verifyToken(header.slice(7));
  if (!verified) return;
  const user = findUserById(verified.userId);
  if (user) request.user = user;
}

export function requireRole(user: AuthUser, roles: Role[]): void {
  if (!roles.includes(user.role) && user.role !== 'admin') {
    const error = new Error(`Accès refusé : rôle requis ${roles.join(' ou ')}.`) as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}

/* ──────────────────── Autorisation d'accès au véhicule ─────────────────── */

export type VehiclePermission = 'owner' | 'read' | 'write' | 'diagnose' | 'none';

/**
 * §36 : « aucune donnée véhicule ne doit être accessible sans autorisation ».
 * Un accès existe si : l'utilisateur est propriétaire, bénéficie d'un partage
 * actif, ou appartient à l'organisation propriétaire du véhicule.
 */
export function vehiclePermission(vehicleId: string, user: AuthUser): VehiclePermission {
  const vehicle = get<Row>('SELECT owner_id, organization_id FROM vehicles WHERE id = ?', [vehicleId]);
  if (!vehicle) return 'none';
  if (vehicle.owner_id === user.id) return 'owner';
  if (vehicle.organization_id && vehicle.organization_id === user.organizationId && ['fleet_manager', 'garage', 'admin', 'technician'].includes(user.role)) {
    return 'diagnose';
  }
  const shares = all<Row>(
    `SELECT s.permission FROM vehicle_shares s
      LEFT JOIN garages g ON g.id = s.garage_id
      WHERE s.vehicle_id = ? AND s.revoked_at IS NULL
        AND (s.user_id = ? OR (? IS NOT NULL AND s.user_id = ?))`,
    [vehicleId, user.id, user.id, user.id],
  );
  if (shares.length === 0) return 'none';
  const permissions = shares.map((s) => String(s.permission)) as Array<'read' | 'write' | 'diagnose'>;
  if (permissions.includes('diagnose')) return 'diagnose';
  if (permissions.includes('write')) return 'write';
  return 'read';
}

export function assertVehicleAccess(vehicleId: string, user: AuthUser, minimum: 'read' | 'write' | 'diagnose' = 'read'): VehiclePermission {
  const permission = vehiclePermission(vehicleId, user);
  const rank: Record<VehiclePermission, number> = { none: 0, read: 1, write: 2, diagnose: 3, owner: 4 };
  if (rank[permission] < rank[minimum]) {
    const error = new Error(
      permission === 'none'
        ? 'Aucune autorisation sur ce véhicule.'
        : `Autorisation insuffisante (${permission}) pour cette action (${minimum} requis).`,
    ) as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
  return permission;
}
