class UserLoggedIn {
  constructor({ userId, ip, userAgent = null }) {
    this.entity = "User";
    this.entityId = userId;

    this.userId = userId;
    this.userEmail = null;

    this.status = "SUCCESS";

    this.context = {
      ip,
      userAgent
    };

    this.occurredAt = new Date();
  }
}

module.exports = UserLoggedIn;
