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
  { id: 'KAG', name: 'Kinesis Silver', layer: 'GROWTH', layerWeight: 0.15, maxLtv: 0.50, coingeckoId: 'kinesis-silver', protectionEligible: true, protectionRate: 0.008 },
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
    { assetId: 'BTC', priceUsd: 97500, priceIrr: 60450000000 },
    { assetId: 'ETH', priceUsd: 3200, priceIrr: 1984000000 },
    { assetId: 'SOL', priceUsd: 180, priceIrr: 111600000 },
    { assetId: 'TON', priceUsd: 5.5, priceIrr: 3410000 },
    { assetId: 'USDT', priceUsd: 1, priceIrr: 620000 },
    { assetId: 'PAXG', priceUsd: 2650, priceIrr: 1643000000 },
    { assetId: 'BNB', priceUsd: 680, priceIrr: 421600000 },
    { assetId: 'XRP', priceUsd: 2.4, priceIrr: 1488000 },
    { assetId: 'KAG', priceUsd: 2650, priceIrr: 1643000000 },
    { assetId: 'QQQ', priceUsd: 520, priceIrr: 322400000 },
    { assetId: 'LINK', priceUsd: 22, priceIrr: 13640000 },
    { assetId: 'AVAX', priceUsd: 35, priceIrr: 21700000 },
    { assetId: 'MATIC', priceUsd: 0.45, priceIrr: 279000 },
    { assetId: 'ARB', priceUsd: 0.85, priceIrr: 527000 },
    { assetId: 'IRR_FIXED_INCOME', priceUsd: 0, priceIrr: 500000 },
  ];

  const FX_RATE = 620000;

  for (const price of initialPrices) {
    await prisma.price.upsert({
      where: { assetId: price.assetId },
      update: {},
      create: {
        assetId: price.assetId,
        priceUsd: price.priceUsd,
        priceIrr: price.priceIrr,
        fxRate: FX_RATE,
        fxSource: 'seed',
        source: 'seed',
        fetchedAt: new Date(),
      },
    });
  }

  console.log(`✅ Seeded ${initialPrices.length} initial prices`);

  // ==========================================================================
  // DEMO USER FOR DEVELOPMENT TESTING
  // ==========================================================================

  const DEMO_PHONE = '+989123456789';

  // Create or update demo user
  const demoUser = await prisma.user.upsert({
    where: { phone: DEMO_PHONE },
    update: {},
    create: {
      phone: DEMO_PHONE,
      phoneVerified: true,
      riskScore: 65,
      riskTier: 'MEDIUM',
      riskProfileName: 'Balanced Investor',
      targetFoundation: 0.50,
      targetGrowth: 0.35,
      targetUpside: 0.15,
      consentRisk: true,
      consentLoss: true,
      consentNoGuarantee: true,
      consentTimestamp: new Date(),
    },
  });

  console.log(`✅ Created demo user: ${demoUser.phone}`);

  // Create or update demo portfolio
  const demoPortfolio = await prisma.portfolio.upsert({
    where: { userId: demoUser.id },
    update: {
      cashIrr: 50000000, // 50M IRR cash
    },
    create: {
      userId: demoUser.id,
      cashIrr: 50000000, // 50M IRR cash
      status: 'BALANCED',
    },
  });

  console.log(`✅ Created demo portfolio with 50M IRR cash`);

  // Clear existing holdings for demo user and recreate
  await prisma.holding.deleteMany({ where: { portfolioId: demoPortfolio.id } });

  // Demo holdings representing a balanced portfolio worth ~500M IRR
  const demoHoldings = [
    // Foundation Layer (~50% = 250M IRR)
    { assetId: 'USDT', quantity: 200, frozen: false, layer: 'FOUNDATION' as const }, // ~200 USDT = ~124M IRR
    { assetId: 'PAXG', quantity: 0.05, frozen: false, layer: 'FOUNDATION' as const }, // ~0.05 oz gold = ~82M IRR
    { assetId: 'IRR_FIXED_INCOME', quantity: 100, frozen: false, layer: 'FOUNDATION' as const }, // 100 units = ~50M IRR

    // Growth Layer (~35% = 175M IRR)
    { assetId: 'BTC', quantity: 0.001, frozen: false, layer: 'GROWTH' as const }, // ~0.001 BTC = ~60M IRR
    { assetId: 'ETH', quantity: 0.03, frozen: false, layer: 'GROWTH' as const }, // ~0.03 ETH = ~60M IRR
    { assetId: 'BNB', quantity: 0.1, frozen: true, layer: 'GROWTH' as const }, // Frozen as collateral ~42M IRR

    // Upside Layer (~15% = 75M IRR)
    { assetId: 'SOL', quantity: 0.4, frozen: false, layer: 'UPSIDE' as const }, // ~0.4 SOL = ~45M IRR
    { assetId: 'TON', quantity: 8, frozen: false, layer: 'UPSIDE' as const }, // ~8 TON = ~27M IRR
  ];

  for (const holding of demoHoldings) {
    await prisma.holding.create({
      data: {
        portfolioId: demoPortfolio.id,
        assetId: holding.assetId,
        quantity: holding.quantity,
        frozen: holding.frozen,
        layer: holding.layer,
      },
    });
  }

  console.log(`✅ Created ${demoHoldings.length} demo holdings`);

  // Clear and recreate demo protection
  await prisma.protection.deleteMany({ where: { portfolioId: demoPortfolio.id } });

  const protectionStart = new Date();
  const protectionEnd = new Date();
  protectionEnd.setMonth(protectionEnd.getMonth() + 3);

  await prisma.protection.create({
    data: {
      portfolioId: demoPortfolio.id,
      assetId: 'BTC',
      notionalIrr: 60000000, // 60M IRR protected
      premiumIrr: 1440000, // 0.8% monthly * 3 months
      durationMonths: 3,
      startDate: protectionStart,
      endDate: protectionEnd,
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Created demo BTC protection`);

  // Clear and recreate demo loan with installments
  await prisma.loanInstallment.deleteMany({
    where: { loan: { portfolioId: demoPortfolio.id } },
  });
  await prisma.loan.deleteMany({ where: { portfolioId: demoPortfolio.id } });

  const loanStart = new Date();
  const loanDue = new Date();
  loanDue.setMonth(loanDue.getMonth() + 3);

  const demoLoan = await prisma.loan.create({
    data: {
      portfolioId: demoPortfolio.id,
      collateralAssetId: 'BNB',
      collateralQuantity: 0.1,
      collateralValueIrr: 42160000, // ~42M IRR worth of BNB
      principalIrr: 21000000, // ~50% LTV = 21M IRR loan
      interestRate: 0.18, // 18% APR
      totalInterestIrr: 945000, // ~4.5% for 3 months
      totalDueIrr: 21945000,
      durationMonths: 3,
      startDate: loanStart,
      dueDate: loanDue,
      paidIrr: 0,
      maxLtv: 0.50,
      status: 'ACTIVE',
    },
  });

  // Create installments for the loan
  const installmentDates = [
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  ];

  for (let i = 0; i < 3; i++) {
    await prisma.loanInstallment.create({
      data: {
        loanId: demoLoan.id,
        number: i + 1,
        dueDate: installmentDates[i],
        principalIrr: 7000000, // ~7M principal per installment
        interestIrr: 315000, // ~315K interest per installment
        totalIrr: 7315000,
        paidIrr: 0,
        status: 'PENDING',
      },
    });
  }

  console.log(`✅ Created demo loan with BNB collateral and 3 installments`);

  // Clear and add some action log entries
  await prisma.actionLog.deleteMany({ where: { portfolioId: demoPortfolio.id } });

  const actionEntries = [
    { actionType: 'ADD_FUNDS', boundary: 'SAFE' as const, message: 'Added 100M IRR to portfolio', amountIrr: 100000000 },
    { actionType: 'TRADE', boundary: 'SAFE' as const, message: 'Bought 0.001 BTC', amountIrr: 60450000, assetId: 'BTC' },
    { actionType: 'TRADE', boundary: 'SAFE' as const, message: 'Bought 200 USDT', amountIrr: 124000000, assetId: 'USDT' },
    { actionType: 'PROTECTION', boundary: 'SAFE' as const, message: 'Activated BTC downside protection', amountIrr: 1440000, assetId: 'BTC' },
    { actionType: 'LOAN', boundary: 'DRIFT' as const, message: 'Took loan against BNB holdings', amountIrr: 21000000, assetId: 'BNB' },
  ];

  for (let i = 0; i < actionEntries.length; i++) {
    const entry = actionEntries[i];
    await prisma.actionLog.create({
      data: {
        portfolioId: demoPortfolio.id,
        actionType: entry.actionType,
        boundary: entry.boundary,
        message: entry.message,
        amountIrr: entry.amountIrr,
        assetId: entry.assetId,
        createdAt: new Date(Date.now() - (actionEntries.length - i) * 24 * 60 * 60 * 1000), // Stagger dates
      },
    });
  }

  console.log(`✅ Created ${actionEntries.length} action log entries`);

  // Add some ledger entries
  await prisma.ledgerEntry.deleteMany({ where: { portfolioId: demoPortfolio.id } });

  await prisma.ledgerEntry.create({
    data: {
      portfolioId: demoPortfolio.id,
      entryType: 'ADD_FUNDS',
      amountIrr: 100000000,
      boundary: 'SAFE',
      message: 'Initial funding',
      beforeSnapshot: { cashIrr: 0, totalValueIrr: 0, allocation: { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 } },
      afterSnapshot: { cashIrr: 100000000, totalValueIrr: 100000000, allocation: { FOUNDATION: 1, GROWTH: 0, UPSIDE: 0 } },
    },
  });

  console.log(`✅ Created ledger entries`);

  console.log('\n🎉 Database seeding complete!');
  console.log(`\n📱 Demo user credentials:`);
  console.log(`   Phone: ${DEMO_PHONE}`);
  console.log(`   OTP: 99999 (fake OTP for testing)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
