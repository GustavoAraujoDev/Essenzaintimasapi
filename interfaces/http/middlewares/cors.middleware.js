const cors = require("cors");
const corsWhiteList = require("../../../shared/config/cors.config");

function corsMiddleware() {
  const env = process.env.NODE_ENV || "development";
  const getCorsWhiteList = (env) => corsWhiteList[env];
  const allowedOrigins = getCorsWhiteList(env) || [];

  return cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(
        new Error(`CORS Bloqueado para origin: ${origin}`),
        false,
      );
    },

    credentials: true,

    methods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-Id",
      "X-Client-version",
    ],

    exposedHeaders: ["X-Request-Id"],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
}

module.exports = corsMiddleware;
