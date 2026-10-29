import { TxContext } from "./unit-of-work.js";

export interface CompanyProfile {
  name: string;
  address?: string;
  gstin?: string;
  currency: string;
  timezone: string;
  workingDays: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
  workingHoursPerDay: number;
  cutoffTime: string;
  defaultRiskBufferPct: number;
  defaultWastagePct: number;
  defaultPaymentTermsDays: number;
}

export interface Settings {
  id: string;
  tenantId: string;
  companyProfile: CompanyProfile;
  version: number;
  updatedAt: Date;
}

export interface Holiday {
  id: string;
  tenantId: string;
  date: string; // YYYY-MM-DD
  name: string;
  processId?: string;
  createdAt: Date;
}

export interface NewHoliday {
  tenantId: string;
  date: string;
  name: string;
  processId?: string;
}

export interface ISettingsRepository {
  getSettings(tenantId: string, tx?: TxContext): Promise<Settings>;
  updateSettings(
    tenantId: string,
    updates: Partial<CompanyProfile>,
    expectedVersion?: number,
    tx?: TxContext
  ): Promise<Settings>;
  listHolidays(tenantId: string): Promise<Holiday[]>;
  createHoliday(data: NewHoliday, tx?: TxContext): Promise<Holiday>;
  deleteHoliday(tenantId: string, id: string, tx?: TxContext): Promise<boolean>;
}
