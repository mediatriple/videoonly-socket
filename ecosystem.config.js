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
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3030,
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
