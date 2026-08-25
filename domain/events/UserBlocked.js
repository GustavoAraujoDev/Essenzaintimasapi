class UserBlocked {
  constructor({ userId, reason }) {
    this.entity = "User";
    this.entityId = userId;

    this.userId = userId;
    this.userEmail = null;

    this.status = "BLOCKED";

    this.reason = reason;
    this.errorMessage = reason;

    this.context = null;

    this.occurredAt = new Date();
  }
}

module.exports = UserBlocked;
