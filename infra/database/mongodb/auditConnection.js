// src/infrastructure/audit-db/auditConnection.js

const mongoose = require("mongoose");

const auditConnection = mongoose.createConnection(
  `mongodb+srv://gustavobarrosaraujo10:Gu290901.@gustavoaraujo.s8hht.mongodb.net/?appName=gustavoAraujo`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
);

auditConnection.on("connected", () => {
  console.log("[AUDIT_DB] Connected");
});

auditConnection.on("error", (err) => {
  console.error("[AUDIT_DB_ERROR]", err);
});

module.exports = auditConnection;
