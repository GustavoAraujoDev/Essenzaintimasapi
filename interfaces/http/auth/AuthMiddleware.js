"use strict";
function AuthMiddleware(
  jwtService,
  userRepository,
  membershipRepository,
  allowedRoles = []
) {
  if (!jwtService || !userRepository || !membershipRepository) {
    throw new Error(
      "JWT_SERVICE_E_REPOSITORIOS_SAO_OBRIGATORIOS"
    );
  }
  return async function authMiddleware(req, res, next) {
    try {
      // 1. Obter o token do cookie HttpOnly.
      const token = req.cookies?.accessToken;
      if (!token) {
        return res.status(401).json({
          error: "Sessão expirada ou não encontrada.",
          code: "TOKEN_MISSING",
        });
      }
      // 2. Validar assinatura, expiração, emissor e audiência.
      let payload;
      try {
        payload = jwtService.verifyAccessToken(token);
      } catch (error) {
        return res.status(401).json({
          error: "Token inválido ou expirado.",
          code: "TOKEN_INVALID",
        });
      }
      if (
        payload?.type !== "USER" ||
        typeof payload.sub !== "string" ||
        !payload.sub.trim() ||
        typeof payload.companyId !== "string" ||
        !payload.companyId.trim()
      ) {
        return res.status(401).json({
          error: "Token sem identidade ou empresa válida.",
          code: "TOKEN_PAYLOAD_INVALID",
        });
      }
      const userId = payload.sub;
      const companyId = payload.companyId;
      // 3. Consultar o usuário no banco.
      const user = await userRepository.findById(userId);
      if (!user) {
        return res.status(401).json({
          error: "Usuário não encontrado.",
          code: "USER_NOT_FOUND",
        });
      }
      if (user.status !== "ACTIVE") {
        return res.status(403).json({
          error: "Usuário inativo ou bloqueado.",
          code: "USER_INACTIVE",
        });
      }
      // 4. Consultar a associação específica à empresa.
      const membership =
        await membershipRepository.buscarPorUserECompany(
          String(user.id),
          companyId
        );
      if (!membership) {
        return res.status(403).json({
          error: "Usuário não possui associação a esta empresa.",
          code: "MEMBERSHIP_NOT_FOUND",
        });
      }
      if (membership.status !== "ACTIVE") {
        return res.status(403).json({
          error: "Associação à empresa inativa.",
          code: "MEMBERSHIP_INACTIVE",
        });
      }
      // 5. Normalizar o papel conforme a associação.
      const membershipRole = String(membership.role || "")
        .trim()
        .toUpperCase();
      const roleMap = {
        OWNER: "ADMIN",
        ADMIN: "ADMIN",
        STAFF: "EMPLOYEE",
      };
      const effectiveRole = roleMap[membershipRole];
      if (!effectiveRole) {
        return res.status(403).json({
          error: "Papel inválido na associação.",
          code: "INVALID_MEMBERSHIP_ROLE",
        });
      }
      // 6. Verificar compatibilidade com o papel global.
      const globalRole = String(user.role || "")
        .trim()
        .toUpperCase();
      const compatibleRoles = {
        ADMIN: ["OWNER", "ADMIN"],
        EMPLOYEE: ["STAFF"],
      };
      if (
        !compatibleRoles[globalRole] ||
        !compatibleRoles[globalRole].includes(membershipRole)
      ) {
        return res.status(403).json({
          error: "Papel do usuário incompatível com a empresa.",
          code: "MEMBERSHIP_ROLE_MISMATCH",
        });
      }
      // 7. Aplicar restrições de papel da rota, se configuradas.
      if (allowedRoles.length > 0) {
        const allowed = allowedRoles.map((role) =>
          String(role).trim().toUpperCase()
        );
        if (
          !allowed.includes(effectiveRole) &&
          !allowed.includes(membershipRole)
        ) {
          return res.status(403).json({
            error: "Você não tem permissão para acessar este recurso.",
            code: "FORBIDDEN",
          });
        }
      }
      // 8. Disponibilizar identidade validada para a aplicação.
      req.user = {
        id: String(user.id),
        userId: String(user.id),
        role: effectiveRole,
        globalRole,
        status: user.status,
        companyId: String(membership.companyId),
        membership: {
          role: membershipRole,
          status: membership.status,
          companyId: String(membership.companyId),
        },
      };
      return next();
    } catch (error) {
      // Erros de banco ou de infraestrutura não devem
      // ser apresentados incorretamente como token inválido.
      return next(error);
    }
  };
}
module.exports = AuthMiddleware;