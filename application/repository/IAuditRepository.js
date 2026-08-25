// src/application/repositories/IAuditRepository.js

class IAuditRepository {

  /**
   * Salva um registro de auditoria (append-only)
   */
  async save(data) {
    throw new Error("Method not implemented");
  }

  /**
   * Retorna o último registro para encadeamento de hash
   */
  async findLast() {
    throw new Error("Method not implemented");
  }

  /**
   * Consulta com filtros (para tela admin)
   */
  async findByFilters(filters) {
    throw new Error("Method not implemented");
  }

  async findAll({ page, limit }) {
    throw new Error("Method not implemented");
  }
}

module.exports = IAuditRepository;
