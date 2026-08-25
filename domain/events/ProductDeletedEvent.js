// src/domain/events/ProductDeletedEvent.js

class ProductDeletedEvent {
  constructor({
    entity,
    entityId,
    userId,
    userEmail,
    snapshot,
    status,
    context,
    errorMessage = null
  }) {
    this.entity = entity;
    this.entityId = entityId;
    this.userId = userId;
    this.userEmail = userEmail;
    this.snapshot = snapshot; // dados antes da exclusão
    this.status = status; // SUCCESS | BLOCKED | ERROR
    this.context = context; // { ip, userAgent }
    this.errorMessage = errorMessage;
    this.occurredAt = new Date();
  }
}

module.exports = ProductDeletedEvent;
