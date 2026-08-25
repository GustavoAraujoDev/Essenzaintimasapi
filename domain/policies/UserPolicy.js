class UserPolicy {
  /**
   * ABAC para login
   */
  static canLogin(user, context) {
    return (
      user.status === "ACTIVE" &&
      context.ip !== "BLACKLISTED" &&
      context.deviceTrusted === true &&
      context.mfaValidated === true
    );
  }

  static canRegister(actor, context) {
    return (
      actor.status === "ACTIVE" &&
      actor.role === "ADMIN" &&
      context.mfaValidated === true
    );
  }

  /**
   * Exemplo: bloquear usuário
   */
  static canBlockUser(actor, targetUser) {
    return (
      actor.hasRole("admin") &&
      actor.id !== targetUser.id &&
      targetUser.status !== "blocked"
    );
  }

  /**
   * Exemplo: trocar senha
   */
  static canChangePassword(user, context) {
    return user.status === "ACTIVE" && context.sessionAgeMinutes < 15;
  }

  /**
   * Exemplo: acesso por horário (compliance)
   */
  static canAccessSystem(user, context) {
    return user.status === "ACTIVE" && context.time.isBusinessHours();
  }
}

module.exports = UserPolicy;
