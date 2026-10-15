class UserPolicy {
  /**
   * ABAC para login
   */
  /**

   * ABAC: somente ADMIN e EMPLOYEE podem fazer login.

   */

  static canLogin(user, context = {}) {

    if (!user || user.status !== "ACTIVE") {

      return false;

    }

    // Somente administrador e funcionário.

    const allowedRoles = ["ADMIN", "EMPLOYEE"];

    if (!allowedRoles.includes(user.role)) {

      return false;

    }

    // Bloqueia IP na lista negra.

    if (context.ip === "BLACKLISTED") {

      return false;

    }

    // Exige dispositivo confiável e MFA.

    if (

      context.deviceTrusted !== true ||

      context.mfaValidated !== true

    ) {

      return false;

    }

    return true;

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
