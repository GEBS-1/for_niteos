/** PM2: pm2 start deploy/ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "niteos",
      cwd: __dirname + "/..",
      script: ".next/standalone/server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
