
"use strict";

/**
 * VendaPDVPolicy
 *
 * Camada: Domain / Policies
 *
 * Contrato de entrada:
 * principal = identidade confiável, montada pelo backend
 *
 * {
 *   userId: "id-do-usuario",
 *   userStatus: "ACTIVE",
 *   membership: {
 *     role: "OWNER" | "ADMIN" | "STAFF",
 *     status: "ACTIVE",
 *     companyId: "id-da-empresa"
 *   }
 * }
 *
 * STAFF equivale a EMPLOYEE neste contexto do PDV.
 * OWNER e ADMIN possuem permissões administrativas.
 *
 * Não recebe req.body, req.query ou perfil do front-end.
 */

const ROLE = Object.freeze({
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  STAFF: "STAFF",
});

const ACTION = Object.freeze({
  CREATE: "SALE_CREATE",
  LIST: "SALE_LIST",
  READ: "SALE_READ",
  CANCEL: "SALE_CANCEL",

  DASHBOARD: "SALE_DASHBOARD",
  STATISTICS: "SALE_STATISTICS",
  COMPARISON: "SALE_COMPARISON",
  BY_DAY: "SALE_BY_DAY",
  BY_HOUR: "SALE_BY_HOUR",
  BEST_SELLERS: "SALE_BEST_SELLERS",
  BY_OPERATOR: "SALE_BY_OPERATOR",
  BY_PAYMENT: "SALE_BY_PAYMENT",
  BY_CATEGORY: "SALE_BY_CATEGORY",
  STATUS_SUMMARY: "SALE_STATUS_SUMMARY",
});

const REASON = Object.freeze({
  INVALID_PRINCIPAL: "INVALID_PRINCIPAL",
  INVALID_USER_ID: "INVALID_USER_ID",
  USER_INACTIVE: "USER_INACTIVE",
  INVALID_MEMBERSHIP: "INVALID_MEMBERSHIP",
  MEMBERSHIP_INACTIVE: "MEMBERSHIP_INACTIVE",
  INVALID_ROLE: "INVALID_ROLE",
  INVALID_ACTION: "INVALID_ACTION",
  COMPANY_REQUIRED: "COMPANY_REQUIRED",
  COMPANY_MISMATCH: "COMPANY_MISMATCH",
  FORBIDDEN: "FORBIDDEN",
});

const ADMIN_ACTIONS = new Set([
  ACTION.LIST,
  ACTION.READ,
  ACTION.CANCEL,
  ACTION.DASHBOARD,
  ACTION.STATISTICS,
  ACTION.COMPARISON,
  ACTION.BY_DAY,
  ACTION.BY_HOUR,
  ACTION.BEST_SELLERS,
  ACTION.BY_OPERATOR,
  ACTION.BY_PAYMENT,
  ACTION.BY_CATEGORY,
  ACTION.STATUS_SUMMARY,
]);

const VALID_ACTIONS = new Set(Object.values(ACTION));

const ACTIVE_STATUS = "ACTIVE";

class AuthorizationError extends Error {
  constructor(reason) {
    super("Operação não autorizada.");
    this.name = "AuthorizationError";
    this.code = reason;
  }
}

class VendaPDVPolicy {
  /**
   * Normaliza somente papéis conhecidos.
   * Não aceita role vindo de parâmetros da operação.
   */
  static normalizeRole(role) {
    if (typeof role !== "string") {
      return null;
    }

    const normalized = role.trim().toUpperCase();

    if (normalized === ROLE.OWNER || normalized === ROLE.ADMIN) {
      return ROLE.ADMIN;
    }

    if (normalized === ROLE.STAFF || normalized === "EMPLOYEE") {
      return ROLE.STAFF;
    }

    return null;
  }

  /**
   * Valida a identidade de confiança recebida do backend.
   * Status ausente é negado: não presumimos que a conta esteja ativa.
   */
  static validatePrincipal(principal) {
    if (!principal || typeof principal !== "object") {
      return { allowed: false, reason: REASON.INVALID_PRINCIPAL };
    }

    if (
      typeof principal.userId !== "string" &&
      typeof principal.userId !== "number"
    ) {
      return { allowed: false, reason: REASON.INVALID_USER_ID };
    }

    if (String(principal.userId).trim() === "") {
      return { allowed: false, reason: REASON.INVALID_USER_ID };
    }

    if (principal.userStatus !== ACTIVE_STATUS) {
      return { allowed: false, reason: REASON.USER_INACTIVE };
    }

    const membership = principal.membership;

    if (!membership || typeof membership !== "object") {
      return { allowed: false, reason: REASON.INVALID_MEMBERSHIP };
    }

    if (membership.status !== ACTIVE_STATUS) {
      return { allowed: false, reason: REASON.MEMBERSHIP_INACTIVE };
    }

    const role = this.normalizeRole(membership.role);

    if (!role) {
      return { allowed: false, reason: REASON.INVALID_ROLE };
    }

    if (
      membership.companyId === undefined ||
      membership.companyId === null ||
      String(membership.companyId).trim() === ""
    ) {
      return { allowed: false, reason: REASON.COMPANY_REQUIRED };
    }

    return {
      allowed: true,
      userId: String(principal.userId),
      role,
      companyId: String(membership.companyId),
    };
  }

  /**
   * Autoriza uma ação dentro de uma empresa.
   *
   * expectedCompanyId deve ser resolvido pelo backend
   * a partir do recurso ou do contexto autenticado.
   * Nunca use um ID enviado pelo cliente como prova de acesso.
   */
  static authorize(principal, action, context = {}) {
    if (!VALID_ACTIONS.has(action)) {
      return { allowed: false, reason: REASON.INVALID_ACTION };
    }

    const identity = this.validatePrincipal(principal);

    if (!identity.allowed) {
      return identity;
    }

    const expectedCompanyId = context.expectedCompanyId;

    if (
      expectedCompanyId === undefined ||
      expectedCompanyId === null ||
      String(expectedCompanyId).trim() === ""
    ) {
      return { allowed: false, reason: REASON.COMPANY_REQUIRED };
    }

    if (identity.companyId !== String(expectedCompanyId)) {
      return { allowed: false, reason: REASON.COMPANY_MISMATCH };
    }

    // Ambos os perfis podem criar vendas.
    if (action === ACTION.CREATE) {
      return {
        allowed: true,
        action,
        userId: identity.userId,
        companyId: identity.companyId,
        role: identity.role,
      };
    }

    // Todas as outras ações são exclusivas de ADMIN/OWNER.
    if (ADMIN_ACTIONS.has(action) && identity.role === ROLE.ADMIN) {
      return {
        allowed: true,
        action,
        userId: identity.userId,
        companyId: identity.companyId,
        role: identity.role,
      };
    }

    return {
      allowed: false,
      reason: REASON.FORBIDDEN,
    };
  }

  /**
   * Faz a autorização e interrompe o fluxo quando negada.
   * O controller/error handler deve mapear AuthorizationError
   * para HTTP 403; identidade ausente deve ser tratada pelo
   * middleware de autenticação como HTTP 401.
   */
  static assertCan(principal, action, context = {}) {
    const decision = this.authorize(principal, action, context);

    if (!decision.allowed) {
      throw new AuthorizationError(decision.reason);
    }

    return decision;
  }
}

VendaPDVPolicy.ROLE = ROLE;
VendaPDVPolicy.ACTION = ACTION;
VendaPDVPolicy.REASON = REASON;
VendaPDVPolicy.AuthorizationError = AuthorizationError;

module.exports = VendaPDVPolicy;
