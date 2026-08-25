class Address {
  constructor({
    id,
    userId,
    street,
    number,
    district,
    city,
    state,
    zipCode,
    complement = null,
    isDefault = false
  }) {
    if (!userId) throw new Error("User obrigatório");

    this.id = id;
    this.userId = userId;

    this.street = street;
    this.number = number;
    this.district = district;
    this.city = city;
    this.state = state;
    this.zipCode = zipCode;
    this.complement = complement;

    this.isDefault = isDefault;
  }
}

module.exports = Address;