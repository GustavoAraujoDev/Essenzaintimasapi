class TenantPolicy {

  static ensureAccess(user, membership, companyId) {
    if (!user) {
      throw new Error("Não autenticado");
    }

    if (!membership || !membership.isActive()) {
      throw new Error("Sem acesso à empresa");
    }

    if (membership.companyId !== companyId) {
      throw new Error("Acesso negado (tenant inválido)");
    }
  }

  static ensureAdmin(membership) {
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      throw new Error("Sem permissão");
    }
  }
}

module.exports = TenantPolicy;