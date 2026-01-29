/**
 * RTK Query API Slice
 *
 * Centralized data fetching with automatic caching and invalidation.
 * This eliminates stale data issues by:
 * - Auto-refetching when components mount (refetchOnMountOrArgChange)
 * - Cache invalidation via tags when mutations occur
 * - Automatic background refetching (refetchOnFocus, refetchOnReconnect)
 */
import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '../../config/api';
import { tokenStorage } from '../../utils/secureStorage';
import type {
  PortfolioResponse,
  TradePreview,
  TradeExecuteResponse,
  RebalancePreview,
  LoansResponse,
  LoanCapacityResponse,
  LoanPreviewResponse,
  ProtectionsResponse,
  ProtectableHoldingsResponse,
  BackendQuoteResponse,
  PremiumCurveResponse,
  ActivityResponse,
  PricesResponse,
  UserProfile,
} from '../../services/api/types';
import type { AssetId, Holding, Layer, TargetLayerPct, PortfolioStatus, Loan, Protection, RebalanceMode } from '../../types';

// Tag types for cache invalidation
// When a mutation invalidates a tag, all queries with that tag auto-refetch
export const TAG_TYPES = [
  'Portfolio',      // Portfolio summary, cash, status
  'Holdings',       // Holdings list
  'Loans',          // Active loans
  'Protections',    // Active protections
  'Activity',       // Activity/action log
  'Prices',         // Asset prices
  'User',           // User profile
] as const;

// Helper to normalize allocation from backend format
function normalizeAllocation(allocation: Record<string, number> | undefined): TargetLayerPct {
  if (!allocation) {
    return { FOUNDATION: 0.5, GROWTH: 0.35, UPSIDE: 0.15 };
  }
  const normalizeValue = (val: number | undefined): number => {
    if (val === undefined || val === null) return 0;
    return val > 1 ? val / 100 : val;
  };
  return {
    FOUNDATION: normalizeValue(allocation.FOUNDATION ?? allocation.foundation ?? (allocation as any).Foundation),
    GROWTH: normalizeValue(allocation.GROWTH ?? allocation.growth ?? (allocation as any).Growth),
    UPSIDE: normalizeValue(allocation.UPSIDE ?? allocation.upside ?? (allocation as any).Upside),
  };
}

// Helper to normalize holding from backend
function normalizeHolding(h: Record<string, unknown>): Holding {
  return {
    id: h.id as string | undefined,
    assetId: (h.assetId ?? h.asset_id) as AssetId,
    quantity: Number(h.quantity) || 0,
    frozen: Boolean(h.frozen),
    layer: (h.layer as Layer) || 'FOUNDATION',
    purchasedAt: (h.purchasedAt ?? h.purchased_at) as string | undefined,
  };
}

// Custom baseQuery with auth token handling
const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  // Get token from secure storage
  const token = await tokenStorage.getAccessToken();

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Create base query with dynamic headers
  const rawBaseQuery = fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headersInit) => {
      Object.entries(headers).forEach(([key, value]) => {
        headersInit.set(key, value);
      });
      return headersInit;
    },
  });

  let result = await rawBaseQuery(args, api, extraOptions);

  // Handle 401 - attempt token refresh
  if (result.error?.status === 401) {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        const refreshResult = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResult.ok) {
          const data = await refreshResult.json();
          await tokenStorage.setTokens(data.accessToken, data.refreshToken);

          // Retry original request with new token
          headers['Authorization'] = `Bearer ${data.accessToken}`;
          result = await rawBaseQuery(args, api, extraOptions);
        } else {
          // Refresh failed - clear tokens
          await tokenStorage.clearTokens();
        }
      } catch {
        await tokenStorage.clearTokens();
      }
    }
  }

  return result;
};

// Create the API slice
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: TAG_TYPES,
  // Refetch on window focus and reconnect for fresh data
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (builder) => ({
    // ============ PORTFOLIO ============

    // Get portfolio summary with holdings
    getPortfolio: builder.query<PortfolioResponse, void>({
      async queryFn(_arg, _queryApi, _extraOptions, fetchWithBQ) {
        // Fetch summary and holdings in parallel
        const [summaryResult, holdingsResult] = await Promise.all([
          fetchWithBQ('/portfolio'),
          fetchWithBQ('/portfolio/holdings'),
        ]);

        if (summaryResult.error) return { error: summaryResult.error as FetchBaseQueryError };

        const summary = summaryResult.data as Record<string, unknown>;
        const holdingsData = (holdingsResult.data || []) as Record<string, unknown>[];

        // Normalize holdings
        const holdings = holdingsData.map(h => normalizeHolding(h));

        // Validate status
        const rawStatus = summary.status as string | undefined;
        const validStatuses = ['BALANCED', 'SLIGHTLY_OFF', 'ATTENTION_REQUIRED'];
        const status = (rawStatus && validStatuses.includes(rawStatus) ? rawStatus : 'BALANCED') as PortfolioStatus;

        const cashIrr = Number(summary.cashIrr ?? summary.cash_irr ?? 0);
        const totalValueIrr = Number(summary.totalValueIrr ?? summary.total_value_irr ?? 0);
        const holdingsValueIrr = Number(summary.holdingsValueIrr ?? (totalValueIrr - cashIrr));

        return {
          data: {
            cashIrr,
            holdings,
            targetAllocation: normalizeAllocation(summary.targetAllocation as Record<string, number> | undefined),
            status,
            totalValueIrr,
            holdingsValueIrr,
            allocation: normalizeAllocation(
              (summary.allocation as Record<string, number> | undefined) ||
              (summary.Allocation as Record<string, number> | undefined)
            ),
            driftPct: Number(summary.driftPct ?? summary.drift_pct ?? 0),
            dailyChangePercent: Number(summary.dailyChangePercent ?? 0),
            riskScore: summary.riskScore as number | undefined,
            riskProfileName: summary.profileName as string | undefined,
          },
        };
      },
      providesTags: ['Portfolio', 'Holdings'],
    }),

    // Add funds to portfolio
    addFunds: builder.mutation<PortfolioResponse, { amountIrr: number }>({
      query: ({ amountIrr }) => ({
        url: '/portfolio/add-funds',
        method: 'POST',
        body: { amountIrr },
      }),
      // Invalidate portfolio to trigger refetch
      invalidatesTags: ['Portfolio', 'Holdings', 'Activity'],
    }),

    // ============ TRADES ============

    // Preview a trade (no side effects)
    getTradePreview: builder.query<TradePreview, { assetId: AssetId; side: 'BUY' | 'SELL'; amountIrr: number }>({
      query: ({ assetId, side, amountIrr }) =>
        `/trade/preview?assetId=${assetId}&side=${side}&amountIrr=${amountIrr}`,
      // Don't cache previews - always fetch fresh
      keepUnusedDataFor: 0,
    }),

    // Execute a trade
    executeTrade: builder.mutation<TradeExecuteResponse, { assetId: AssetId; side: 'BUY' | 'SELL'; amountIrr: number }>({
      query: ({ assetId, side, amountIrr }) => ({
        url: '/trade/execute',
        method: 'POST',
        body: { assetId, side, amountIrr },
      }),
      // Invalidate all portfolio-related data after trade
      invalidatesTags: ['Portfolio', 'Holdings', 'Activity'],
    }),

    // ============ REBALANCE ============

    // Preview rebalance
    getRebalancePreview: builder.query<RebalancePreview, { mode?: RebalanceMode }>({
      query: ({ mode = 'HOLDINGS_ONLY' }) => `/rebalance/preview?mode=${mode}`,
      transformResponse: (response: any) => ({
        ...response,
        before: normalizeAllocation(response.before ?? response.currentAllocation),
        after: normalizeAllocation(response.after ?? response.afterAllocation),
        target: normalizeAllocation(response.target ?? response.targetAllocation),
      }),
      keepUnusedDataFor: 0,
    }),

    // Execute rebalance
    executeRebalance: builder.mutation<{ success: boolean; tradesExecuted: number; newStatus: PortfolioStatus }, { mode?: RebalanceMode }>({
      query: ({ mode = 'HOLDINGS_ONLY' }) => ({
        url: '/rebalance/execute',
        method: 'POST',
        body: { mode },
      }),
      // Invalidate everything after rebalance
      invalidatesTags: ['Portfolio', 'Holdings', 'Activity'],
    }),

    // ============ LOANS ============

    // Get all loans
    getLoans: builder.query<Loan[], void>({
      query: () => '/loans',
      transformResponse: (response: LoansResponse) => response.loans || [],
      providesTags: ['Loans'],
    }),

    // Get loan capacity
    getLoanCapacity: builder.query<LoanCapacityResponse, void>({
      query: () => '/loans/capacity',
      providesTags: ['Loans', 'Portfolio'],
    }),

    // Preview loan
    getLoanPreview: builder.query<LoanPreviewResponse, { holdingId: string; principalIrr: number; durationMonths: number }>({
      query: ({ holdingId, principalIrr, durationMonths }) =>
        `/loans/preview?holdingId=${holdingId}&principalIrr=${principalIrr}&durationMonths=${durationMonths}`,
      keepUnusedDataFor: 0,
    }),

    // Create loan
    createLoan: builder.mutation<Loan, { holdingId: string; principalIrr: number; durationMonths: number }>({
      query: (body) => ({
        url: '/loans',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Loans', 'Portfolio', 'Holdings', 'Activity'],
    }),

    // Repay loan
    repayLoan: builder.mutation<{ success: boolean; amountPaid: number }, { loanId: string; amountIrr?: number }>({
      query: ({ loanId, amountIrr }) => ({
        url: `/loans/${loanId}/repay`,
        method: 'POST',
        body: amountIrr ? { amountIrr } : undefined,
      }),
      invalidatesTags: ['Loans', 'Portfolio', 'Holdings', 'Activity'],
    }),

    // ============ PROTECTIONS ============

    // Get all protections
    getProtections: builder.query<Protection[], void>({
      query: () => '/protection',
      transformResponse: (response: ProtectionsResponse) => response.protections || [],
      providesTags: ['Protections'],
    }),

    // Get protectable holdings
    getProtectableHoldings: builder.query<ProtectableHoldingsResponse, void>({
      query: () => '/protection/eligible',
      providesTags: ['Holdings', 'Protections'],
    }),

    // Get protection quote
    getProtectionQuote: builder.query<BackendQuoteResponse, { assetId: AssetId; coveragePct: number; durationDays: number }>({
      query: ({ assetId, coveragePct, durationDays }) => ({
        url: '/protection/quote',
        method: 'POST',
        body: { assetId, coveragePct, durationDays },
      }),
      keepUnusedDataFor: 30, // Cache quotes for 30 seconds
    }),

    // Get premium curve
    getPremiumCurve: builder.query<PremiumCurveResponse, { assetId: AssetId; coveragePct: number }>({
      query: ({ assetId, coveragePct }) =>
        `/protection/premium-curve?assetId=${assetId}&coveragePct=${coveragePct}`,
      keepUnusedDataFor: 60,
    }),

    // Purchase protection
    purchaseProtection: builder.mutation<{ success: boolean; protection: Protection }, { quoteId: string; maxPremiumIrr?: number }>({
      query: (body) => ({
        url: '/protection/purchase',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Protections', 'Portfolio', 'Holdings', 'Activity'],
    }),

    // ============ ACTIVITY ============

    // Get activity log
    getActivity: builder.query<ActivityResponse, { limit?: number; cursor?: string } | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.limit) params.append('limit', String(args.limit));
        if (args?.cursor) params.append('cursor', args.cursor);
        const queryString = params.toString();
        return `/portfolio/activity${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Activity'],
    }),

    // ============ PRICES ============

    // Get current prices
    getPrices: builder.query<PricesResponse, void>({
      query: () => '/prices',
      providesTags: ['Prices'],
      // Prices update frequently, keep cached for 30 seconds
      keepUnusedDataFor: 30,
    }),

    // ============ USER ============

    // Get user profile
    getUserProfile: builder.query<UserProfile, void>({
      query: () => '/user/profile',
      providesTags: ['User'],
    }),

    // Update target allocation
    updateTargetAllocation: builder.mutation<void, TargetLayerPct>({
      query: (allocation) => ({
        url: '/user/target-allocation',
        method: 'PUT',
        body: {
          foundation: Math.round(allocation.FOUNDATION * 100),
          growth: Math.round(allocation.GROWTH * 100),
          upside: Math.round(allocation.UPSIDE * 100),
        },
      }),
      invalidatesTags: ['Portfolio', 'User'],
    }),
  }),
});

// Export hooks for use in components
export const {
  // Portfolio
  useGetPortfolioQuery,
  useAddFundsMutation,
  // Trades
  useGetTradePreviewQuery,
  useExecuteTradeMutation,
  // Rebalance
  useGetRebalancePreviewQuery,
  useExecuteRebalanceMutation,
  // Loans
  useGetLoansQuery,
  useGetLoanCapacityQuery,
  useGetLoanPreviewQuery,
  useCreateLoanMutation,
  useRepayLoanMutation,
  // Protections
  useGetProtectionsQuery,
  useGetProtectableHoldingsQuery,
  useGetProtectionQuoteQuery,
  useGetPremiumCurveQuery,
  usePurchaseProtectionMutation,
  // Activity
  useGetActivityQuery,
  // Prices
  useGetPricesQuery,
  // User
  useGetUserProfileQuery,
  useUpdateTargetAllocationMutation,
} = apiSlice;

// Export the API slice for store configuration
export default apiSlice;
