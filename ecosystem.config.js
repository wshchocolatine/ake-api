module.exports = {
    apps: [
      {
        name: 'ake-api',
        script: './build/server.js',
        instances: 'max',
        exec_mode: 'cluster',
        autorestart: true,
      },
    ],
  }