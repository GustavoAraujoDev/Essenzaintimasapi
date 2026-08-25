// src/infrastructure/audit-db/auditConnection.js

const mongoose = require("mongoose");

const auditConnection = mongoose.createConnection(
  `mongodb+srv://essenzaintimas:essenzaintimas27@guguaraujo.iedc8kv.mongodb.net/?appName=guguaraujo`,
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
