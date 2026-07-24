module.exports = {
  apps: [
    {
      name: "solarepc-api",
      script: "./api-server/dist/index.mjs",
      cwd: "/home/automystics-solarepc/htdocs/solarepc.automystics.tech",
      interpreter: "node",
      interpreter_args: "--enable-source-maps",
      env: {
        NODE_ENV: "production",
        PORT: "5000",
      },
      env_file: "./api-server/.env",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
