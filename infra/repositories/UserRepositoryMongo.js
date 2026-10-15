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
},
pendingEmail: {
  type: String,
  default: null,
  lowercase: true
},

emailChangeTokenHash: {
  type: String,
  default: null
},

emailChangeExpiresAt: {
  type: Date,
  default: null
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
  
  async findAccountById(id) {
  const userId = typeof id === "string" ? id : id?.id;

  if (!userId) return null;

  return UserModel.findOne({ id: userId })
    .select("+passwordHash")
    .lean();
}

async updatePasswordHash(id, passwordHash) {
  const userId = typeof id === "string" ? id : id?.id;

  if (!userId) {
    throw new Error("ID do usuário inválido.");
  }

  return UserModel.findOneAndUpdate(
    { id: userId },
    {
      $set: {
        passwordHash,
        updatedAt: new Date()
      }
    },
    { new: true }
  ).select("-passwordHash").lean();
}

async findByEmailNormalized(email) {
  return UserModel.findOne({
    email: email.trim().toLowerCase()
  }).lean();
}

async savePendingEmailChange(id, email, tokenHash, expiresAt) {
  const userId = typeof id === "string" ? id : id?.id;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await UserModel.findOne({
    email: normalizedEmail,
    id: { $ne: userId }
  }).lean();

  if (existing) {
    const error = new Error("Este e-mail já está cadastrado.");
    error.code = "EMAIL_IN_USE";
    throw error;
  }

  const pending = await UserModel.findOneAndUpdate(
    { id: userId },
    {
      $set: {
        pendingEmail: normalizedEmail,
        emailChangeTokenHash: tokenHash,
        emailChangeExpiresAt: expiresAt,
        updatedAt: new Date()
      }
    },
    { new: true, runValidators: true }
  ).select("-passwordHash").lean();

  if (!pending) {
    throw new Error("Usuário não encontrado.");
  }

  return pending;
}

async confirmPendingEmailChange(tokenHash) {
  const user = await UserModel.findOne({
    emailChangeTokenHash: tokenHash,
    emailChangeExpiresAt: { $gt: new Date() },
    pendingEmail: { $ne: null }
  });

  if (!user) return null;

  const emailEmUso = await UserModel.findOne({
    email: user.pendingEmail,
    id: { $ne: user.id }
  }).lean();

  if (emailEmUso) {
    const error = new Error("Este e-mail já está cadastrado.");
    error.code = "EMAIL_IN_USE";
    throw error;
  }

  user.email = user.pendingEmail;
  user.pendingEmail = null;
  user.emailChangeTokenHash = null;
  user.emailChangeExpiresAt = null;
  user.updatedAt = new Date();

  await user.save();

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status
  };
}
}

module.exports = { UserRepositoryMongo, UserModel };
