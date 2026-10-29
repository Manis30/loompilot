# LoomPilot Realtime Socket.IO Integration Guide

LoomPilot includes a high-performance Socket.IO realtime server running on the same HTTP port as Express (`http://localhost:4000`). It provides instant push notifications for production shortfall alerts, order delivery events, and AI recovery recommendations.

---

## 1. Connection & Authentication Handshake

Socket.IO connections **require** an authenticated JWT access token during the handshake. Unauthenticated connections are rejected immediately with `Authentication error`.

### Handshake Configuration
- **Server URL**: `http://localhost:4000` (or `VITE_API_BASE_URL`)
- **Transport**: `["websocket", "polling"]` (WebSocket preferred)
- **Auth Payload**: `{ token: "<jwt_access_token>" }`

```typescript
import { io, Socket } from "socket.io-client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function createRealtimeSocket(accessToken: string): Socket {
  const socket = io(API_BASE_URL, {
    auth: {
      token: accessToken,
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    console.log("[Socket.IO] Connected successfully with ID:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error("[Socket.IO] Connection error:", err.message);
  });

  return socket;
}
```

---

## 2. Server Rooms & Tenant Isolation

On a successful handshake, the backend server inspects the decoded JWT and automatically joins the socket to isolated rooms:

1. **Tenant Room (`tenant:<tenantId>`)**:
   - Isolates all broadcasts per tenant. A user from `tenant_A` never receives messages or events destined for `tenant_B`.
2. **Role Room (`tenant:<tenantId>:role:<userRole>`)**:
   - Isolates role-sensitive events. For example, financial or margin alerts are only emitted to `tenant:<id>:role:owner` and `tenant:<id>:role:accounts`.
   - Production floor shortfall alerts are emitted to `tenant:<id>:role:owner` and `tenant:<id>:role:manager`.

No manual client subscriptions or room joining commands are required. The server handles room membership transparently.

---

## 3. Realtime Events Specification

### 1. `alert:new` (Production Shortfall & Delay Alert)
Emitted in realtime whenever:
- Shop floor daily output falls below the required daily production target.
- The monitoring sweep detects a production delay.
- An agent posts a new shortfall alert via `/internal/v1/alerts`.

**Receiving Roles**: `owner`, `manager`

**Event Payload Schema**:
```typescript
interface AlertNewEventPayload {
  type: "alert:new";
  alert: {
    id: string;
    tenantId: string;
    orderId: string;
    processId: string;
    date: string; // "YYYY-MM-DD"
    type: "delay_warning" | "material_shortage" | "worker_deficit" | "quality_defect";
    severity: "low" | "medium" | "high";
    title: string;
    message: string;
    metrics: {
      requiredDaily: number;
      actualRate: number;
      deficitQty: number;
      delayDaysEstimated: number;
    };
    isAcknowledged: boolean;
    createdAt: string; // ISO 8601
  };
  timestamp: string; // ISO 8601
}
```

### Example Frontend Handler:
```typescript
socket.on("alert:new", (payload: AlertNewEventPayload) => {
  console.log("New production alert received:", payload.alert.title);
  
  // 1. Show audio or toast notification
  toast.error(`Production Alert: ${payload.alert.title}`, {
    description: payload.alert.message,
    action: {
      label: "View Recovery Options",
      onClick: () => navigate(`/orders/${payload.alert.orderId}/recovery`),
    },
  });

  // 2. Invalidate React Query / SWR cache
  queryClient.invalidateQueries(["alerts"]);
  queryClient.invalidateQueries(["orders", payload.alert.orderId]);
});
```

---

## 4. Production React Hook Integration

Here is a production-grade React hook (`useRealtimeAlerts`) managing socket lifecycle, reconnection on token rotation, and automatic cleanup:

```tsx
// src/hooks/useRealtimeAlerts.ts
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./useAuth";
import { useToast } from "./useToast";

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useRealtimeAlerts(onAlertReceived?: (alert: any) => void) {
  const { accessToken, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Initialize Socket.IO client with JWT handshake
    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on("alert:new", (data) => {
      toast({
        title: `⚠️ ${data.alert.title}`,
        description: data.alert.message,
        variant: "destructive",
      });

      if (onAlertReceived) {
        onAlertReceived(data.alert);
      }
    });

    // Cleanup on component unmount or token change
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, isAuthenticated, onAlertReceived, toast]);

  return socketRef.current;
}
```

---

## 5. Security & Safety Summary

| Capability | Backend Enforcement | Frontend Responsibility |
| :--- | :--- | :--- |
| **Authentication** | Handshake rejected if JWT is expired, missing, or signature invalid. | Pass valid `accessToken` on connect. Reconnect with new token after refresh. |
| **Tenant Isolation** | Server only places socket into `tenant:<id>` room matching JWT claims. | Never emit cross-tenant messages. |
| **Role Guarding** | Server routes events strictly based on user's authorized role room. | Gracefully ignore events not intended for current view. |
| **Data Masking** | Cost/margin metrics are omitted from events dispatched to the `store` role. | Display appropriate role-based dashboard widgets. |

