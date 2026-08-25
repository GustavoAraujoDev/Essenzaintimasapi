const mongoose = require("mongoose");

const tableStatusSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    unique: true, // Garante um registro único por loja
  },
  // O Map permite que as chaves sejam os números das mesas (strings)
  tables: {
    type: Map,
    of: Array, // Cada mesa contém um array de itens
    default: {},
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("TableStatus", tableStatusSchema);
