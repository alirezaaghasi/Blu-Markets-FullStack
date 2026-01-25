import 'dotenv/config';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { startPricePolling, stopPricePolling } from './services/price-polling.service.js';
import { startBackgroundJobs, stopBackgroundJobs } from './services/background-jobs.service.js';
import { startPortfolioMetricsWorker, stopPortfolioMetricsWorker } from './services/portfolio-metrics.service.js';
import { setupGracefulShutdown, registerShutdownHandler } from './utils/shutdown.js';

async function main() {
  // Setup graceful shutdown handlers first
  setupGracefulShutdown();

  // Connect to database
  await connectDatabase();

  // Build Fastify app
  const app = await buildApp();

  // Register shutdown handlers in priority order
  // 1. Stop accepting new requests
  registerShutdownHandler('http-server', () => app.close(), 1);
  // 2. Stop background workers (setInterval-based)
  registerShutdownHandler('price-polling', stopPricePolling, 5);
  registerShutdownHandler('background-jobs', stopBackgroundJobs, 5);
  registerShutdownHandler('portfolio-metrics', stopPortfolioMetricsWorker, 5);
  // 3. Close database connection last
  registerShutdownHandler('database', disconnectDatabase, 10);

  // Start server
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🚀 Server running at http://${env.HOST}:${env.PORT}`);
    app.log.info(`📚 API docs at http://${env.HOST}:${env.PORT}/docs`);

    // Start price polling for WebSocket broadcasts
    if (env.ENABLE_PRICE_WEBSOCKET) {
      startPricePolling();
      app.log.info('📡 WebSocket price streaming enabled');
    }

    // Start background jobs (loan checks, protection expiry)
    startBackgroundJobs();
    app.log.info('⚙️  Background jobs started');

    // Start portfolio metrics worker
    startPortfolioMetricsWorker();
    app.log.info('📊 Portfolio metrics worker started');
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
