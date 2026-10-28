import { describe, it, beforeAll, afterAll, expect } from "vitest";
import http from "http";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { initSocketServer, broadcastAlert, broadcastToTenant } from "../../src/realtime/socket.js";
import { env } from "../../src/config/env.js";
import { UserRole } from "@loompilot/shared";

describe("Realtime: Socket.IO Authentication & Role-Based Alert Filtering", () => {
  let server: http.Server;
  let port: number;
  const tenantId = "tenant_socket_test";

  beforeAll(async () => {
    server = http.createServer();
    initSocketServer(server);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function createToken(role: UserRole, userId: string = "usr_test"): string {
    return jwt.sign(
      { userId, email: `${role}@test.com`, role, tenantId },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  }

  function connectSocket(token?: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = Client(`http://localhost:${port}`, {
        auth: token ? { token } : undefined,
        transports: ["websocket"],
        reconnection: false,
      });

      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", (err) => reject(err));
    });
  }

  it("strictly rejects connection without JWT handshake token", async () => {
    await expect(connectSocket()).rejects.toThrow(/Missing realtime auth token/i);
  });

  it("strictly rejects connection with an invalid JWT token", async () => {
    await expect(connectSocket("invalid_token_12345")).rejects.toThrow(/Token verification failed/i);
  });

  it("authenticates valid Owner token and connects successfully", async () => {
    const token = createToken(UserRole.OWNER);
    const socket = await connectSocket(token);
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it("sends production alerts exclusively to Owner and Manager, strictly omitting Store role", async () => {
    const ownerSocket = await connectSocket(createToken(UserRole.OWNER, "usr_owner"));
    const managerSocket = await connectSocket(createToken(UserRole.MANAGER, "usr_manager"));
    const storeSocket = await connectSocket(createToken(UserRole.STORE, "usr_store"));

    const received: { owner?: any; manager?: any; store?: any } = {};

    ownerSocket.on("alert:new", (data) => {
      received.owner = data;
    });
    managerSocket.on("alert:new", (data) => {
      received.manager = data;
    });
    storeSocket.on("alert:new", (data) => {
      received.store = data;
    });

    // Broadcast alert (allowed roles: Owner, Manager)
    broadcastAlert(tenantId, {
      id: "alt_001",
      title: "Output Deficit",
      deficitQty: 250,
      additionalCostPaise: 50000,
    });

    // Allow event loop to dispatch
    await new Promise((r) => setTimeout(r, 100));

    expect(received.owner).toBeDefined();
    expect(received.owner.deficitQty).toBe(250);

    expect(received.manager).toBeDefined();
    expect(received.manager.deficitQty).toBe(250);

    // Store role MUST NOT receive the alert
    expect(received.store).toBeUndefined();

    ownerSocket.disconnect();
    managerSocket.disconnect();
    storeSocket.disconnect();
  });

  it("strips cost and margin data before dispatching any tenant message to Store role", async () => {
    const ownerSocket = await connectSocket(createToken(UserRole.OWNER, "usr_owner_2"));
    const storeSocket = await connectSocket(createToken(UserRole.STORE, "usr_store_2"));

    let ownerPayload: any;
    let storePayload: any;

    ownerSocket.on("order:update", (data) => {
      ownerPayload = data;
    });
    storeSocket.on("order:update", (data) => {
      storePayload = data;
    });

    broadcastToTenant(tenantId, "order:update", {
      orderId: "ord_100",
      orderNumber: "PO-00100",
      status: "in_progress",
      totalCostPaise: 15000000,
      marginPct: 22.5,
      profitPaise: 3375000,
      deliveredQty: 500,
    });

    await new Promise((r) => setTimeout(r, 100));

    // Owner receives all cost and margin fields
    expect(ownerPayload).toBeDefined();
    expect(ownerPayload.totalCostPaise).toBe(15000000);
    expect(ownerPayload.marginPct).toBe(22.5);

    // Store receives non-financial fields only
    expect(storePayload).toBeDefined();
    expect(storePayload.orderNumber).toBe("PO-00100");
    expect(storePayload.deliveredQty).toBe(500);
    expect(storePayload.totalCostPaise).toBeUndefined();
    expect(storePayload.marginPct).toBeUndefined();
    expect(storePayload.profitPaise).toBeUndefined();

    ownerSocket.disconnect();
    storeSocket.disconnect();
  });
});

