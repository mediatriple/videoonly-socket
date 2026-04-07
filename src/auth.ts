import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from './logger';

/**
 * Validates the token from the socket handshake query.
 * Accepts either a signed JWT (verified against TOKEN_SECRET) or a raw
 * secret string for simpler deployments.
 *
 * TOKEN_SECRET is read lazily so tests can set process.env before connecting.
 *
 * Returns true when the token is valid, false otherwise.
 */
export function validateToken(token: string): boolean {
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
  return secret.length > 0 && token === secret;
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

  if (!validateToken(token)) {
    logger.warn(
      { socket_id: socket.id, user_id, encoders_id },
      'Connection rejected: invalid token',
    );
    socket.disconnect(true);
    return next(new Error('Authentication failed'));
  }

  next();
}
