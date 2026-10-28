import { IUserRepository, User, NewUser } from "../interfaces/user.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { UserModel } from "../models/user.model.js";

export class MongoUserRepository implements IUserRepository {
  private toEntity(doc: any): User {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      email: doc.email,
      name: doc.name,
      passwordHash: doc.passwordHash,
      role: doc.role,
      isActive: doc.isActive,
      refreshTokens: doc.refreshTokens || [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(data: NewUser, tx?: TxContext): Promise<User> {
    const docs = await UserModel.create([data], { session: tx?.session || null });
    return this.toEntity(docs[0]!);
  }

  async findById(tenantId: string, id: string): Promise<User | null> {
    const doc = await UserModel.findOne({ _id: id, tenantId }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ tenantId, email: email.toLowerCase().trim() }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async addRefreshToken(tenantId: string, userId: string, token: string, maxTokens = 5): Promise<void> {
    const user = await UserModel.findOne({ _id: userId, tenantId });
    if (user) {
      user.refreshTokens.push(token);
      if (user.refreshTokens.length > maxTokens) {
        user.refreshTokens.shift();
      }
      await user.save();
    }
  }

  async replaceRefreshToken(
    tenantId: string,
    userId: string,
    oldToken: string,
    newToken: string
  ): Promise<boolean> {
    const user = await UserModel.findOne({ _id: userId, tenantId, refreshTokens: oldToken });
    if (!user) return false;

    user.refreshTokens = user.refreshTokens.filter((t) => t !== oldToken);
    user.refreshTokens.push(newToken);
    await user.save();
    return true;
  }

  async removeRefreshToken(tenantId: string, userId: string, token: string): Promise<void> {
    await UserModel.updateOne({ _id: userId, tenantId }, { $pull: { refreshTokens: token } });
  }

  async list(tenantId: string): Promise<User[]> {
    const docs = await UserModel.find({ tenantId, isActive: true }).sort({ name: 1 }).lean();
    return docs.map((d) => this.toEntity(d));
  }
}
