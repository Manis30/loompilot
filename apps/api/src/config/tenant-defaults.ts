import { IProcessConfig, ISettings } from "../models/identity/settings.model.js";

export const DEFAULT_PROCESS_CONFIG: IProcessConfig[] = [
  { area: "yarn_stock", hours: 4, overlap: false, fallbackOut: 1000, usualWorkers: 2 },
  { area: "knitting", hours: 24, overlap: false, fallbackOut: 800, usualWorkers: 6 },
  { area: "dyeing_processing", hours: 36, overlap: false, fallbackOut: 800, usualWorkers: 4 },
  { area: "cutting", hours: 12, overlap: true, fallbackOut: 1000, usualWorkers: 5 },
  { area: "stitching", hours: 48, overlap: true, fallbackOut: 1000, usualWorkers: 15 },
  { area: "checking", hours: 12, overlap: true, fallbackOut: 1000, usualWorkers: 4 },
  { area: "ironing_finishing", hours: 12, overlap: true, fallbackOut: 1000, usualWorkers: 4 },
  { area: "packing", hours: 8, overlap: false, fallbackOut: 1200, usualWorkers: 3 },
];

export const DEFAULT_SETTINGS: Omit<ISettings, "tenantId" | "createdAt" | "updatedAt" | "version"> = {
  timezone: "Asia/Kolkata",
  minMarginPct: 12,
  defaultMarginPct: 18,
  advancePct: 30,
  processConfig: DEFAULT_PROCESS_CONFIG,
  holidays: [],
  marketRuntime: "18:00",
  reportCutoff: "20:00",
  weeklyOffs: [0], // Sunday
  safetyDays: 3,
  quoteValidityDays: 14,
  riskBuffer: {
    k: 1.5,
    minPct: 3,
    maxPct: 10,
    windowDays: 30,
  },
  behindThresholdPct: 10,
  maxBackdateDays: 7,
  priceThresholds: {
    daily: 5,
    sevenday: 10,
    vol: 15,
  },
  quoteReminderDays: [1],
  paymentReminderLeadDays: 1,
  basePriceTolerancePct: undefined,
  marketSources: [
    {
      name: "Supplier Quotes",
      type: "supplier_quote",
      trust: "trusted",
      active: true,
    },
    {
      name: "Tirupur Yarn Market Web",
      type: "web",
      trust: "normal",
      active: true,
      config: { secretRef: "MARKET_TIRUPUR_SECRET" },
    },
  ],
};
