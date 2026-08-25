class Membership {
  constructor({
    id,
    userId,
    companyId,
    role,
    status = "ACTIVE",
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    if (!userId) throw new Error("User obrigatório");
    if (!companyId) throw new Error("Company obrigatório");

    const roles = ["OWNER", "ADMIN", "STAFF"];
    if (!roles.includes(role)) {
      throw new Error("Role inválido");
    }

    this.id = id;
    this.userId = userId;
    this.companyId = companyId;
    this.role = role;
    this.status = status;

    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isActive() {
    return this.status === "ACTIVE";
  }
}

module.exports = Membership;