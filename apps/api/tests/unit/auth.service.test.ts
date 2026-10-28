import { describe, it, expect, beforeEach } from "vitest";
import { AuthService } from "../../src/services/auth.service.js";
import { IUserRepository, User, NewUser } from "../../src/interfaces/user.repository.js";
import { UserRole } from "@loompilot/shared";
import { ConflictError, UnauthorizedError, ForbiddenError } from "../../src/errors/index.js";

class FakeUserRepository implements IUserRepository {
  private users: User[] = [];

  async create(data: NewUser): Promise<User> {
    const user: User = {
      id: `usr_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role,
      isActive: data.isActive ?? true,
      refreshTokens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  async findById(tenantId: string, id: string): Promise<User | null> {
    return this.users.find((u) => u.tenantId === tenantId && u.id === id) || null;
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.users.find((u) => u.tenantId === tenantId && u.email === email) || null;
  }

  async addRefreshToken(tenantId: string, userId: string, token: string): Promise<void> {
    const user = await this.findById(tenantId, userId);
    if (user) {
      user.refreshTokens.push(token);
    }
  }

  async replaceRefreshToken(
    tenantId: string,
    userId: string,
    oldToken: string,
    newToken: string
  ): Promise<boolean> {
    const user = await this.findById(tenantId, userId);
    if (!user || !user.refreshTokens.includes(oldToken)) return false;
    user.refreshTokens = user.refreshTokens.filter((t) => t !== oldToken);
    user.refreshTokens.push(newToken);
    return true;
  }

  async removeRefreshToken(tenantId: string, userId: string, token: string): Promise<void> {
    const user = await this.findById(tenantId, userId);
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
    }
  }

  async list(tenantId: string): Promise<User[]> {
    return this.users.filter((u) => u.tenantId === tenantId);
  }

  async count(tenantId: string): Promise<number> {
    return this.users.filter((u) => u.tenantId === tenantId).length;
  }
}

describe("Unit: AuthService", () => {
  let fakeRepo: FakeUserRepository;
  let service: AuthService;
  const tenantId = "tenant_auth_unit";

  beforeEach(() => {
    fakeRepo = new FakeUserRepository();
    service = new AuthService(fakeRepo);
  });

  it("registers a user with hashed password and prevents duplicate emails", async () => {
    const user = await service.register({
      tenantId,
      email: "test@loompilot.test",
      password: "securepassword",
      name: "Test User",
      role: UserRole.OWNER,
    });

    expect(user.id).toBeDefined();
    expect(user.passwordHash).not.toBe("securepassword");

    const ownerActor = {
      tenantId,
      userId: user.id,
      role: UserRole.OWNER,
      email: user.email,
    };

    await expect(
      service.register(
        {
          tenantId,
          email: "test@loompilot.test",
          password: "anotherpassword",
          name: "Duplicate User",
          role: UserRole.SALES,
        },
        ownerActor
      )
    ).rejects.toThrow(ConflictError);
  });

  it("strictly enforces that first user of a new tenant must be OWNER", async () => {
    const freshTenant = "tenant_fresh_bootstrap";

    // Non-owner first user rejected
    await expect(
      service.register({
        tenantId: freshTenant,
        email: "sales@bootstrap.test",
        password: "password123",
        name: "First Sales",
        role: UserRole.SALES,
      })
    ).rejects.toThrow(ForbiddenError);

    // Owner first user allowed
    const owner = await service.register({
      tenantId: freshTenant,
      email: "owner@bootstrap.test",
      password: "password123",
      name: "First Owner",
      role: UserRole.OWNER,
    });
    expect(owner.role).toBe(UserRole.OWNER);
  });

  it("restricts creating additional users in an existing tenant exclusively to OWNER actor", async () => {
    // 1. First owner
    const owner = await service.register({
      tenantId,
      email: "first_owner@loompilot.test",
      password: "password123",
      name: "First Owner",
      role: UserRole.OWNER,
    });

    const ownerActor = {
      tenantId,
      userId: owner.id,
      role: UserRole.OWNER,
      email: owner.email,
    };

    // 2. Unauthenticated registration in existing tenant rejected
    await expect(
      service.register({
        tenantId,
        email: "public_guest@loompilot.test",
        password: "password123",
        name: "Public Guest",
        role: UserRole.SALES,
      })
    ).rejects.toThrow(ForbiddenError);

    // 3. Store role actor cannot create users
    const storeActor = {
      tenantId,
      userId: "usr_store",
      role: UserRole.STORE,
      email: "store@loompilot.test",
    };
    await expect(
      service.register(
        {
          tenantId,
          email: "another_sales@loompilot.test",
          password: "password123",
          name: "Sales Rep",
          role: UserRole.SALES,
        },
        storeActor
      )
    ).rejects.toThrow(ForbiddenError);

    // 4. Owner actor can successfully create additional user
    const newUser = await service.register(
      {
        tenantId,
        email: "new_manager@loompilot.test",
        password: "password123",
        name: "Manager Rep",
        role: UserRole.MANAGER,
      },
      ownerActor
    );
    expect(newUser.id).toBeDefined();
    expect(newUser.role).toBe(UserRole.MANAGER);
  });

  it("authenticates valid credentials and rejects invalid credentials", async () => {
    await service.register({
      tenantId,
      email: "login@loompilot.test",
      password: "mypassword123",
      name: "Login User",
      role: UserRole.OWNER,
    });

    const res = await service.login({
      tenantId,
      email: "login@loompilot.test",
      password: "mypassword123",
    });

    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    expect(res.user.email).toBe("login@loompilot.test");

    await expect(
      service.login({
        tenantId,
        email: "login@loompilot.test",
        password: "wrongpassword",
      })
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      service.login({
        tenantId,
        email: "nonexistent@loompilot.test",
        password: "mypassword123",
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it("refreshes token validly and rotates refresh token", async () => {
    await service.register({
      tenantId,
      email: "refresh@loompilot.test",
      password: "mypassword123",
      name: "Refresh User",
      role: UserRole.OWNER,
    });

    const initial = await service.login({
      tenantId,
      email: "refresh@loompilot.test",
      password: "mypassword123",
    });

    const rotated = await service.refresh(initial.refreshToken);
    expect(rotated.accessToken).toBeDefined();
    expect(rotated.refreshToken).toBeDefined();
    expect(rotated.refreshToken).not.toBe(initial.refreshToken);

    // Old token should be invalidated
    await expect(service.refresh(initial.refreshToken)).rejects.toThrow(UnauthorizedError);
  });
});

