import { connectDB, disconnectDB } from "../config/db.js";
import { authService } from "../container.js";
import { UserRole } from "@loompilot/shared";
import { logger } from "../config/logger.js";

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      if (arg.includes("=")) {
        const [key, ...vals] = arg.slice(2).split("=");
        parsed[key!] = vals.join("=");
      } else if (i + 1 < args.length && !args[i + 1]!.startsWith("--")) {
        parsed[arg.slice(2)] = args[i + 1]!;
        i++;
      }
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const tenantId = args.tenant || args.tenantId;
  const email = args.email;
  const password = args.password;
  const name = args.name || "Tenant Owner";

  if (!tenantId || !email || !password) {
    console.error(
      "Usage: pnpm --filter @loompilot/api create-owner --tenant=<tenantId> --email=<email> --password=<password> [--name=<name>]"
    );
    process.exit(1);
  }

  try {
    await connectDB();

    const user = await authService.register({
      tenantId,
      email,
      password,
      name,
      role: UserRole.OWNER,
    });

    logger.info(
      {
        tenantId: user.tenantId,
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      "Initial owner created successfully"
    );
    console.log(`Initial owner created successfully for tenant '${tenantId}' (${user.email})`);

    await disconnectDB();
    process.exit(0);
  } catch (err: any) {
    logger.error({ error: err.message }, "Failed to create initial owner");
    console.error(`Error: ${err.message}`);
    await disconnectDB().catch(() => {});
    process.exit(1);
  }
}

main();

