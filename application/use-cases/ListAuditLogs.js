// src/application/usecases/ListAuditLogs.js

class ListAuditLogs {

  constructor(auditRepository, userRepository) {
    this.auditRepository = auditRepository;
    this.userRepository = userRepository;
  }

  async execute({ userId, page = 1, limit = 20 }) {

    // 🔐 Verifica usuário
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // 🔒 Apenas ADMIN pode listar auditoria
    if (user.role !== "ADMIN") {
      throw new Error("Acesso negado");
    }

    return await this.auditRepository.findAll({ page, limit });
  }
}

module.exports = ListAuditLogs;
