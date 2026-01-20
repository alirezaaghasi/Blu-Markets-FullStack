import { updateAllPrices } from '../services/price-fetcher.service.js';
import { cleanupExpiredOtps } from '../modules/auth/otp.service.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

// Worker entry point for background jobs

const PRICE_UPDATE_INTERVAL = 30 * 1000; // 30 seconds
const OTP_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

async function runPriceUpdater() {
  console.log('💹 Starting price updater...');

  // Initial update
  await updateAllPrices();

  // Schedule updates
  setInterval(async () => {
    try {
      await updateAllPrices();
    } catch (error) {
      console.error('Price update failed:', error);
    }
  }, PRICE_UPDATE_INTERVAL);
}

async function runCleanupJobs() {
  console.log('🧹 Starting cleanup jobs...');

  // Schedule OTP cleanup
  setInterval(async () => {
    try {
      const count = await cleanupExpiredOtps();
      if (count > 0) {
        console.log(`Cleaned up ${count} expired OTP codes`);
      }
    } catch (error) {
      console.error('OTP cleanup failed:', error);
    }
  }, OTP_CLEANUP_INTERVAL);
}

async function main() {
  await connectDatabase();

  console.log('🔧 Worker started');

  // Run all background jobs
  await Promise.all([
    runPriceUpdater(),
    runCleanupJobs(),
  ]);

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`Received ${signal}, shutting down worker...`);
      await disconnectDatabase();
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('Worker failed:', error);
  process.exit(1);
});
