// src/domain/events/ProductCreatedEvent.js

class ProductCreatedEvent {
  constructor({
    entity,
    entityId,
    userId,
    userEmail,
    newData,
    status,
    context,
    errorMessage = null
  }) {
    this.entity = entity;            // "Product"
    this.entityId = entityId;        // id do produto criado
    this.userId = userId;
    this.userEmail = userEmail;
    this.newData = newData;          // dados criados
    this.status = status;            // SUCCESS | BLOCKED | ERROR
    this.context = context;          // { ip, userAgent }
    this.errorMessage = errorMessage;
    this.occurredAt = new Date();
  }
}

module.exports = ProductCreatedEvent;
