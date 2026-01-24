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

const createLoanSchema = z.object({
  collateralAssetId: z.string().min(1),
  amountIrr: z.number().min(1000000),
  // Accept both number and string, normalize to number
  durationMonths: z.union([
    z.literal(3),
    z.literal(6),
    z.enum(['3', '6']).transform(Number),
  ]).transform((v) => Number(v) as 3 | 6),
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

      return loans.map((loan) => ({
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
        remainingIrr: Number(loan.totalDueIrr) - Number(loan.paidIrr),
        ltv: Number(loan.currentLtv || loan.maxLtv) * 100,
        status: loan.status,
        installments: loan.installments.map((inst) => ({
          number: inst.number,
          dueDate: inst.dueDate.toISOString(),
          totalIrr: Number(inst.totalIrr),
          paidIrr: Number(inst.paidIrr),
          status: inst.status,
        })),
      }));
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

      // Calculate portfolio total
      let totalValueIrr = Number(portfolio.cashIrr);
      for (const holding of portfolio.holdings) {
        const price = prices.get(holding.assetId as AssetId);
        if (price) {
          totalValueIrr += Number(holding.quantity) * price.priceIrr;
        }
      }

      // 25% portfolio limit
      const maxPortfolioLoanIrr = totalValueIrr * PORTFOLIO_LOAN_LIMIT;

      // Current loans total
      const currentLoansIrr = portfolio.loans.reduce(
        (sum, loan) => sum + Number(loan.principalIrr),
        0
      );

      // Per-asset capacity
      const perAsset = portfolio.holdings
        .filter((h) => !h.frozen)
        .map((holding) => {
          const assetId = holding.assetId as AssetId;
          const layer = getAssetLayer(assetId);
          const maxLtv = LTV_BY_LAYER[layer];
          const price = prices.get(assetId);
          const holdingValueIrr = price ? Number(holding.quantity) * price.priceIrr : 0;
          const maxLoanIrr = holdingValueIrr * maxLtv;

          // Check existing loan on this asset
          const existingLoan = portfolio.loans.find(
            (l) => l.collateralAssetId === assetId
          );
          const existingLoanIrr = existingLoan ? Number(existingLoan.principalIrr) : 0;

          return {
            assetId,
            layer,
            maxLtv,
            holdingValueIrr,
            maxLoanIrr,
            existingLoanIrr,
            availableLoanIrr: Math.max(0, maxLoanIrr - existingLoanIrr),
            frozen: holding.frozen,
          };
        });

      return {
        maxPortfolioLoanIrr,
        currentLoansIrr,
        availableIrr: Math.max(0, maxPortfolioLoanIrr - currentLoansIrr),
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
          // Accept both number and string for durationMonths
          durationMonths: { oneOf: [
            { type: 'number', enum: [3, 6] },
            { type: 'string', enum: ['3', '6'] },
          ]},
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
          quantity: any;
          frozen: boolean;
          layer: string;
        }>>`
          SELECT id, portfolio_id, asset_id, quantity, frozen, layer
          FROM holdings
          WHERE portfolio_id = ${portfolioCheck.id} AND asset_id = ${collateralAssetId}
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

        const collateralValueIrr = Number(holding.quantity) * price.priceIrr;
        const layer = getAssetLayer(collateralAssetId as AssetId);
        const maxLtv = LTV_BY_LAYER[layer];
        const maxLoanIrr = collateralValueIrr * maxLtv;

        // Re-validate LTV with fresh data inside transaction
        if (amountIrr > maxLoanIrr) {
          throw new AppError(
            'EXCEEDS_ASSET_LTV',
            `Maximum loan for this asset is ${Math.floor(maxLoanIrr).toLocaleString()} IRR`,
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
        let totalValueIrr = Number(portfolio.cashIrr);
        for (const h of portfolio.holdings) {
          const priceData = prices.get(h.assetId as AssetId);
          if (priceData) totalValueIrr += Number(h.quantity) * priceData.priceIrr;
        }

        const maxPortfolioLoanIrr = totalValueIrr * PORTFOLIO_LOAN_LIMIT;
        const currentLoansIrr = portfolio.loans.reduce((sum, loan) => sum + Number(loan.principalIrr), 0);

        if (currentLoansIrr + amountIrr > maxPortfolioLoanIrr) {
          throw new AppError(
            'EXCEEDS_PORTFOLIO_LIMIT',
            `Portfolio loan limit exceeded. Maximum available: ${Math.floor(maxPortfolioLoanIrr - currentLoansIrr).toLocaleString()} IRR`,
            400
          );
        }

        // Calculate interest (simple interest per PRD)
        const annualInterest = amountIrr * INTEREST_RATE;
        const totalInterestIrr = (annualInterest * durationMonths) / 12;
        const totalDueIrr = amountIrr + totalInterestIrr;

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

        // Create loan
        const loan = await tx.loan.create({
          data: {
            portfolioId: portfolio.id,
            collateralAssetId,
            collateralQuantity: holding.quantity,
            collateralValueIrr,
            principalIrr: amountIrr,
            interestRate: INTEREST_RATE,
            durationMonths,
            totalInterestIrr,
            totalDueIrr,
            startDate,
            dueDate,
            maxLtv,
            currentLtv: amountIrr / collateralValueIrr,
          },
        });

        // Create installments (monthly)
        const installmentPrincipal = amountIrr / durationMonths;
        const installmentInterest = totalInterestIrr / durationMonths;
        const installmentTotal = installmentPrincipal + installmentInterest;

        for (let i = 1; i <= durationMonths; i++) {
          const installmentDueDate = new Date(startDate);
          installmentDueDate.setMonth(installmentDueDate.getMonth() + i);

          await tx.loanInstallment.create({
            data: {
              loanId: loan.id,
              number: i,
              dueDate: installmentDueDate,
              principalIrr: installmentPrincipal,
              interestIrr: installmentInterest,
              totalIrr: installmentTotal,
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
            message: `Loan created: ${amountIrr.toLocaleString()} IRR against ${collateralAssetId}`,
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
        remainingIrr: Number(loan.totalDueIrr) - Number(loan.paidIrr),
        ltv: Number(loan.currentLtv || loan.maxLtv) * 100,
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
          total_due_irr: any;
          paid_irr: any;
          status: string;
        }>>`
          SELECT id, portfolio_id, collateral_asset_id, total_due_irr, paid_irr, status
          FROM loans
          WHERE id = ${loanId}
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

        if (!portfolio || amountIrr > Number(portfolio.cashIrr)) {
          throw new AppError('INSUFFICIENT_CASH', 'Not enough cash balance', 400);
        }

        // Calculate with fresh data from locked row
        const totalDueIrr = Number(loan.total_due_irr);
        const currentPaidIrr = Number(loan.paid_irr);
        const remainingDue = totalDueIrr - currentPaidIrr;
        const amountToApply = Math.min(amountIrr, remainingDue);

        // Deduct from cash
        await tx.portfolio.update({
          where: { id: loan.portfolio_id },
          data: { cashIrr: { decrement: amountToApply } },
        });

        // Update loan with fresh calculations
        const newPaidIrr = currentPaidIrr + amountToApply;
        const isFullySettled = newPaidIrr >= totalDueIrr;

        await tx.loan.update({
          where: { id: loan.id },
          data: {
            paidIrr: newPaidIrr,
            status: isFullySettled ? 'REPAID' : 'ACTIVE',
          },
        });

        // Apply to installments
        let remainingPayment = amountToApply;
        let installmentsPaid = 0;

        for (const inst of installments) {
          if (remainingPayment <= 0) break;
          if (inst.status === 'PAID') continue;

          const instRemaining = Number(inst.totalIrr) - Number(inst.paidIrr);
          const paymentToInst = Math.min(remainingPayment, instRemaining);

          const newInstPaid = Number(inst.paidIrr) + paymentToInst;
          const instFullyPaid = newInstPaid >= Number(inst.totalIrr);

          await tx.loanInstallment.update({
            where: { id: inst.id },
            data: {
              paidIrr: newInstPaid,
              status: instFullyPaid ? 'PAID' : newInstPaid > 0 ? 'PARTIAL' : 'PENDING',
              paidAt: instFullyPaid ? new Date() : null,
            },
          });

          if (instFullyPaid) installmentsPaid++;
          remainingPayment -= paymentToInst;
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
            beforeSnapshot: { paidIrr: currentPaidIrr },
            afterSnapshot: { paidIrr: newPaidIrr },
            amountIrr: amountToApply,
            loanId: loan.id,
            boundary: 'SAFE',
            message: `Loan repayment: ${amountToApply.toLocaleString()} IRR`,
          },
        });

        return {
          success: true,
          amountApplied: amountToApply,
          remainingDue: remainingDue - amountToApply,
          installmentsPaid,
          isFullySettled,
          collateralUnfrozen: isFullySettled,
        };
      });

      return result;
    },
  });
};
