# LoomPilot Frontend API Integration Guide

This guide provides frontend engineers (React, Next.js, Vue, Svelte, or Mobile) with everything required to integrate cleanly, securely, and idiomatically with the LoomPilot backend API.

---

## 1. API Architecture & Conventions

### Base URLs & Environments
| Environment | Base URL | Interactive Docs (Swagger UI) | Raw OpenAPI 3.0 Spec |
| :--- | :--- | :--- | :--- |
| **Local Development** | `http://localhost:4000` | `http://localhost:4000/api-docs/` | `http://localhost:4000/api-docs.json` |
| **Staging / Docker** | `http://api.staging.loompilot.internal:4000` | `http://api.staging.loompilot.internal:4000/api-docs/` | `/api-docs.json` |
| **Production** | `https://api.loompilot.com` | `/api-docs/` | `/api-docs.json` |

Configure your frontend application with an environment variable:
```env
# Vite (.env)
VITE_API_BASE_URL=http://localhost:4000

# Next.js (.env.local)
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

### Essential Rules for Frontend Developers
1. **Financial Precision (Integer Paise)**:
   - **Never format or send floating-point currency** across API boundaries.
   - All monetary fields (`ratePaise`, `subtotalCostPaise`, `finalPricePaise`, `totalInvoicePaise`, `amountReceivedPaise`, `balancePaise`) are **64-bit integer paise** (`100 paise = ₹1.00`).
   - Example: ₹2,150.50 must be sent and received as `215050`.
2. **Standard Response Envelope**:
   - Single item queries: `{ data: T, requestId: string }`
   - Paginated collection queries: `{ data: T[], total: number, page: number, limit: number, requestId: string }`
   - Errors: `{ error: string, message: string, details?: any, requestId: string }`
3. **Distributed Request Tracing**:
   - The backend attaches an `x-request-id` header to all responses, mirrored in the JSON response body as `requestId`.
   - Log this `requestId` in user-facing error toasts (e.g., *"Error saving output (Ref: req_abc123). Please contact support."*).

---

## 2. Authentication Lifecycle

LoomPilot uses a dual-token authentication model:
- **Access Token**: Short-lived JWT (default: 1 hour). Passed via the standard HTTP header `Authorization: Bearer <token>`. Stored in memory (React state / Zustand / Redux) — **never** in `localStorage`.
- **Refresh Token**: Long-lived token (default: 7 days). Stored in an `HttpOnly`, `SameSite=Strict` cookie (`loompilot_refresh_token`) managed automatically by the browser.

### Auth Flow Diagram
```
+---------------+              +--------------------+              +--------------------+
| Frontend App  |              |    Express API     |              |   MongoDB Store    |
+---------------+              +--------------------+              +--------------------+
        |                                |                                   |
        |--- POST /api/v1/auth/login ------>|                                   |
        |    { email, password }         |--- Verify credentials ----------->|
        |                                |<-- User & Tenant record ----------|
        |<-- 200 OK ---------------------|                                   |
        |    Set-Cookie: refresh_token   |                                   |
        |    Body: { accessToken, user } |                                   |
        |                                |                                   |
        |--- GET /api/v1/orders ----------->|                                   |
        |    Header: Bearer <token>      |--- Authenticate JWT & RBAC ------>|
        |<-- 200 OK { data: [...] } -----|                                   |
        |                                |                                   |
        |    [Access Token Expires]      |                                   |
        |--- GET /api/v1/orders ----------->|                                   |
        |<-- 401 Unauthorized -----------|                                   |
        |                                |                                   |
        |--- POST /api/v1/auth/refresh ---->|                                   |
        |    Cookie: refresh_token       |--- Verify & Rotate Token -------->|
        |<-- 200 OK { accessToken } -----|                                   |
        |                                |                                   |
        |--- Retry GET /api/v1/orders ----->|                                   |
        |<-- 200 OK ---------------------|                                   |
```

---

## 3. Production TypeScript API Client (Axios)

Here is a drop-in, production-ready Axios client with automatic silent token refresh, request queueing, and typed error responses:

```typescript
// src/api/client.ts
import axios, { AxiosError, InternalAxiosRequestTransformed } from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

let memoryAccessToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const setAccessToken = (token: string | null) => {
  memoryAccessToken = token;
};

export const getAccessToken = () => memoryAccessToken;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Crucial: sends and receives HttpOnly refresh cookie
  headers: {
    "Content-Type": "application/json",
  },
});

// 1. Request Interceptor: Attach Access Token
apiClient.interceptors.request.use((config) => {
  if (memoryAccessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${memoryAccessToken}`;
  }
  return config;
});

// 2. Response Interceptor: Silent Token Refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error: string; message: string; requestId?: string }>) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Avoid infinite loop if refresh itself fails
      if (originalRequest.url?.includes("/api/v1/auth/refresh") || originalRequest.url?.includes("/api/v1/auth/login")) {
        setAccessToken(null);
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await apiClient.post<{ data: { accessToken: string } }>("/api/v1/auth/refresh");
        const newAccessToken = refreshResponse.data.data.accessToken;

        setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
        window.dispatchEvent(new Event("loompilot:auth-expired"));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

---

## 4. Alternative: Lightweight Native Fetch Client

If your frontend does not use Axios, here is the equivalent implementation using modern native `fetch`:

```typescript
// src/api/fetchClient.ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
let accessToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  accessToken = token;
};

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: "include", // Sends HttpOnly refresh cookies
  };

  let response = await fetch(`${BASE_URL}${endpoint}`, config);

  // Auto-refresh token on 401
  if (response.status === 401 && !endpoint.includes("/api/v1/auth/")) {
    const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (refreshRes.ok) {
      const { data } = await refreshRes.json();
      setAuthToken(data.accessToken);
      headers.set("Authorization", `Bearer ${data.accessToken}`);
      response = await fetch(`${BASE_URL}${endpoint}`, { ...config, headers });
    } else {
      setAuthToken(null);
      window.dispatchEvent(new Event("loompilot:auth-expired"));
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw {
      status: response.status,
      ...errBody,
    };
  }

  return response.json();
}
```

---

## 5. Currency & Financial Formatting Utilities

Because all money is stored and returned as **integer paise**, use these utility functions in your UI components:

```typescript
// src/utils/currency.ts

/**
 * Converts integer paise into Indian Rupee formatted display string.
 * Example: 21500000 -> "₹2,15,000.00"
 */
export function formatPaiseToINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Converts user Rupee input string/number into integer paise for API submission.
 * Example: "2150.50" -> 215050
 */
export function rupeesToPaise(rupees: number | string): number {
  const numeric = typeof rupees === "string" ? parseFloat(rupees) : rupees;
  if (isNaN(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100);
}
```

---

## 6. Quotation PDF Streaming & Download Helper

The backend endpoint `GET /api/v1/quotations/:id/pdf` streams a binary `application/pdf` buffer with `Content-Disposition: attachment`.

To download it seamlessly in the user's browser without opening a raw tab:

```typescript
// src/api/v1/quotations.ts
import { apiClient } from "./client";

export async function downloadQuotationPdf(quotationId: string, filename = `Quotation-${quotationId}.pdf`) {
  const response = await apiClient.get(`/api/v1/quotations/${quotationId}/pdf`, {
    responseType: "blob", // Instruct Axios to parse as binary Blob
  });

  // Create temporary browser URL and trigger instant download
  const blob = new Blob([response.data], { type: "application/pdf" });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();

  // Cleanup
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
```

---

## 7. Role-Based Access Control (RBAC) in Frontend

LoomPilot defines 5 roles (`UserRole`):
- `owner`: Full system access across all modules.
- `manager`: Operational control (quotation approvals, order planning, worker allocation). Cannot access financial margin reports.
- `store`: Inventory and stock management, delivery recording. **All rates, unit costs, and profit margins are masked.**
- `sales`: RFQ enquiry ingestion and customer liaison. Cannot access internal production costs or workforce salaries.
- `accounts`: Receivables, payment receipts, collection aging, and **exclusive authority to approve payment reminder drafts**.

### Frontend Permission Gate Hook Example
```tsx
// src/hooks/usePermission.ts
import { useAuth } from "./useAuth";

export type Role = "owner" | "manager" | "store" | "sales" | "accounts";

export function usePermission() {
  const { user } = useAuth();

  return {
    canViewCosts: user?.role !== "store",
    canApproveReminders: user?.role === "accounts",
    canConfirmOrder: user?.role === "owner" || user?.role === "manager",
    canViewMarginReport: user?.role === "owner" || user?.role === "accounts",
    canRecordReceipt: user?.role === "owner" || user?.role === "accounts",
    canRecordDelivery: ["owner", "manager", "store"].includes(user?.role || ""),
  };
}
```

---

## 8. Automated TypeScript Types Generation

To ensure 100% type safety and eliminate manual API interface syncing, you can generate TypeScript definitions directly from the backend's live OpenAPI specification.

### Using `openapi-typescript`
```bash
# In your frontend project
pnpm add -D openapi-typescript

# Run against the running backend server
npx openapi-typescript http://localhost:4000/api-docs.json -o src/api/v1-schema.ts
```

### Script in `package.json`:
```json
{
  "scripts": {
    "generate:api": "openapi-typescript http://localhost:4000/api-docs.json -o src/types/api.generated.ts"
  }
}
```
Now all entity shapes (`Quotation`, `ProductionOrder`, `DailyOutput`, etc.) and request parameters are automatically synchronized and strictly typed.

