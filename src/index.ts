import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import { authMiddleware } from './auth';
import { logger } from './logger';
import { registerHandlers as registerTextareaHandlers } from './handlers/textarea';
import { registerHandlers as registerSoundHandlers } from './handlers/sound';
import { registerHandlers as registerEncoderHandlers } from './handlers/encoder';
import { resolveAllowedOrigins } from './config';

const PORT = parseInt(process.env.PORT ?? '3030', 10);
const SOCKET_PING_INTERVAL = parseInt(
  process.env.SOCKET_PING_INTERVAL ?? '25000',
  10,
);
const SOCKET_PING_TIMEOUT = parseInt(
  process.env.SOCKET_PING_TIMEOUT ?? '60000',
  10,
);
const SOCKET_UPGRADE_TIMEOUT = parseInt(
  process.env.SOCKET_UPGRADE_TIMEOUT ?? '30000',
  10,
);
const ALLOWED_ORIGINS = resolveAllowedOrigins();

// ── HTTP server ──────────────────────────────────────────────────────────────

const httpServer = http.createServer((req, res) => {
  const requestPath = (req.url ?? '/').split('?')[0];

  const sendJson = (statusCode: number, payload: Record<string, unknown>) => {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  };

  if (req.method === 'GET' && requestPath === '/health') {
    sendJson(200, { status: 'ok', uptime: process.uptime() });
    return;
  }

  if (req.method === 'GET' && requestPath === '/') {
    sendJson(200, {
      service: 'panelsocket',
      status: 'ok',
      health: '/health',
      socket_path: '/socket.io',
    });
    return;
  }

  sendJson(404, {
    error: 'not_found',
    message: 'Use /health for health checks or /socket.io for realtime connections.',
  });
});

// ── Socket.IO server ─────────────────────────────────────────────────────────

export const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  allowEIO3: true,
  pingInterval: SOCKET_PING_INTERVAL,
  pingTimeout: SOCKET_PING_TIMEOUT,
  upgradeTimeout: SOCKET_UPGRADE_TIMEOUT,
  // Allow both polling and WebSocket transports so clients can upgrade.
  transports: ['polling', 'websocket'],
});

// Authentication middleware runs before every connection is accepted.
io.use(authMiddleware);

io.on('connection', (socket) => {
  const { user_id, encoders_id } = socket.handshake.query as Record<
    string,
    string
  >;

  const room = `encoder:${encoders_id}`;
  socket.join(room);

  logger.info(
    {
      event: 'connect',
      user_id,
      encoders_id,
      socket_id: socket.id,
      timestamp: new Date().toISOString(),
    },
    'Client connected',
  );

  // Register domain handlers.
  registerTextareaHandlers(io, socket);
  registerSoundHandlers(io, socket);
  registerEncoderHandlers(io, socket);

  socket.on('disconnect', (reason) => {
    logger.info(
      {
        event: 'disconnect',
        user_id,
        encoders_id,
        socket_id: socket.id,
        reason,
        timestamp: new Date().toISOString(),
      },
      'Client disconnected',
    );
  });
});

io.engine.on('connection_error', (err) => {
  logger.error(
    { event: 'connect_error', code: err.code, message: err.message },
    'Connection error',
  );
});

// ── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown() {
  logger.info('SIGTERM received — shutting down gracefully');
  io.close(() => {
    logger.info('All sockets closed');
    process.exit(0);
  });

  // Force-exit if sockets do not drain within 10 s.
  setTimeout(() => {
    logger.warn('Forced exit after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      origins: ALLOWED_ORIGINS,
      ping_interval: SOCKET_PING_INTERVAL,
      ping_timeout: SOCKET_PING_TIMEOUT,
      upgrade_timeout: SOCKET_UPGRADE_TIMEOUT,
    },
    'panelsocket listening',
  );
});
