const jwt = require("jsonwebtoken");
const User = require("../../../domain/entities/user/user");
const TokenService = require("../../../application/use-cases/services/TokenService");
const { urlencoded } = require("body-parser");
const crypto = require("crypto");

class JwtService extends TokenService {
  generateAccessToken(user, membership) {
    console.log("[JWT] Gerando access token");
    console.log("[JWT] Payload recebido:", {
      id: user?.id,
      role: user?.role,
      companyId: membership?.companyId,
    });

    console.log("[JWT] JWT_SECRET existe?", !!process.env.JWT_SECRET);

    try {
      const token = jwt.sign(
        {
          sub: user.id,
          role: user.role,
          type: "USER",
          companyId: membership?.companyId,
        },
        process.env.JWT_SECRET,
        {
          // ⚠️ PARA DEBUG — depois trocamos
          algorithm: "HS256",
          expiresIn: "7d",
          issuer: "fintech-auth",
          audience: "fintech-api",
        },
      );

      console.log("[JWT] Access token gerado com sucesso");
      return token;
    } catch (err) {
      console.error("[JWT_ERROR] Falha ao gerar token:", err);
      throw err;
    }
  }

  async generateRefreshToken(user) {
    console.log("[JWT] Gerando refresh token para:", user?.id);
    return crypto.randomUUID();
  }

  verifyAccessToken(token) {
    console.log("[JWT] Verificando access token");

    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "fintech-auth",
      audience: "fintech-api",
    });
  }
}

module.exports = JwtService;
