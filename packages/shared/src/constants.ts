/**
 * Application Identity
 * Single source of truth for the application name across the entire codebase.
 */
export const APP_NAME = "LoomPilot";

/**
 * Currency & Finance Standards
 * All monetary amounts in database and API payloads are integer paise (1 INR = 100 paise).
 */
export const PAISE_PER_RUPEE = 100;

/**
 * Standard HTTP headers used for internal and tracing flows
 */
export const HEADERS = {
  REQUEST_ID: "x-request-id",
  SERVICE_TOKEN: "x-service-token",
  TENANT_ID: "x-tenant-id",
} as const;
