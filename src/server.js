import { app } from './app.js';
import { env } from './config/env.js';
import { closeDatabase } from './config/database.js';

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`pmfilter-be listening on http://${env.HOST}:${env.PORT}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down gracefully`);
  server.close(async () => {
    try {
      await closeDatabase();
      process.exit(0);
    } catch (error) {
      console.error('Error while closing database pool', error);
      process.exit(1);
    }
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
