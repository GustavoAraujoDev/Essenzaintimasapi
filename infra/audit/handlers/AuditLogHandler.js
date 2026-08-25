const crypto = require("crypto");

class AuditLogHandler {
  constructor(auditRepository) {
    this.auditRepository = auditRepository;
  }

  async handle(event) {
    try {
      const lastLog = await this.auditRepository.findLast();
      const previousHash = lastLog?.hash || null;

      const basePayload = {
        event: event.constructor.name,
        entity: event.entity,
        entityId: event.entityId,
        userId: event.userId,
        userEmail: event.userEmail,
        status: event.status,
        oldData: event.oldData || null,
        newData: event.newData || null,
        snapshot: event.snapshot || null,
        errorMessage: event.errorMessage,
        ip: event.context?.ip,
        userAgent: event.context?.userAgent,
        previousHash,
        occurredAt: event.occurredAt
      };

      const hash = crypto
        .createHash("sha256")
        .update(JSON.stringify(basePayload))
        .digest("hex");

      await this.auditRepository.save({
        ...basePayload,
        hash
      });

    } catch (error) {
      console.error("[AUDIT_HANDLER_ERROR]", error.message);
      // nunca quebra o fluxo principal
    }
  }
}


module.exports = AuditLogHandler;
