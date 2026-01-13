// Domain definitions - Locked
// All values are integers in IRR

export const ASSETS = [
  "USDT",
  "IRR_FIXED_INCOME",
  "GOLD",
  "BTC",
  "ETH",
  "QQQ",
  "SOL",
  "TON",
];

export const ASSET_LAYER = {
  // Foundation (Stable)
  USDT: "FOUNDATION",
  IRR_FIXED_INCOME: "FOUNDATION",

  // Growth (Balanced)
  GOLD: "GROWTH",
  BTC: "GROWTH",
  QQQ: "GROWTH",

  // Upside (Volatile)
  ETH: "UPSIDE",
  SOL: "UPSIDE",
  TON: "UPSIDE",
};

export const LAYER_RANGES = {
  FOUNDATION: { min: 40, max: 70, hardMin: 30 },
  GROWTH: { min: 20, max: 45 },
  UPSIDE: { min: 0, max: 20, hardMax: 25 },
};
