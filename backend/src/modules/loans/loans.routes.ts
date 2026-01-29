import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import { getCurrentPrices } from '../../services/price-fetcher.service.js';
import { getAssetLayer } from '../portfolio/portfolio.service.js';
import {
  LTV_BY_LAYER,
  INTEREST_RATE,
  PORTFOLIO_LOAN_LIMIT,
  type AssetId,
} from '../../types/domain.js';
import {
  toDecimal,
  multiply,
  add,
  subtract,
  divide,
  roundIrr,
  toNumber,
  calculateLtv,
  calculateMaxLoan,
  calculateSimpleInterestMonthly,
  isGreaterThan,
  isGreaterThanOrEqual,
  min,
  max,
  Decimal,
  formatIrrCompact,
} from '../../utils/money.js';

const createLoanSchema = z.object({
  collateralAssetId: z.string().min(1),
  amountIrr: z.number().min(1000000),
  // Fastify coerces to number, so just validate as number literal
  durationMonths: z.union([z.literal(3), z.literal(6)]),
});

const repaySchema = z.object({
  amountIrr: z.number().min(1),
});

export const loansRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', authenticate);

  // GET /api/v1/loans
  app.get('/', {
    schema: {
      description: 'List all loans',
      tags: ['Loans'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const portfolio = await prisma.portfolio.findUnique({
        where: { userId: request.userId },
      });

      if (!portfolio) {
        throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
      }

      const loans = await prisma.loan.findMany({
        where: { portfolioId: portfolio.id },
        include: { installments: true },
        orderBy: { createdAt: 'desc' },
      });

      return loans.map((loan) => {
        // MONEY FIX M-02: Use Decimal arithmetic for money calculations
        const totalDue = toDecimal(loan.totalDueIrr);
        const paid = toDecimal(loan.paidIrr);
        const remainingIrr = toNumber(subtract(totalDue, paid));
        const ltvValue = toDecimal(loan.currentLtv || loan.maxLtv);
        const ltvPct = toNumber(multiply(ltvValue, 100));

        return {
          id: loan.id,
          collateralAssetId: loan.collateralAssetId,
          collateralQuantity: Number(loan.collateralQuantity),
          collateralValueIrr: Number(loan.collateralValueIrr),
          principalIrr: Number(loan.principalIrr),
          interestRate: Number(loan.interestRate),
          totalInterestIrr: Number(loan.totalInterestIrr),
          totalDueIrr: Number(loan.totalDueIrr),
          durationMonths: loan.durationMonths,
          startDate: loan.startDate.toISOString(),
          dueDate: loan.dueDate.toISOString(),
          paidIrr: Number(loan.paidIrr),
          remainingIrr,
          ltv: ltvPct,
          status: loan.status,
          installments: loan.installments.map((inst) => ({
            number: inst.number,
            dueDate: inst.dueDate.toISOString(),
            totalIrr: Number(inst.totalIrr),
            paidIrr: Number(inst.paidIrr),
            status: inst.status,
          })),
        };
      });
    },
  });

  // POST /api/v1/loans/preview
  // Returns loan calculation preview without creating the loan
  app.post<{
    Body: { collateralAssetId: string; amountIrr: number; durationMonths: number };
  }>('/preview', {
    schema: {
      description: 'Get loan calculation preview',
      tags: ['Loans'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['collateralAssetId', 'amountIrr', 'durationMonths'],
        properties: {
          collateralAssetId: { type: 'string' },
          amountIrr: { type: 'number', minimum: 1000000 },
          durationMonths: { type: 'number', enum: [3, 6] },
        },
      },
    },
    handler: async (request, reply) => {
      const { collateralAssetId, amountIrr, durationMonths } = request.body;

      const portfolio = await prisma.portfolio.findUnique({
        where: { userId: request.userId },
        include: { holdings: true },
      });

      if (!portfolio) {
        throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
      }

      // Find holding
      const holding = portfolio.holdings.find((h) => h.assetId === collateralAssetId);
      if (!holding) {
        throw new AppError('NOT_FOUND', 'Holding not found', 404);
      }

      // Get price
      const prices = await getCurrentPrices();
      const price = prices.get(collateralAssetId as AssetId);
      if (!price) {
        throw new AppError('VALIDATION_ERROR', 'Price not available', 400);
      }

      // Calculate collateral value
      const collateralValueDecimal = roundIrr(multiply(holding.quantity, price.priceIrr));
      const layer = getAssetLayer(collateralAssetId as AssetId);
      const maxLtv = LTV_BY_LAYER[layer];
      const maxLoanDecimal = roundIrr(calculateMaxLoan(collateralValueDecimal, maxLtv));
      const amountDecimal = toDecimal(amountIrr);

      // Calculate interest (simple interest per PRD: 30% APR)
      const totalInterestDecimal = roundIrr(calculateSimpleInterestMonthly(amountDecimal, INTEREST_RATE, durationMonths));
      const totalRepaymentDecimal = roundIrr(add(amountDecimal, totalInterestDecimal));

      // Calculate per-installment amounts (equal monthly payments)
      const numInstallments = durationMonths;
      const installmentPrincipalDecimal = roundIrr(divide(amountDecimal, numInstallments));
      const installmentInterestDecimal = roundIrr(divide(totalInterestDecimal, numInstallments));
      const installmentTotalDecimal = roundIrr(add(installmentPrincipalDecimal, installmentInterestDecimal));

      // Generate installment schedule
      const startDate = new Date();
      const installments = [];
      for (let i = 1; i <= numInstallments; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        installments.push({
          number: i,
          dueDate: dueDate.toISOString(),
          principalIrr: toNumber(installmentPrincipalDecimal),
          interestIrr: toNumber(installmentInterestDecimal),
          totalIrr: toNumber(installmentTotalDecimal),
        });
      }

      return {
        valid: !isGreaterThan(amountDecimal, maxLoanDecimal),
        collateralAssetId,
        collateralValueIrr: toNumber(collateralValueDecimal),
        maxLtv,
        maxLoanIrr: toNumber(maxLoanDecimal),
        principalIrr: amountIrr,
        interestRate: INTEREST_RATE,
        effectiveAPR: INTEREST_RATE * 100,
        durationMonths,
        totalInterestIrr: toNumber(totalInterestDecimal),
        totalRepaymentIrr: toNumber(totalRepaymentDecimal),
        numInstallments,
        installmentAmountIrr: toNumber(installmentTotalDecimal),
        installments,
      };
    },
  });

  // GET /api/v1/loans/capacity
  app.get('/capacity', {
    schema: {
      description: 'Get borrowing capacity',
      tags: ['Loans'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const portfolio = await prisma.portfolio.findUnique({
        where: { userId: request.userId },
        include: {
          holdings: true,
          loans: { where: { status: 'ACTIVE' } },
        },
      });

      if (!portfolio) {
        throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
      }

      const prices = await getCurrentPrices();

      // MONEY FIX M-02: Use Decimal arithmetic for money calculations
      // Calculate portfolio total
      let totalValueDecimal = toDecimal(portfolio.cashIrr);
      for (const holding of portfolio.holdings) {
        const price = prices.get(holding.assetId as AssetId);
        if (price) {
          const holdingValue = multiply(holding.quantity, price.priceIrr);
          totalValueDecimal = totalValueDecimal.plus(holdingValue);
        }
      }

      // 25% portfolio limit
      const maxPortfolioLoanDecimal = roundIrr(multiply(totalValueDecimal, PORTFOLIO_LOAN_LIMIT));

      // Current loans total
      const currentLoansDecimal = portfolio.loans.reduce(
        (sum, loan) => sum.plus(toDecimal(loan.principalIrr)),
        new Decimal(0)
      );

      // Per-asset capacity
      const perAsset = portfolio.holdings
        .filter((h) => !h.frozen)
        .map((holding) => {
          const assetId = holding.assetId as AssetId;
          const layer = getAssetLayer(assetId);
          const maxLtv = LTV_BY_LAYER[layer];
          const price = prices.get(assetId);
          const holdingValueDecimal = price
            ? roundIrr(multiply(holding.quantity, price.priceIrr))
            : new Decimal(0);
          const maxLoanDecimal = roundIrr(calculateMaxLoan(holdingValueDecimal, maxLtv));

          // Check existing loan on this asset
          const existingLoan = portfolio.loans.find(
            (l) => l.collateralAssetId === assetId
          );
          const existingLoanDecimal = existingLoan ? toDecimal(existingLoan.principalIrr) : new Decimal(0);
          const availableLoanDecimal = max(0, subtract(maxLoanDecimal, existingLoanDecimal));

          return {
            assetId,
            layer,
            maxLtv,
            holdingValueIrr: toNumber(holdingValueDecimal),
            maxLoanIrr: toNumber(maxLoanDecimal),
            existingLoanIrr: toNumber(existingLoanDecimal),
            availableLoanIrr: toNumber(availableLoanDecimal),
            frozen: holding.frozen,
          };
        });

      const availableDecimal = max(0, subtract(maxPortfolioLoanDecimal, currentLoansDecimal));

      return {
        maxPortfolioLoanIrr: toNumber(maxPortfolioLoanDecimal),
        maxCapacityIrr: toNumber(maxPortfolioLoanDecimal), // Alias for frontend
        currentLoansIrr: toNumber(currentLoansDecimal),
        availableIrr: toNumber(availableDecimal),
        availableCapacityIrr: toNumber(availableDecimal), // Alias for frontend
        perAsset,
      };
    },
  });

  // POST /api/v1/loans
  app.post<{
    Body: { collateralAssetId: string; amountIrr: number; durationMonths: number };
  }>('/', {
    schema: {
      description: 'Create a new loan',
      tags: ['Loans'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['collateralAssetId', 'amountIrr', 'durationMonths'],
        properties: {
          collateralAssetId: { type: 'string' },
          amountIrr: { type: 'number', minimum: 1000000 },
          // Note: Fastify coerces string to number, so just accept number with enum
          durationMonths: { type: 'number', enum: [3, 6] },
        },
      },
    },
    handler: async (request, reply) => {
      const { collateralAssetId, amountIrr, durationMonths } = request.body;

      // Basic portfolio validation outside transaction (non-critical)
      const portfolioCheck = await prisma.portfolio.findUnique({
        where: { userId: request.userId },
      });

      if (!portfolioCheck) {
        throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
      }

      // SECURITY FIX H-02: All critical validations moved INSIDE transaction
      // to prevent race conditions where concurrent requests could both see
      // frozen=false and collateralize the same asset twice
      const result = await prisma.$transaction(async (tx) => {
        // Lock the holding row with FOR UPDATE to prevent concurrent modifications
        const holdings = await tx.$queryRaw<Array<{
          id: string;
          portfolio_id: string;
          asset_id: string;
          quantity: string; // Prisma returns Decimal as string in raw queries
          frozen: boolean;
          layer: string;
        }>>`
          SELECT id, portfolio_id, asset_id, quantity, frozen, layer
          FROM holdings
          WHERE portfolio_id = ${portfolioCheck.id}::uuid AND asset_id = ${collateralAssetId}
          FOR UPDATE
        `;

        const holding = holdings[0];
        if (!holding) {
          throw new AppError('NOT_FOUND', 'Holding not found', 404);
        }

        // CRITICAL: Check frozen status inside transaction after acquiring lock
        if (holding.frozen) {
          throw new AppError('ASSET_FROZEN', 'Asset is already used as collateral', 400);
        }

        // Re-fetch current price inside transaction
        const prices = await getCurrentPrices();
        const price = prices.get(collateralAssetId as AssetId);
        if (!price) {
          throw new AppError('VALIDATION_ERROR', 'Price not available', 400);
        }

        // MONEY FIX M-02: Use Decimal arithmetic for money calculations
        const collateralValueDecimal = roundIrr(multiply(holding.quantity, price.priceIrr));
        const layer = getAssetLayer(collateralAssetId as AssetId);
        const maxLtv = LTV_BY_LAYER[layer];
        const maxLoanDecimal = roundIrr(calculateMaxLoan(collateralValueDecimal, maxLtv));
        const amountDecimal = toDecimal(amountIrr);

        // Re-validate LTV with fresh data inside transaction
        if (isGreaterThan(amountDecimal, maxLoanDecimal)) {
          throw new AppError(
            'EXCEEDS_ASSET_LTV',
            `Maximum loan for this asset is ${toNumber(maxLoanDecimal).toLocaleString()} IRR`,
            400
          );
        }

        // Fetch portfolio with loans inside transaction for accurate limits
        const portfolio = await tx.portfolio.findUnique({
          where: { id: portfolioCheck.id },
          include: {
            holdings: true,
            loans: { where: { status: 'ACTIVE' } },
          },
        });

        if (!portfolio) {
          throw new AppError('NOT_FOUND', 'Portfolio not found', 404);
        }

        // Calculate portfolio total value with fresh prices
        let totalValueDecimal = toDecimal(portfolio.cashIrr);
        for (const h of portfolio.holdings) {
          const priceData = prices.get(h.assetId as AssetId);
          if (priceData) {
            totalValueDecimal = totalValueDecimal.plus(multiply(h.quantity, priceData.priceIrr));
          }
        }

        const maxPortfolioLoanDecimal = roundIrr(multiply(totalValueDecimal, PORTFOLIO_LOAN_LIMIT));
        const currentLoansDecimal = portfolio.loans.reduce(
          (sum, loan) => sum.plus(toDecimal(loan.principalIrr)),
          new Decimal(0)
        );

        const totalWithNewLoan = add(currentLoansDecimal, amountDecimal);
        if (isGreaterThan(totalWithNewLoan, maxPortfolioLoanDecimal)) {
          const availableDecimal = subtract(maxPortfolioLoanDecimal, currentLoansDecimal);
          throw new AppError(
            'EXCEEDS_PORTFOLIO_LIMIT',
            `Portfolio loan limit exceeded. Maximum available: ${toNumber(availableDecimal).toLocaleString()} IRR`,
            400
          );
        }

        // Calculate interest (simple interest per PRD)
        const totalInterestDecimal = roundIrr(calculateSimpleInterestMonthly(amountDecimal, INTEREST_RATE, durationMonths));
        const totalDueDecimal = roundIrr(add(amountDecimal, totalInterestDecimal));

        const startDate = new Date();
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + durationMonths);

        // Now safe to freeze - we hold the lock
        await tx.holding.update({
          where: { id: holding.id },
          data: { frozen: true },
        });

        // Add cash to portfolio
        await tx.portfolio.update({
          where: { id: portfolio.id },
          data: { cashIrr: { increment: amountIrr } },
        });

        // Calculate LTV ratio
        const currentLtvDecimal = calculateLtv(amountDecimal, collateralValueDecimal);

        // Create loan
        const loan = await tx.loan.create({
          data: {
            portfolioId: portfolio.id,
            collateralAssetId,
            collateralQuantity: holding.quantity,
            collateralValueIrr: toNumber(collateralValueDecimal),
            principalIrr: amountIrr,
            interestRate: INTEREST_RATE,
            durationMonths,
            totalInterestIrr: toNumber(totalInterestDecimal),
            totalDueIrr: toNumber(totalDueDecimal),
            startDate,
            dueDate,
            maxLtv,
            currentLtv: toNumber(currentLtvDecimal),
          },
        });

        // Create installments (monthly) with safe arithmetic
        const installmentPrincipalDecimal = roundIrr(divide(amountDecimal, durationMonths));
        const installmentInterestDecimal = roundIrr(divide(totalInterestDecimal, durationMonths));
        const installmentTotalDecimal = roundIrr(add(installmentPrincipalDecimal, installmentInterestDecimal));

        for (let i = 1; i <= durationMonths; i++) {
          const installmentDueDate = new Date(startDate);
          installmentDueDate.setMonth(installmentDueDate.getMonth() + i);

          await tx.loanInstallment.create({
            data: {
              loanId: loan.id,
              number: i,
              dueDate: installmentDueDate,
              principalIrr: toNumber(installmentPrincipalDecimal),
              interestIrr: toNumber(installmentInterestDecimal),
              totalIrr: toNumber(installmentTotalDecimal),
            },
          });
        }

        // Create ledger entry
        await tx.ledgerEntry.create({
          data: {
            portfolioId: portfolio.id,
            entryType: 'LOAN_CREATE',
            beforeSnapshot: { cashIrr: Number(portfolio.cashIrr) },
            afterSnapshot: { cashIrr: Number(portfolio.cashIrr) + amountIrr },
            amountIrr,
            assetId: collateralAssetId,
            loanId: loan.id,
            boundary: 'SAFE',
            message: `Borrowed ${formatIrrCompact(amountIrr)} against ${collateralAssetId}`,
          },
        });

        // Create action log for Activity Feed
        await tx.actionLog.create({
          data: {
            portfolioId: portfolio.id,
            actionType: 'LOAN_CREATE',
            boundary: 'SAFE',
            message: `Borrowed ${formatIrrCompact(amountIrr)} against ${collateralAssetId}`,
            amountIrr,
            assetId: collateralAssetId,
          },
        });

        return loan;
      });

      return {
        loan: {
          id: result.id,
          collateralAssetId: result.collateralAssetId,
          principalIrr: Number(result.principalIrr),
          totalDueIrr: Number(result.totalDueIrr),
          durationMonths: result.durationMonths,
          status: result.status,
        },
        cashAdded: amountIrr,
        holdingFrozen: true,
      };
    },
  });

  // GET /api/v1/loans/:id
  app.get<{ Params: { id: string } }>('/:id', {
    schema: {
      description: 'Get loan details',
      tags: ['Loans'],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const loan = await prisma.loan.findUnique({
        where: { id: request.params.id },
        include: { installments: true, portfolio: true },
      });

      if (!loan || loan.portfolio.userId !== request.userId) {
        throw new AppError('NOT_FOUND', 'Loan not found', 404);
      }

      // MONEY FIX M-02: Use Decimal arithmetic for money calculations
      const totalDueDecimal = toDecimal(loan.totalDueIrr);
      const paidDecimal = toDecimal(loan.paidIrr);
      const remainingDecimal = subtract(totalDueDecimal, paidDecimal);
      const ltvDecimal = toDecimal(loan.currentLtv || loan.maxLtv);
      const ltvPctDecimal = multiply(ltvDecimal, 100);

      return {
        id: loan.id,
        collateralAssetId: loan.collateralAssetId,
        collateralQuantity: Number(loan.collateralQuantity),
        collateralValueIrr: Number(loan.collateralValueIrr),
        principalIrr: Number(loan.principalIrr),
        interestRate: Number(loan.interestRate),
        totalInterestIrr: Number(loan.totalInterestIrr),
        totalDueIrr: Number(loan.totalDueIrr),
        durationMonths: loan.durationMonths,
        startDate: loan.startDate.toISOString(),
        dueDate: loan.dueDate.toISOString(),
        paidIrr: Number(loan.paidIrr),
        remainingIrr: toNumber(remainingDecimal),
        ltv: toNumber(ltvPctDecimal),
        status: loan.status,
        installments: loan.installments
          .sort((a, b) => a.number - b.number)
          .map((inst) => ({
            number: inst.number,
            dueDate: inst.dueDate.toISOString(),
            principalIrr: Number(inst.principalIrr),
            interestIrr: Number(inst.interestIrr),
            totalIrr: Number(inst.totalIrr),
            paidIrr: Number(inst.paidIrr),
            status: inst.status,
          })),
      };
    },
  });

  // POST /api/v1/loans/:id/repay
  app.post<{ Params: { id: string }; Body: { amountIrr: number } }>('/:id/repay', {
    schema: {
      description: 'Make loan repayment',
      tags: ['Loans'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['amountIrr'],
        properties: {
          amountIrr: { type: 'number', minimum: 1 },
        },
      },
    },
    handler: async (request, reply) => {
      const { amountIrr } = repaySchema.parse(request.body);
      const loanId = request.params.id;

      // Basic ownership check outside transaction
      const loanCheck = await prisma.loan.findUnique({
        where: { id: loanId },
        include: { portfolio: true },
      });

      if (!loanCheck || loanCheck.portfolio.userId !== request.userId) {
        throw new AppError('NOT_FOUND', 'Loan not found', 404);
      }

      // SECURITY FIX M-01: All critical operations inside transaction
      // to prevent concurrent repayments from using stale data
      const result = await prisma.$transaction(async (tx) => {
        // Lock loan row with FOR UPDATE to prevent concurrent modifications
        const loans = await tx.$queryRaw<Array<{
          id: string;
          portfolio_id: string;
          collateral_asset_id: string;
          total_due_irr: string; // Prisma returns Decimal as string in raw queries
          paid_irr: string;      // Prisma returns Decimal as string in raw queries
          status: string;
        }>>`
          SELECT id, portfolio_id, collateral_asset_id, total_due_irr, paid_irr, status
          FROM loans
          WHERE id = ${loanId}::uuid
          FOR UPDATE
        `;

        const loan = loans[0];
        if (!loan) {
          throw new AppError('NOT_FOUND', 'Loan not found', 404);
        }

        if (loan.status !== 'ACTIVE') {
          throw new AppError('VALIDATION_ERROR', 'Loan is not active', 400);
        }

        // Fetch installments inside transaction
        const installments = await tx.loanInstallment.findMany({
          where: { loanId: loan.id },
          orderBy: { number: 'asc' },
        });

        // Check cash balance inside transaction
        const portfolio = await tx.portfolio.findUnique({
          where: { id: loan.portfolio_id },
        });

        // MONEY FIX M-02: Use Decimal arithmetic for money calculations
        const amountDecimal = toDecimal(amountIrr);
        const cashDecimal = toDecimal(portfolio?.cashIrr || 0);

        if (!portfolio || isGreaterThan(amountDecimal, cashDecimal)) {
          throw new AppError('INSUFFICIENT_CASH', 'Not enough cash balance', 400);
        }

        // Calculate with fresh data from locked row
        const totalDueDecimal = toDecimal(loan.total_due_irr);
        const currentPaidDecimal = toDecimal(loan.paid_irr);
        const remainingDueDecimal = subtract(totalDueDecimal, currentPaidDecimal);
        const amountToApplyDecimal = min(amountDecimal, remainingDueDecimal);
        const amountToApply = toNumber(amountToApplyDecimal);

        // Deduct from cash
        await tx.portfolio.update({
          where: { id: loan.portfolio_id },
          data: { cashIrr: { decrement: amountToApply } },
        });

        // Update loan with fresh calculations
        const newPaidDecimal = add(currentPaidDecimal, amountToApplyDecimal);
        const isFullySettled = isGreaterThanOrEqual(newPaidDecimal, totalDueDecimal);

        await tx.loan.update({
          where: { id: loan.id },
          data: {
            paidIrr: toNumber(newPaidDecimal),
            status: isFullySettled ? 'REPAID' : 'ACTIVE',
          },
        });

        // Apply to installments
        let remainingPaymentDecimal = amountToApplyDecimal;
        let installmentsPaid = 0;

        for (const inst of installments) {
          if (remainingPaymentDecimal.lessThanOrEqualTo(0)) break;
          if (inst.status === 'PAID') continue;

          const instTotalDecimal = toDecimal(inst.totalIrr);
          const instPaidDecimal = toDecimal(inst.paidIrr);
          const instRemainingDecimal = subtract(instTotalDecimal, instPaidDecimal);
          const paymentToInstDecimal = min(remainingPaymentDecimal, instRemainingDecimal);

          const newInstPaidDecimal = add(instPaidDecimal, paymentToInstDecimal);
          const instFullyPaid = isGreaterThanOrEqual(newInstPaidDecimal, instTotalDecimal);

          await tx.loanInstallment.update({
            where: { id: inst.id },
            data: {
              paidIrr: toNumber(newInstPaidDecimal),
              status: instFullyPaid ? 'PAID' : isGreaterThan(newInstPaidDecimal, 0) ? 'PARTIAL' : 'PENDING',
              paidAt: instFullyPaid ? new Date() : null,
            },
          });

          if (instFullyPaid) installmentsPaid++;
          remainingPaymentDecimal = remainingPaymentDecimal.minus(paymentToInstDecimal);
        }

        // Update installmentsPaid counter on loan
        const paidCount = await tx.loanInstallment.count({
          where: { loanId: loan.id, status: 'PAID' },
        });
        await tx.loan.update({
          where: { id: loan.id },
          data: { installmentsPaid: paidCount },
        });

        // Unfreeze collateral if fully settled
        if (isFullySettled) {
          await tx.holding.updateMany({
            where: {
              portfolioId: loan.portfolio_id,
              assetId: loan.collateral_asset_id,
              frozen: true,
            },
            data: { frozen: false },
          });
        }

        // Create ledger entry
        await tx.ledgerEntry.create({
          data: {
            portfolioId: loan.portfolio_id,
            entryType: 'LOAN_REPAY',
            beforeSnapshot: { paidIrr: toNumber(currentPaidDecimal) },
            afterSnapshot: { paidIrr: toNumber(newPaidDecimal) },
            amountIrr: amountToApply,
            loanId: loan.id,
            boundary: 'SAFE',
            message: `Repaid ${formatIrrCompact(amountToApply)} on ${loan.collateral_asset_id} loan`,
          },
        });

        // Create action log for Activity Feed
        await tx.actionLog.create({
          data: {
            portfolioId: loan.portfolio_id,
            actionType: 'LOAN_REPAY',
            boundary: 'SAFE',
            message: isFullySettled
              ? `Settled ${loan.collateral_asset_id} loan (${formatIrrCompact(amountToApply)})`
              : `Repaid ${formatIrrCompact(amountToApply)} · ${loan.collateral_asset_id} loan (${installmentsPaid}/6)`,
            amountIrr: amountToApply,
            assetId: loan.collateral_asset_id,
          },
        });

        // Calculate remaining due after payment
        const remainingAfterPayment = subtract(remainingDueDecimal, amountToApplyDecimal);

        return {
          success: true,
          amountApplied: amountToApply,
          remainingDue: toNumber(remainingAfterPayment),
          remainingBalance: toNumber(remainingAfterPayment), // Alias for frontend
          installmentsPaid,
          isFullySettled,
          collateralUnfrozen: isFullySettled,
        };
      });

      return result;
    },
  });
};
