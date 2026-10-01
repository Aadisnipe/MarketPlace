const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

let server;

async function start() {
  await connectDB();
  server = app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

function shutdown(reason, code = 0) {
  console.log(`Shutting down: ${reason}`);
  if (server) server.close(() => process.exit(code));
  else process.exit(code);
}

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  shutdown('unhandledRejection', 1);
});
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
