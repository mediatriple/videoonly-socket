import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import { authMiddleware } from './auth';
import { logger } from './logger';
import { registerHandlers as registerTextareaHandlers } from './handlers/textarea';
import { registerHandlers as registerSoundHandlers } from './handlers/sound';
import { registerHandlers as registerEncoderHandlers } from './handlers/encoder';

const PORT = parseInt(process.env.PORT ?? '3030', 10);
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ?? 'https://panel.mediatriple.net,http://localhost'
)
  .split(',')
  .map((o) => o.trim());

// ── HTTP server ──────────────────────────────────────────────────────────────

const httpServer = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const body = JSON.stringify({ status: 'ok', uptime: process.uptime() });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  res.writeHead(404).end();
});

// ── Socket.IO server ─────────────────────────────────────────────────────────

export const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
  },
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
  logger.error({ event: 'connect_error', message: err.message }, 'Connection error');
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
  logger.info({ port: PORT, origins: ALLOWED_ORIGINS }, 'panelsocket listening');
});
