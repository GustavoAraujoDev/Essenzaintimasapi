const UserRepository = require("../../domain/entities/UserRepository");
const User = require("../../domain/entities/user/user");

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["ADMIN", "EMPLOYEE", "CUSTOMER"],
      default: "EMPLOYEE"
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'blocked', 'inactive'],
      default: 'ACTIVE'
}
  },
  {
    timestamps: true
  }
);

const UserModel = mongoose.model("User", UserSchema);


// ------------------------
// Repositório MongoDB
// ------------------------
class UserRepositoryMongo extends UserRepository {

  // Salvar usuário
  async save(user) {
    await UserModel.create({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      status: user.status,
      loginAttempts: user.loginAttempts,
      lastLoginAt: user.lastLoginAt,
      blockedAt: user.blockedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  }

  // Buscar usuário por email
  async findByEmail(email) {
    const doc = await UserModel.findOne({ email }).lean();
    if (!doc) return null;

    return new User({
      id: doc.id.toString(),
      email: doc.email,
      passwordHash: doc.passwordHash,
      role: doc.role,
      status: doc.status ?? "ACTIVE",
      loginAttempts: doc.loginAttempts ?? 0,
      lastLoginAt: doc.lastLoginAt ?? null,
      blockedAt: doc.blockedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  // Buscar usuário por ID
  async findById(id) {
    const userId = typeof id === "string" ? id : id.id;
    const doc = await UserModel.findOne({ id: userId }).lean();
    if (!doc) return null;

    return new User({
      id: doc.id.toString(),
      email: doc.email,
      passwordHash: doc.passwordHash,
      role: doc.role,
      status: doc.status ?? "ACTIVE",
      loginAttempts: doc.loginAttempts ?? 0,
      lastLoginAt: doc.lastLoginAt ?? null,
      blockedAt: doc.blockedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  // Atualizar usuário
  async update(user) {
    await UserModel.updateOne(
      { id: user.id },
      {
        $set: {
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          blockedAt: user.blockedAt,
          loginAttempts: user.loginAttempts,
          updatedAt: user.updatedAt
        }
      }
    );
  }

  // Listar todos os usuários
  async findAll() {
    const docs = await UserModel.find({}).lean();
    return docs.map(doc => new User({
      id: doc.id.toString(),
      email: doc.email,
      passwordHash: doc.passwordHash,
      role: doc.role,
      status: doc.status ?? "ACTIVE",
      loginAttempts: doc.loginAttempts ?? 0,
      lastLoginAt: doc.lastLoginAt ?? null,
      blockedAt: doc.blockedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));
  }
}

module.exports = { UserRepositoryMongo, UserModel };
