import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Asset data per PRD
const assets = [
  // Foundation Layer
  { id: 'USDT', name: 'Tether USD', layer: 'FOUNDATION', layerWeight: 0.33, maxLtv: 0.70, coingeckoId: 'tether', protectionEligible: false },
  { id: 'PAXG', name: 'Paxos Gold', layer: 'FOUNDATION', layerWeight: 0.33, maxLtv: 0.70, coingeckoId: 'pax-gold', protectionEligible: false },
  { id: 'IRR_FIXED_INCOME', name: 'Fixed Income', layer: 'FOUNDATION', layerWeight: 0.34, maxLtv: 0.70, isInternal: true, defaultPriceUsd: 0, protectionEligible: false },

  // Growth Layer
  { id: 'BTC', name: 'Bitcoin', layer: 'GROWTH', layerWeight: 0.25, maxLtv: 0.50, coingeckoId: 'bitcoin', protectionEligible: true, protectionRate: 0.008 },
  { id: 'ETH', name: 'Ethereum', layer: 'GROWTH', layerWeight: 0.25, maxLtv: 0.50, coingeckoId: 'ethereum', protectionEligible: true, protectionRate: 0.008 },
  { id: 'BNB', name: 'BNB', layer: 'GROWTH', layerWeight: 0.10, maxLtv: 0.50, coingeckoId: 'binancecoin', protectionEligible: false },
  { id: 'XRP', name: 'XRP', layer: 'GROWTH', layerWeight: 0.10, maxLtv: 0.50, coingeckoId: 'ripple', protectionEligible: false },
  { id: 'GOLD', name: 'Gold', layer: 'GROWTH', layerWeight: 0.15, maxLtv: 0.50, coingeckoId: 'pax-gold', protectionEligible: true, protectionRate: 0.008 },
  { id: 'QQQ', name: 'Invesco QQQ', layer: 'GROWTH', layerWeight: 0.15, maxLtv: 0.50, finnhubSymbol: 'QQQ', protectionEligible: true, protectionRate: 0.008 },

  // Upside Layer
  { id: 'SOL', name: 'Solana', layer: 'UPSIDE', layerWeight: 0.20, maxLtv: 0.30, coingeckoId: 'solana', protectionEligible: true, protectionRate: 0.012 },
  { id: 'TON', name: 'Toncoin', layer: 'UPSIDE', layerWeight: 0.15, maxLtv: 0.30, coingeckoId: 'the-open-network', protectionEligible: false },
  { id: 'LINK', name: 'Chainlink', layer: 'UPSIDE', layerWeight: 0.15, maxLtv: 0.30, coingeckoId: 'chainlink', protectionEligible: false },
  { id: 'AVAX', name: 'Avalanche', layer: 'UPSIDE', layerWeight: 0.15, maxLtv: 0.30, coingeckoId: 'avalanche-2', protectionEligible: false },
  { id: 'MATIC', name: 'Polygon', layer: 'UPSIDE', layerWeight: 0.20, maxLtv: 0.30, coingeckoId: 'matic-network', protectionEligible: false },
  { id: 'ARB', name: 'Arbitrum', layer: 'UPSIDE', layerWeight: 0.15, maxLtv: 0.30, coingeckoId: 'arbitrum', protectionEligible: false },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Seed assets
  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { id: asset.id },
      update: {},
      create: {
        id: asset.id,
        name: asset.name,
        layer: asset.layer as 'FOUNDATION' | 'GROWTH' | 'UPSIDE',
        layerWeight: asset.layerWeight,
        maxLtv: asset.maxLtv,
        coingeckoId: asset.coingeckoId,
        finnhubSymbol: asset.finnhubSymbol,
        isInternal: asset.isInternal || false,
        defaultPriceUsd: asset.defaultPriceUsd,
        protectionEligible: asset.protectionEligible,
        protectionRate: asset.protectionRate,
        minTradeIrr: 1000000,
        spread: 0.003,
      },
    });
  }

  console.log(`✅ Seeded ${assets.length} assets`);

  // Seed initial prices (these will be updated by the price fetcher)
  const initialPrices = [
    { assetId: 'BTC', priceUsd: 97500, priceIrr: 142035000000 },
    { assetId: 'ETH', priceUsd: 3200, priceIrr: 4659200000 },
    { assetId: 'SOL', priceUsd: 180, priceIrr: 262080000 },
    { assetId: 'TON', priceUsd: 5.5, priceIrr: 8008000 },
    { assetId: 'USDT', priceUsd: 1, priceIrr: 1456000 },
    { assetId: 'PAXG', priceUsd: 2650, priceIrr: 3858400000 },
    { assetId: 'BNB', priceUsd: 680, priceIrr: 990080000 },
    { assetId: 'XRP', priceUsd: 2.4, priceIrr: 3494400 },
    { assetId: 'GOLD', priceUsd: 2650, priceIrr: 3858400000 },
    { assetId: 'QQQ', priceUsd: 520, priceIrr: 757120000 },
    { assetId: 'LINK', priceUsd: 22, priceIrr: 32032000 },
    { assetId: 'AVAX', priceUsd: 35, priceIrr: 50960000 },
    { assetId: 'MATIC', priceUsd: 0.45, priceIrr: 655200 },
    { assetId: 'ARB', priceUsd: 0.85, priceIrr: 1237600 },
    { assetId: 'IRR_FIXED_INCOME', priceUsd: 0, priceIrr: 500000 },
  ];

  for (const price of initialPrices) {
    await prisma.price.upsert({
      where: { assetId: price.assetId },
      update: {},
      create: {
        assetId: price.assetId,
        priceUsd: price.priceUsd,
        priceIrr: price.priceIrr,
        fxRate: 1456000,
        fxSource: 'seed',
        source: 'seed',
        fetchedAt: new Date(),
      },
    });
  }

  console.log(`✅ Seeded ${initialPrices.length} initial prices`);
  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
