class Company {
  constructor({
    id,
    name,
    document, // CNPJ
    email = null,
    phone = null,
    status = "ACTIVE", // ACTIVE | SUSPENDED | INACTIVE
    plan = "FREE", // FREE | PRO | ENTERPRISE
    address = null,
    settings = {},
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.validate({ name, document });

    this.id = id;
    this.name = name;
    this.document = document;

    this.email = email;
    this.phone = phone;

    this.status = status;
    this.plan = plan;

    this.address = address;
    this.settings = settings;

    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /* ==========================
     VALIDATIONS
     ========================== */

  validate({ name, document }) {
    if (!name || typeof name !== "string") {
      throw new Error("Nome da empresa inválido");
    }

    if (!document || document.length < 11) {
      throw new Error("Documento inválido (CNPJ)");
    }
  }

  /* ==========================
     BUSINESS RULES
     ========================== */

  isActive() {
    return this.status === "ACTIVE";
  }

  suspend() {
    this.status = "SUSPENDED";
    this.touch();
  }

  activate() {
    this.status = "ACTIVE";
    this.touch();
  }

  deactivate() {
    this.status = "INACTIVE";
    this.touch();
  }

  updatePlan(plan) {
    const allowed = ["FREE", "PRO", "ENTERPRISE"];

    if (!allowed.includes(plan)) {
      throw new Error("Plano inválido");
    }

    this.plan = plan;
    this.touch();
  }

  updateSettings(settings) {
    this.settings = {
      ...this.settings,
      ...settings
    };

    this.touch();
  }

  /* ==========================
     UTIL
     ========================== */

  touch() {
    this.updatedAt = new Date();
  }
}

module.exports = Company;