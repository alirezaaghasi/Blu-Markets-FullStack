import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# ==========================================
# PART 1: ADVANCED CONFIGURATION
# ==========================================
ASSETS = {
    'USDT': {'type': 'Foundation', 'vol_profile': 0.001, 'crash_corr': 1.0},
    'PAXG': {'type': 'Foundation', 'vol_profile': 0.12,  'crash_corr': 1.2},
    'BTC':  {'type': 'Growth',     'vol_profile': 0.45,  'crash_corr': 0.4},
    'ETH':  {'type': 'Growth',     'vol_profile': 0.55,  'crash_corr': 0.35},
    'SOL':  {'type': 'Upside',     'vol_profile': 0.75,  'crash_corr': 0.1}
}

CONFIG = {
    'vol_window': 30,
    'mom_window': 50,
    'corr_window': 60,
    'min_weight': 0.05,
    'max_weight': 0.40,
    'rebal_threshold_normal': 0.05,
    'rebal_threshold_emergency': 0.10,
    'initial_capital': 1_000_000_000, # 1 Billion IRR

    # NEW: Friction Parameters
    'base_fee': 0.003,      # 0.3% Exchange Fee
    'base_slippage': 0.002, # 0.2% Base Slippage
    'risk_free_rate': 0.20  # 20% Risk Free Rate (approx for Iran context)
}

# ==========================================
# PART 2: DATA GENERATOR (With Volatility Spike)
# ==========================================
def generate_crash_data(days=365):
    np.random.seed(42)
    dates = pd.date_range(start='2025-01-01', periods=days)
    prices = pd.DataFrame(index=dates)

    # Market State: 0 = Normal, 1 = Crash
    market_state = np.zeros(days)
    market_state[100:] = 1 # Crash starts day 100

    for symbol, profile in ASSETS.items():
        base_vol = profile['vol_profile'] / np.sqrt(365)

        # Volatility expands during crash
        vol_multiplier = np.where(market_state == 1, 1.5, 1.0)
        if symbol == 'USDT': vol_multiplier = 1.0 # Stable

        trend = np.zeros(days)
        if symbol == 'USDT': trend[:] = 0.0001
        elif symbol == 'PAXG': trend[:] = 0.0002
        else:
            trend[:100] = 0.001 # Bull run
            # Crash Severity
            if symbol == 'BTC': trend[100:] = -0.003
            elif symbol == 'ETH': trend[100:] = -0.0035
            elif symbol == 'SOL': trend[100:] = -0.005

        returns = np.random.normal(trend, base_vol * vol_multiplier, days)
        prices[symbol] = 100 * np.cumprod(1 + returns)

    return prices

# ==========================================
# PART 3: HRAM ENGINE (Unchanged Core Logic)
# ==========================================
def calculate_hram_weights(prices, current_date):
    lookback = max(CONFIG['vol_window'], CONFIG['mom_window'], CONFIG['corr_window'])
    if len(prices[:current_date]) < lookback:
        return {a: 1.0/len(ASSETS) for a in ASSETS}

    window = prices[:current_date].iloc[-lookback:]
    vols = window.pct_change().std() * np.sqrt(365)
    sma = window.iloc[-CONFIG['mom_window']:].mean()
    mom = (window.iloc[-1] / sma) - 1
    corr = window.iloc[-CONFIG['corr_window']:].pct_change().corr()

    weights_raw = {}
    for asset in ASSETS:
        f_risk = 1 / (vols[asset] + 1e-6)
        f_mom = max(0.1, 1 + (mom[asset] * 0.3))
        f_corr = 1 - (corr[asset].mean() * 0.2)
        f_liq = 1.1 if asset in ['BTC','ETH','USDT'] else 1.0
        weights_raw[asset] = f_risk * f_mom * f_corr * f_liq

    # Normalize & Clamp
    w = {k: v/sum(weights_raw.values()) for k,v in weights_raw.items()}
    for _ in range(3): # Iterative clamping
        total = sum(w.values())
        w = {k: max(CONFIG['min_weight'], min(CONFIG['max_weight'], v/total)) for k,v in w.items()}

    final_sum = sum(w.values())
    return {k: v/final_sum for k,v in w.items()}

# ==========================================
# PART 4: SIMULATION WITH FRICTION
# ==========================================
def run_simulation():
    prices = generate_crash_data()
    dates = prices.index

    # Portfolio Init
    cash = CONFIG['initial_capital']
    holdings = {a: 0.0 for a in ASSETS}

    # Stats
    history = []     # HRAM Value
    bench_hist = []  # Buy & Hold Value
    fees_paid = 0

    # Initial Buy (Day 60)
    start_idx = 60
    weights = calculate_hram_weights(prices, dates[start_idx])

    # Initial Execution (Assuming normal slippage)
    for a, w in weights.items():
        alloc = cash * w
        cost = alloc * (CONFIG['base_fee'] + CONFIG['base_slippage'])
        fees_paid += cost
        holdings[a] = (alloc - cost) / prices[a].iloc[start_idx]
    cash = 0

    # Benchmark Init (Equal Weight)
    b0_prices = prices.iloc[start_idx]
    b_shares = {a: (CONFIG['initial_capital']/len(ASSETS))/b0_prices[a] for a in ASSETS}

    last_rebal = dates[start_idx]

    print(f"Starting Sim: {dates[start_idx].date()} to {dates[-1].date()}")

    for i in range(start_idx, len(dates)):
        date = dates[i]
        curr_px = prices.loc[date]

        # 1. Valuations
        port_val = sum(holdings[a] * curr_px[a] for a in ASSETS) + cash
        history.append(port_val)

        bench_val = sum(b_shares[a] * curr_px[a] for a in ASSETS)
        bench_hist.append(bench_val)

        # 2. Volatility Check for Dynamic Slippage
        # If short-term vol is high, slippage doubles
        recent_vol = prices[i-5:i].pct_change().std().mean()
        is_high_vol = recent_vol > 0.02 # Arbitrary stress threshold
        current_slippage = CONFIG['base_slippage'] * (2.0 if is_high_vol else 1.0)

        # 3. Rebalance Logic
        curr_w = {a: (holdings[a]*curr_px[a])/port_val for a in ASSETS}
        target_w = calculate_hram_weights(prices, date)

        max_drift = max(abs(curr_w[a] - target_w[a]) for a in ASSETS)
        days_since = (date - last_rebal).days

        trigger = (max_drift > CONFIG['rebal_threshold_emergency']) or \
                  ((max_drift > CONFIG['rebal_threshold_normal']) and (days_since >= 1))

        if trigger:
            # EXECUTION SIMULATOR
            # Sell Overweight
            for a in ASSETS:
                target_amt = port_val * target_w[a]
                curr_amt = holdings[a] * curr_px[a]

                if curr_amt > target_amt:
                    sell_amt = curr_amt - target_amt
                    # Apply Friction
                    friction = sell_amt * (CONFIG['base_fee'] + current_slippage)
                    fees_paid += friction

                    net_cash = sell_amt - friction
                    holdings[a] -= sell_amt / curr_px[a]
                    cash += net_cash

            # Buy Underweight
            for a in ASSETS:
                target_amt = port_val * target_w[a]
                curr_amt = holdings[a] * curr_px[a]

                if curr_amt < target_amt:
                    needed = target_amt - curr_amt
                    if cash > 0:
                        buy_amt = min(cash, needed)
                        friction = buy_amt * (CONFIG['base_fee'] + current_slippage)
                        fees_paid += friction

                        actual_invest = buy_amt - friction
                        holdings[a] += actual_invest / curr_px[a]
                        cash -= buy_amt

            last_rebal = date

    # ==========================================
    # PART 5: METRICS REPORTING
    # ==========================================
    # Helper for Max Drawdown
    def get_max_dd(series):
        s = pd.Series(series)
        cummax = s.cummax()
        dd = (s - cummax) / cummax
        return dd.min()

    # Helper for Sharpe (Annualized)
    def get_sharpe(series, rf=0.20):
        s = pd.Series(series)
        ret = s.pct_change().dropna()
        excess = ret.mean() * 365 - rf
        std = ret.std() * np.sqrt(365)
        return excess / std

    h_ret = (history[-1]/history[0]) - 1
    b_ret = (bench_hist[-1]/bench_hist[0]) - 1

    print("\n" + "="*50)
    print(f"ADVANCED STRESS TEST RESULTS (With Friction)")
    print("="*50)
    print(f"{'METRIC':<20} | {'BLU MARKETS (HRAM)':<18} | {'BUY & HOLD':<15}")
    print("-" * 58)
    print(f"{'Net Return':<20} | {h_ret:>17.2%} | {b_ret:>14.2%}")
    print(f"{'Max Drawdown':<20} | {get_max_dd(history):>17.2%} | {get_max_dd(bench_hist):>14.2%}")
    print(f"{'Sharpe Ratio':<20} | {get_sharpe(history):>17.2f} | {get_sharpe(bench_hist):>14.2f}")
    print(f"{'Fees Paid (IRR)':<20} | {fees_paid/1e6:>16.1f}M | {'0.0':>14}")
    print("-" * 58)
    print(f"Alpha (Net): {h_ret - b_ret:.2%}")
    print("="*50)

    # Plot
    plt.figure(figsize=(10,6))
    plt.plot(dates[start_idx:], [x/1e9 for x in history], label='HRAM (Net)', color='#0066FF')
    plt.plot(dates[start_idx:], [x/1e9 for x in bench_hist], label='Buy & Hold', color='gray', linestyle='--')
    plt.title('Advanced HRAM Stress Test: Returns After Fees & Slippage')
    plt.ylabel('Portfolio Value (Bn IRR)')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.show()

if __name__ == "__main__":
    run_simulation()
