import 'dotenv/config';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { startPricePolling, stopPricePolling } from './services/price-polling.service.js';
import { startBackgroundJobs, stopBackgroundJobs } from './services/background-jobs.service.js';
import { startPortfolioMetricsWorker, stopPortfolioMetricsWorker } from './services/portfolio-metrics.service.js';

async function main() {
  // Connect to database
  await connectDatabase();

  // Build Fastify app
  const app = await buildApp();

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      stopPricePolling();
      stopBackgroundJobs();
      stopPortfolioMetricsWorker();
      await app.close();
      await disconnectDatabase();
      process.exit(0);
    });
  });

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
