class CustomerProfile {
  constructor({
    id,
    userId,
    name,
    phone,
    document = null,
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    if (!userId) throw new Error("User obrigatório");
    if (!name) throw new Error("Nome obrigatório");

    this.id = id;
    this.userId = userId;

    this.name = name;
    this.phone = phone;
    this.document = document;

    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  updatePhone(phone) {
    this.phone = phone;
    this.touch();
  }

  touch() {
    this.updatedAt = new Date();
  }
}

module.exports = CustomerProfile;