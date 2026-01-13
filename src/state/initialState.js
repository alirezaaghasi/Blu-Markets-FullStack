import { ASSETS } from "./domain.js";

export const initialState = {
  stage: "ONBOARDING_PHONE",
  phone: null,
  cashIRR: 0,
  holdings: ASSETS.map((a) => ({ assetId: a, valueIRR: 0, frozen: false })),
  targetLayerPct: { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 },
  protections: [],
  loan: null,
  ledger: [],
  pendingAction: null,
  stressMode: false,
};
