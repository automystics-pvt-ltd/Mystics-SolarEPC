/**
 * PM2 Ecosystem Config — Mystics ERP (VPS deployment)
 *
 * Usage:
 *   pm2 start deployment/ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    /* ── API Server ──────────────────────────────────────────────────────────── */
    {
      name: 'mystics-api',
      cwd: '/opt/mystics/artifacts/api-server',
      script: 'node',
      args: '--enable-source-maps ./dist/index.mjs',
      env: {
        NODE_ENV: 'production',
        PORT: '8080',
        // Copy remaining vars from /opt/mystics/.env.production at deploy time
      },
      env_file: '/opt/mystics/.env.production',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: '/var/log/mystics/api-error.log',
      out_file:   '/var/log/mystics/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Graceful shutdown: give in-flight requests up to 10 s
      kill_timeout: 10000,
      listen_timeout: 15000,
    },

    /* ── Static Frontend (served by Nginx — this process is only needed if    ──
       you use `vite preview` instead of Nginx static serving)                  */
    // {
    //   name: 'mystics-web',
    //   cwd: '/opt/mystics/artifacts/erp',
    //   script: 'node',
    //   args: './node_modules/.bin/vite preview --port 3000 --host 0.0.0.0',
    //   env_file: '/opt/mystics/.env.production',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   autorestart: true,
    //   watch: false,
    // },
  ],
};
