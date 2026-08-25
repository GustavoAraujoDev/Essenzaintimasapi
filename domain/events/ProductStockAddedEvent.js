class ProductStockAddedEvent {
  constructor({
    entity,
    entityId,
    userId,
    userEmail,
    oldData,
    newData,
    snapshot,
    status,
    context,
    errorMessage = null
  }) {
    this.entity = entity;
    this.entityId = entityId;
    this.userId = userId;
    this.userEmail = userEmail;

    this.oldData = oldData;
    this.newData = newData;

    this.snapshot = snapshot;
    this.status = status;
    this.context = context;
    this.errorMessage = errorMessage;

    this.occurredAt = new Date();
  }
}

module.exports = ProductStockAddedEvent;
