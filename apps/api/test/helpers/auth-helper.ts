import mongoose, { Types } from "mongoose";
import { UserModel, IUser } from "../../src/models/identity/user.model.js";
import { ClientAccountModel, IClientAccount } from "../../src/models/identity/client-account.model.js";
import { ClientModel } from "../../src/models/identity/client.model.js";
import { SettingsModel } from "../../src/models/identity/settings.model.js";
import { TokenService } from "../../src/services/token.service.js";
import { hashPassword } from "../../src/utils/password.js";

export async function ensureDefaultSettings(tenantId = "test_tenant"): Promise<void> {
  await SettingsModel.updateOne(
    { tenantId },
    {
      $setOnInsert: {
        tenantId,
        timezone: "Asia/Kolkata",
        minMarginPct: 12,
        defaultMarginPct: 18,
        riskBuffer: { k: 1.5, minPct: 3, maxPct: 10, windowDays: 30 },
        behindThresholdPct: 10,
        maxBackdateDays: 7,
        weeklyOffs: [0],
        holidays: [],
        safetyDays: 3,
        quoteValidityDays: 14,
        priceThresholds: { daily: 5, sevenday: 10, vol: 15 },
        processConfig: [
          { area: "winding", stages: ["winding"], hours: 8, overlap: 0, fallbackOut: 100 },
          { area: "warping", stages: ["warping"], hours: 8, overlap: 0, fallbackOut: 100 },
          { area: "weaving", stages: ["weaving"], hours: 8, overlap: 0, fallbackOut: 100 },
        ],
        marketRuntime: "18:00",
        reportCutoff: "20:00",
      },
    },
    { upsert: true }
  );
}

export async function createTestUser(params?: {
  tenantId?: string;
  email?: string;
  password?: string;
  role?: "admin" | "supervisor";
  status?: "active" | "locked";
  processAreas?: string[];
}): Promise<{ user: IUser; plainPassword: string }> {
  const tenantId = params?.tenantId || "test_tenant";
  const email = params?.email || `user_${Date.now()}_${Math.random().toString(36).substring(7)}@mill.local`;
  const plainPassword = params?.password || "ValidSecret123!";
  const role = params?.role || "admin";
  const status = params?.status || "active";
  const processAreas = params?.processAreas || ["winding", "warping", "weaving"];

  await ensureDefaultSettings(tenantId);
  const passwordHash = await hashPassword(plainPassword);

  const user = await UserModel.create({
    tenantId,
    name: "Test User",
    email,
    passwordHash,
    role,
    status,
    processAreas,
    lockout: { failedCount: 0, lockedUntil: null },
    notificationPrefs: { inApp: true, email: true, wa: false, sms: false },
    version: 1,
  });

  return { user: user.toObject(), plainPassword };
}

export async function createTestClientAccount(params?: {
  tenantId?: string;
  clientId?: Types.ObjectId;
  email?: string;
  password?: string;
  status?: "invited" | "active" | "locked";
}): Promise<{ account: IClientAccount; plainPassword: string; clientId: Types.ObjectId }> {
  const tenantId = params?.tenantId || "test_tenant";
  const email = params?.email || `client_${Date.now()}_${Math.random().toString(36).substring(7)}@client.local`;
  const plainPassword = params?.password || "ClientPass123!";
  const status = params?.status || "active";

  let clientId = params?.clientId;
  if (!clientId) {
    const client = await ClientModel.create({
      tenantId,
      clientName: `Acme Fabrics ${Math.floor(Math.random() * 9000 + 1000)}`,
      contactPerson: "Acme Representative",
      email: `contact_${Date.now()}@acme.local`,
      phone: "+919876543210",
      city: "Surat",
      country: "India",
      address: "123 Textile Park, Ring Road",
      status: "active",
      paymentTermsDays: 30,
      version: 1,
    });
    clientId = client._id as Types.ObjectId;
  }

  const passwordHash = status !== "invited" ? await hashPassword(plainPassword) : undefined;
  const adminId = new mongoose.Types.ObjectId();

  const account = await ClientAccountModel.create({
    tenantId,
    clientId,
    email,
    name: "Acme Contact",
    passwordHash,
    status,
    invitedBy: adminId,
    invitedAt: new Date(),
    lockout: { failedCount: 0, lockedUntil: null },
    notificationPrefs: { inApp: true, email: true, wa: false, sms: false },
    version: 1,
  });

  return { account: account.toObject(), plainPassword, clientId };
}

export function generateTestAuthHeader(params: {
  subjectId: string;
  realm: "user" | "client";
  tenantId?: string;
  role?: "admin" | "supervisor";
  clientId?: string;
  clientAccountId?: string;
}): string {
  const { token } = TokenService.generateAccessToken({
    subjectId: params.subjectId,
    realm: params.realm,
    tenantId: params.tenantId || "test_tenant",
    role: params.role || (params.realm === "user" ? "admin" : undefined),
    clientId: params.clientId,
    clientAccountId: params.clientAccountId,
  });
  return `Bearer ${token}`;
}
