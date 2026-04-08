import { Socket } from 'socket.io';
import { createHmac } from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from './logger';

const DEFAULT_LEGACY_HMAC_SECRET = 'yQZBke4F5NXKVHJYpfcU8A';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLegacyDateCandidates(referenceDate = new Date()): string[] {
  return Array.from(
    new Set([formatLocalDate(referenceDate), formatUtcDate(referenceDate)]),
  );
}

export function createLegacyHmacToken(
  userId: string,
  encoderId: string,
  date: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`${userId}|${encoderId}|${date}`)
    .digest('hex');
}

/**
 * Validates the token from the socket handshake query.
 * Accepts one of:
 * 1. a signed JWT (verified against TOKEN_SECRET)
 * 2. a raw secret string for simpler deployments
 * 3. the legacy PHP HMAC token built from user_id|encoders_id|YYYY-MM-DD
 *
 * TOKEN_SECRET is read lazily so tests can set process.env before connecting.
 *
 * Returns true when the token is valid, false otherwise.
 */
export function validateToken(
  token: string,
  context?: {
    user_id?: string;
    encoders_id?: string;
    referenceDate?: Date;
  },
): boolean {
  if (!token) return false;

  const secret = process.env.TOKEN_SECRET ?? '';

  // Attempt JWT verification first.
  try {
    jwt.verify(token, secret);
    return true;
  } catch {
    // Fall through to raw-secret comparison.
  }

  // Simple secret comparison as a fallback (constant-time not required here
  // because the token travels over TLS and Socket.IO already rate-limits).
  if (secret.length > 0 && token === secret) {
    return true;
  }

  if (!context?.user_id || !context?.encoders_id) {
    return false;
  }

  const legacySecret =
    process.env.LEGACY_HMAC_SECRET ?? DEFAULT_LEGACY_HMAC_SECRET;

  return getLegacyDateCandidates(context.referenceDate).some(
    (date) =>
      createLegacyHmacToken(
        context.user_id as string,
        context.encoders_id as string,
        date,
        legacySecret,
      ) === token,
  );
}

/**
 * Socket.IO middleware that authenticates every incoming connection.
 * Disconnects immediately on failure.
 */
export function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  const { token, user_id, encoders_id } = socket.handshake.query as Record<
    string,
    string
  >;

  if (!user_id || !encoders_id) {
    logger.warn(
      { socket_id: socket.id },
      'Connection rejected: missing user_id or encoders_id',
    );
    socket.disconnect(true);
    return next(new Error('Missing required query parameters'));
  }

  if (!validateToken(token, { user_id, encoders_id })) {
    logger.warn(
      { socket_id: socket.id, user_id, encoders_id },
      'Connection rejected: invalid token',
    );
    socket.disconnect(true);
    return next(new Error('Authentication failed'));
  }

  next();
}
