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
  durationMonths: z.enum(['3', '6']).transform(Number) as unknown as z.ZodLiteral<3 | 6>,
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
          durationMonths: { type: 'number', enum: [3, 6] },
        },
      },
    },
    handler: async (request, reply) => {
      const { collateralAssetId, amountIrr, durationMonths } = request.body;

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

      // Find holding
      const holding = portfolio.holdings.find((h) => h.assetId === collateralAssetId);
      if (!holding) {
        throw new AppError('NOT_FOUND', 'Holding not found', 404);
      }

      if (holding.frozen) {
        throw new AppError('ASSET_FROZEN', 'Asset is already used as collateral', 400);
      }

      // Get price
      const prices = await getCurrentPrices();
      const price = prices.get(collateralAssetId as AssetId);
      if (!price) {
        throw new AppError('VALIDATION_ERROR', 'Price not available', 400);
      }

      const collateralValueIrr = Number(holding.quantity) * price.priceIrr;
      const layer = getAssetLayer(collateralAssetId as AssetId);
      const maxLtv = LTV_BY_LAYER[layer];
      const maxLoanIrr = collateralValueIrr * maxLtv;

      if (amountIrr > maxLoanIrr) {
        throw new AppError(
          'EXCEEDS_ASSET_LTV',
          `Maximum loan for this asset is ${Math.floor(maxLoanIrr).toLocaleString()} IRR`,
          400
        );
      }

      // Calculate portfolio total value and enforce 25% portfolio limit
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

      // Create loan with installments
      const result = await prisma.$transaction(async (tx) => {
        // Freeze holding
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

      const loan = await prisma.loan.findUnique({
        where: { id: request.params.id },
        include: {
          installments: { orderBy: { number: 'asc' } },
          portfolio: true,
        },
      });

      if (!loan || loan.portfolio.userId !== request.userId) {
        throw new AppError('NOT_FOUND', 'Loan not found', 404);
      }

      if (loan.status !== 'ACTIVE') {
        throw new AppError('VALIDATION_ERROR', 'Loan is not active', 400);
      }

      if (amountIrr > Number(loan.portfolio.cashIrr)) {
        throw new AppError('INSUFFICIENT_CASH', 'Not enough cash balance', 400);
      }

      const remainingDue = Number(loan.totalDueIrr) - Number(loan.paidIrr);
      const amountToApply = Math.min(amountIrr, remainingDue);

      const result = await prisma.$transaction(async (tx) => {
        // Deduct from cash
        await tx.portfolio.update({
          where: { id: loan.portfolioId },
          data: { cashIrr: { decrement: amountToApply } },
        });

        // Update loan
        const newPaidIrr = Number(loan.paidIrr) + amountToApply;
        const isFullySettled = newPaidIrr >= Number(loan.totalDueIrr);

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

        for (const inst of loan.installments) {
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
              portfolioId: loan.portfolioId,
              assetId: loan.collateralAssetId,
              frozen: true,
            },
            data: { frozen: false },
          });
        }

        // Create ledger entry
        await tx.ledgerEntry.create({
          data: {
            portfolioId: loan.portfolioId,
            entryType: 'LOAN_REPAY',
            beforeSnapshot: { paidIrr: Number(loan.paidIrr) },
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
