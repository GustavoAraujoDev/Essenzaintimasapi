// src/infrastructure/audit/AuditSchema.js

const mongoose = require("mongoose");
const auditConnection = require("../database/mongodb/auditConnection");

const AuditSchema = new mongoose.Schema({

  event: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String, required: true },

  userId: { type: String, required: true },
  userEmail: { type: String },

  status: {
    type: String,
    enum: ["SUCCESS", "BLOCKED", "ERROR"],
    required: true
  },

  changedFields: { type: Object },
  errorMessage: { type: String },

  ip: { type: String },
  userAgent: { type: String },

  previousHash: { type: String },
  hash: { type: String, required: true },

  occurredAt: {
    type: Date,
    default: Date.now,
    index: true
  }

}, {
  versionKey: false
});


// 🔐 Índices estratégicos
AuditSchema.index({ entityId: 1 });
AuditSchema.index({ userId: 1 });
AuditSchema.index({ status: 1 });
AuditSchema.index({ occurredAt: -1 });


// ⏳ TTL 5 anos (≈ 1825 dias)
AuditSchema.index(
  { occurredAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 1825 }
);


// 🚫 Impedir update/delete (append-only)
AuditSchema.pre("findOneAndUpdate", function () {
  throw new Error("Audit logs are immutable");
});

AuditSchema.pre("deleteOne", function () {
  throw new Error("Audit logs cannot be deleted");
});

const AuditModel =
  auditConnection.models.Audit ||
  auditConnection.model("Audit", AuditSchema);

// src/infrastructure/audit/MongoAuditRepository.js

const IAuditRepository = require("../../application/repository/IAuditRepository");

class AuditRepositoryMongo extends IAuditRepository {

  async save(data) {
    try {
      return await AuditModel.create(data);
    } catch (error) {
      console.error("[AUDIT_SAVE_ERROR]", error.message);
      throw error;
    }
  }

  async findLast() {
    return AuditModel
      .findOne()
      .sort({ occurredAt: -1 })
      .lean();
  }

  async findByFilters({
    action,
    entity,
    userId,
    status,
    startDate,
    endDate,
    limit = 50
  }) {

    const query = {};

    if (action) query.event = action;
    if (entity) query.entity = entity;
    if (userId) query.userId = userId;
    if (status) query.status = status;

    if (startDate || endDate) {
      query.occurredAt = {};
      if (startDate) query.occurredAt.$gte = new Date(startDate);
      if (endDate) query.occurredAt.$lte = new Date(endDate);
    }

    return AuditModel
      .find(query)
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean();
  }

  async findAll({ page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      AuditModel
        .find()
        .sort({ occurredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      AuditModel.countDocuments()
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
}

module.exports = AuditRepositoryMongo;
