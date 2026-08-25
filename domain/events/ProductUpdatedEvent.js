class ProductUpdatedEvent {
  constructor({
    entity,
    entityId,
    userId,
    userEmail,
    previousData,
    updatedData,
    status,
    context,
    errorMessage = null
  }) {
    this.entity = entity;           // "Product"
    this.entityId = entityId;
    this.userId = userId;
    this.userEmail = userEmail;

    this.previousData = previousData; // snapshot antes
    this.updatedData = updatedData;   // snapshot depois

    this.status = status;            // SUCCESS | BLOCKED | ERROR
    this.context = context;
    this.errorMessage = errorMessage;

    this.occurredAt = new Date();
  }
}

module.exports = ProductUpdatedEvent;
