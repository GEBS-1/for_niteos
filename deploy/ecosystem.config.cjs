/** PM2: pm2 start deploy/ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "niteos",
      cwd: __dirname + "/..",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 0.0.0.0",
      instances: 1,
      autorestart: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
      },
      // Next.js читает .env.production из корня при next start
    },
  ],
};
