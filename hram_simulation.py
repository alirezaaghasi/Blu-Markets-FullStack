import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# ==========================================
# PART 1: CONFIGURATION (From Appendix B & D)
# ==========================================
ASSETS = {
    'USDT': {'type': 'Foundation', 'vol_profile': 0.001, 'crash_corr': 1.0},
    'PAXG': {'type': 'Foundation', 'vol_profile': 0.12,  'crash_corr': 1.2},  # Gold goes up/holds
    'BTC':  {'type': 'Growth',     'vol_profile': 0.45,  'crash_corr': 0.4},  # Drops hard
    'ETH':  {'type': 'Growth',     'vol_profile': 0.55,  'crash_corr': 0.35},
    'SOL':  {'type': 'Upside',     'vol_profile': 0.75,  'crash_corr': 0.1}   # Drops hardest
}

CONFIG = {
    'vol_window': 30,
    'mom_window': 50,
    'corr_window': 60,
    'min_weight': 0.05,  # 5% Floor
    'max_weight': 0.40,  # 40% Cap
    'rebal_threshold_normal': 0.05,
    'rebal_threshold_emergency': 0.10,
    'initial_capital': 1_000_000_000  # 1 Billion IRR
}

# ==========================================
# PART 2: SYNTHETIC "CRASH" DATA GENERATOR
# ==========================================
def generate_crash_data(days=365):
    """
    Generates synthetic price data resembling 2022.
    Phase 1 (Days 0-100): Choppy/Bullish
    Phase 2 (Days 101-365): Brutal Crash
    """
    np.random.seed(42)
    dates = pd.date_range(start='2025-01-01', periods=days)
    prices = pd.DataFrame(index=dates)

    for symbol, profile in ASSETS.items():
        # Base daily volatility
        daily_vol = profile['vol_profile'] / np.sqrt(365)

        # Trend Component
        trend = np.zeros(days)

        # CRASH LOGIC
        if symbol == 'USDT':
            trend[:] = 0.0001 # Stable
        elif symbol == 'PAXG':
            trend[:] = 0.0002 # Slow grind up
        else:
            # Bullish first 100 days
            trend[:100] = 0.001
            # Crash rest of year (severity depends on asset)
            if symbol == 'BTC': trend[100:] = -0.003
            elif symbol == 'ETH': trend[100:] = -0.0035
            elif symbol == 'SOL': trend[100:] = -0.005

        # Generate Random Walk
        returns = np.random.normal(trend, daily_vol, days)
        price_series = 100 * np.cumprod(1 + returns) # Start at 100
        prices[symbol] = price_series

    return prices

# ==========================================
# PART 3: THE HRAM ENGINE (Appendix B)
# ==========================================
def calculate_hram_weights(prices, current_date):
    """
    Implementation of core formula:
    Weight = normalize( RiskParity * Momentum * Correlation * Liquidity )
    """
    # 1. Lookback Data
    lookback_max = max(CONFIG['vol_window'], CONFIG['mom_window'], CONFIG['corr_window'])
    # Need enough data?
    if len(prices[:current_date]) < lookback_max:
        return {a: 1.0/len(ASSETS) for a in ASSETS} # Default equal weight

    # Slice data
    window = prices[:current_date].iloc[-lookback_max:]

    weights_raw = {}

    # 2. Factor Calculation
    # A. Risk Parity (1 / Volatility)
    vols = window.pct_change().std() * np.sqrt(365)

    # B. Momentum (Price / SMA_50 - 1)
    sma = window.iloc[-CONFIG['mom_window']:].mean()
    current_price = window.iloc[-1]
    momentum_raw = (current_price / sma) - 1

    # C. Correlation (Average correlation to portfolio)
    corr_matrix = window.iloc[-CONFIG['corr_window']:].pct_change().corr()

    for asset in ASSETS:
        # FACTOR 1: Risk Parity
        f_risk = 1 / (vols[asset] + 0.00001) # Avoid div/0

        # FACTOR 2: Momentum (Formula: 1 + mom * 0.3)
        # We clip negative momentum to avoid zero weights in this simplified view
        f_mom = 1 + (momentum_raw[asset] * 0.3)
        if f_mom < 0.1: f_mom = 0.1 # Floor

        # FACTOR 3: Correlation (Formula: 1 - avgCorr * 0.2)
        avg_corr = corr_matrix[asset].mean()
        f_corr = 1 - (avg_corr * 0.2)

        # FACTOR 4: Liquidity (Simplified constant based on asset type)
        # Appendix D implies Majors > Alts
        f_liq = 1.1 if asset in ['BTC', 'ETH', 'USDT'] else 1.0

        # COMBINE
        raw_score = f_risk * f_mom * f_corr * f_liq
        weights_raw[asset] = raw_score

    # 3. Normalize & Cap
    total_score = sum(weights_raw.values())
    weights_norm = {k: v/total_score for k,v in weights_raw.items()}

    # Apply Caps (5% - 40%) - Simple Iterative Clamping
    # Note: A real solver is better, but this approximates the "Clamp & Renormalize" logic
    for _ in range(3):
        current_total = sum(weights_norm.values())
        weights_norm = {k: v/current_total for k,v in weights_norm.items()}
        for k in weights_norm:
            weights_norm[k] = max(CONFIG['min_weight'], min(CONFIG['max_weight'], weights_norm[k]))

    # Final normalization
    final_total = sum(weights_norm.values())
    final_weights = {k: v/final_total for k,v in weights_norm.items()}

    return final_weights

# ==========================================
# PART 4: BACKTEST SIMULATION LOOP
# ==========================================
def run_simulation():
    print("Generating 'Crypto Winter' Scenario Data...")
    prices = generate_crash_data()

    # Portfolio State
    holdings = {a: 0.0 for a in ASSETS}
    cash = CONFIG['initial_capital']

    # Performance Tracking
    portfolio_history = []
    bnh_history = [] # Buy and Hold benchmark (Equal Weight)

    # Initial Allocation
    weights = calculate_hram_weights(prices, prices.index[60])
    for asset, w in weights.items():
        qty = (cash * w) / prices[asset].iloc[60]
        holdings[asset] = qty
    cash = 0 # Fully invested

    last_rebalance = prices.index[60]

    print("Running Backtest...")

    for i in range(60, len(prices)):
        date = prices.index[i]
        current_prices = prices.loc[date]

        # 1. Calculate Current Portfolio Value
        port_val = sum(holdings[a] * current_prices[a] for a in ASSETS) + cash
        portfolio_history.append(port_val)

        # 2. Benchmark (Static Equal Weight)
        # Simplified: Just average of asset returns
        if i == 60:
            bnh_shares = {a: (CONFIG['initial_capital']/len(ASSETS))/current_prices[a] for a in ASSETS}
        bnh_val = sum(bnh_shares[a] * current_prices[a] for a in ASSETS)
        bnh_history.append(bnh_val)

        # 3. Check Drift (Appendix C)
        current_weights = {a: (holdings[a] * current_prices[a])/port_val for a in ASSETS}
        target_weights = calculate_hram_weights(prices, date)

        max_drift = 0
        for a in ASSETS:
            drift = abs(current_weights[a] - target_weights[a])
            if drift > max_drift: max_drift = drift

        # 4. Rebalance Decision
        days_since = (date - last_rebalance).days
        is_emergency = max_drift > CONFIG['rebal_threshold_emergency']
        is_normal = (max_drift > CONFIG['rebal_threshold_normal']) and (days_since >= 1)

        if is_emergency or is_normal:
            # EXECUTE REBALANCE
            # (In reality: Sell first, then Buy. Here: Atomic swap for sim)
            for asset, target_w in target_weights.items():
                target_val = port_val * target_w
                holdings[asset] = target_val / current_prices[asset]

            last_rebalance = date
            rebal_type = "EMERGENCY" if is_emergency else "Normal"
            # print(f"[{date.date()}] {rebal_type} Rebalance. Drift: {max_drift:.1%}")

    # ==========================================
    # PART 5: VISUALIZATION
    # ==========================================
    # Metrics
    final_ret = (portfolio_history[-1] - portfolio_history[0]) / portfolio_history[0]
    bnh_ret = (bnh_history[-1] - bnh_history[0]) / bnh_history[0]

    print("\n" + "="*40)
    print(f"FINAL RESULTS (Simulating 2022 Crash)")
    print("="*40)
    print(f"Buy & Hold Return: {bnh_ret:.2%}")
    print(f"Blu Markets HRAM:  {final_ret:.2%}")
    print(f"Alpha Generated:   {final_ret - bnh_ret:.2%}")
    print("="*40)

if __name__ == "__main__":
    run_simulation()
