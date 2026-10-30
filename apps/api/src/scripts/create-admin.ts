import { connectMongo, disconnectMongo, isMongoConnected } from "../config/database.js";
import { UserModel } from "../models/identity/user.model.js";
import { SettingsModel } from "../models/identity/settings.model.js";
import { AuditLogModel } from "../models/platform/audit-log.model.js";
import { hashPassword, validatePasswordPolicy } from "../utils/password.js";
import { getEnv } from "../config/env.js";

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--force") {
      result["force"] = true;
    } else if (arg.startsWith("--") && i + 1 < args.length) {
      const key = arg.slice(2);
      const val = args[i + 1];
      if (val !== undefined) {
        result[key] = val;
      }
      i++;
    }
  }
  return result;
}

export async function createAdmin(options?: {
  tenantId?: string;
  email?: string;
  name?: string;
  password?: string;
  force?: boolean;
}): Promise<{ userId: string; email: string; tenantId: string }> {
  const env = getEnv();
  const tenantId = options?.tenantId || env.TENANT_DEFAULT_ID || "default";
  const email = options?.email || "admin@mill.loompilot.local";
  const name = options?.name || "System Administrator";
  const password = options?.password || "AdminSecret123!";
  const force = options?.force || false;

  if (!isMongoConnected()) {
    await connectMongo();
  }

  try {
    // 1. Refuse to run when an active admin already exists unless --force
    const existingAdmin = await UserModel.findOne({
      tenantId,
      role: "admin",
      status: "active",
    });

    if (existingAdmin && !force) {
      throw new Error(
        `An active administrator already exists for tenant '${tenantId}' (User ID: ${existingAdmin._id}). Use --force to provision an additional admin.`
      );
    }

    // 2. Ensure default Settings document exists for the tenant
    await SettingsModel.updateOne(
      { tenantId },
      {
        $setOnInsert: {
          tenantId,
          timezone: env.TENANT_TIMEZONE || "Asia/Kolkata",
          minMarginPct: 12,
          defaultMarginPct: 18,
          riskBuffer: { k: 1.5, minPct: 3, maxPct: 10, windowDays: 30 },
          behindThresholdPct: 10,
          maxBackdateDays: 7,
          weeklyOffs: [0], // Sunday
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

    // 3. Hash password and create admin user
    validatePasswordPolicy(password);
    const passwordHash = await hashPassword(password);

    const admin = await UserModel.create({
      tenantId,
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: "admin",
      status: "active",
      processAreas: ["winding", "warping", "weaving"],
      notificationPrefs: {
        inApp: true,
        email: true,
        wa: false,
        sms: false,
      },
    });

    // 4. Audit admin provisioning (never printing secrets)
    await AuditLogModel.create({
      tenantId,
      actor: { id: admin._id, type: "system", email: admin.email },
      action: "ADMIN_PROVISIONED",
      entity: { collection: "users", id: String(admin._id) },
      after: { email: admin.email, name: admin.name, role: admin.role },
    });

    return {
      userId: String(admin._id),
      email: admin.email,
      tenantId,
    };
  } finally {
    // Only close DB connection if invoked directly as CLI script
    if (process.argv[1]?.includes("create-admin")) {
      await disconnectMongo();
    }
  }
}

// CLI runner
if (process.argv[1]?.includes("create-admin")) {
  const cliArgs = parseArgs(process.argv.slice(2));
  createAdmin({
    tenantId: cliArgs.tenant as string | undefined,
    email: cliArgs.email as string | undefined,
    name: cliArgs.name as string | undefined,
    password: cliArgs.password as string | undefined,
    force: Boolean(cliArgs.force),
  })
    .then((res) => {
      // Print confirmation without exposing secrets
      console.log(
        `[SUCCESS] Admin user successfully provisioned for tenant '${res.tenantId}'. User ID: ${res.userId}, Email: ${res.email}`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[ERROR] Admin provisioning failed: ${err.message}`);
      process.exit(1);
    });
}
