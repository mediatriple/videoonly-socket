// PM2 ecosystem configuration for panelsocket.
//
// Single-process mode (default): straightforward, no Redis adapter needed.
// Cluster mode: uncomment `instances` and `exec_mode`, then add the
//   @socket.io/redis-adapter to src/index.ts so rooms are shared across
//   all worker processes.

module.exports = {
  apps: [
    {
      name: 'panelsocket',
      script: './dist/index.js',

      // ── Cluster mode (horizontal scaling) ──────────────────────────────
      // Requires Redis adapter.  Uncomment both lines when ready.
      // instances: 'max',   // one process per CPU core
      // exec_mode: 'cluster',

      // ── Environment ─────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT: 3030,
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        ALLOWED_ORIGINS:
          process.env.ALLOWED_ORIGINS ||
          'https://panel.mediatriple.net,https://vopanelpp.mediatriple.net,https://mtvosoct1.mediatriple.net,http://localhost',
        SOCKET_PING_INTERVAL: process.env.SOCKET_PING_INTERVAL || '25000',
        SOCKET_PING_TIMEOUT: process.env.SOCKET_PING_TIMEOUT || '60000',
        SOCKET_UPGRADE_TIMEOUT: process.env.SOCKET_UPGRADE_TIMEOUT || '30000',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3030,
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        ALLOWED_ORIGINS:
          process.env.ALLOWED_ORIGINS ||
          'https://panel.mediatriple.net,https://vopanelpp.mediatriple.net,https://mtvosoct1.mediatriple.net,http://localhost',
        SOCKET_PING_INTERVAL: process.env.SOCKET_PING_INTERVAL || '25000',
        SOCKET_PING_TIMEOUT: process.env.SOCKET_PING_TIMEOUT || '60000',
        SOCKET_UPGRADE_TIMEOUT: process.env.SOCKET_UPGRADE_TIMEOUT || '30000',
        // TOKEN_SECRET and ALLOWED_ORIGINS should be injected via the host
        // environment or a secrets manager — never hard-code them here.
      },

      // ── Process management ───────────────────────────────────────────────
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: '30s',

      // ── Logging ──────────────────────────────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
  ],
};
