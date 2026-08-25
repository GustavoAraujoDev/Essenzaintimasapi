function AuthMiddleware(jwtService, allowedRoles = []) {
  return (req, res, next) => {
    try {
      // 1️⃣ Agora buscamos o token nos Cookies em vez do Header
      // O nome 'accessToken' deve ser o mesmo que você usou no res.cookie() do Login
      const token = req.cookies.accessToken;

      if (!token) {
        console.warn("[AUTH] Cookie de acesso não encontrado");
        return res
          .status(401)
          .json({ error: "Sessão expirada ou não encontrada" });
      }

      console.log("[AUTH] Token recebido:", token);

      // 3️⃣ Verifica e decodifica o token
      const payload = jwtService.verifyAccessToken(token);
      console.log("[AUTH] Payload decodificado:", payload);

      // 4️⃣ Salva informações do usuário no request
      req.user = {
        id: payload.sub,
        role: payload.role,
        status: "ACTIVE", // 🔥 força
        companyId: payload.companyId,
      };

      // 5️⃣ Validação de roles (opcional)
      if (allowedRoles.length > 0) {
        const allowed = allowedRoles.map((r) => r.toUpperCase());
        const userRole = payload.role.toUpperCase();

        if (!allowed.includes(userRole)) {
          console.warn(`[AUTH] Role "${payload.role}" não autorizada`);
          return res.status(403).json({ error: "Acesso negado" });
        }
      }

      // ✅ Tudo ok, próximo middleware ou controller
      next();
    } catch (err) {
      // 6️⃣ Erros do JWT (expirado, inválido, secret errado)
      console.error("[AUTH] Token inválido:", err.message);
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }
  };
}

module.exports = AuthMiddleware;
