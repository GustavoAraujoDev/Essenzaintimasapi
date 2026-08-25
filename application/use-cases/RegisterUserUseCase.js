const User = require('../../domain/entities/user/user');
const Membership = require('../../domain/entities/user/Membership');
const CustomerProfile = require('../../domain/entities/user/CustomerProfile');
const { randomUUID } = require('crypto');
const UserPolicy = require('../../domain/policies/UserPolicy');

class RegisterUserUseCase {
  constructor(userRepository, passwordService, companyRepository, membershipRepository, customerRepository) {
    this.userRepository = userRepository;
    this.passwordService = passwordService;
    this.companyRepository = companyRepository;
    this.membershipRepository = membershipRepository;
    this.customerRepository = customerRepository;
  }

  async execute({ email, password, role, authUserId, context, companyData, customerData }) {
    console.log("[REGISTER] Iniciando registro", { email, role });

    try {
    // 🔐 Validação de Ator/Permissão
      // Se for CUSTOMER, ignoramos a necessidade de um actor (autocadastro)
      if (role !== "CUSTOMER") {
        const actor = await this.userRepository.findById(authUserId);

        if (!actor) {
          throw new Error("Usuário autenticado não encontrado para criar colaboradores/admins");
        }

        if (!UserPolicy.canRegister(actor, context)) {
          throw new Error("Acesso negado: Você não tem permissão para criar este tipo de usuário");
        }
      }

      if (!email || !password) {
        throw new Error("Email e senha são obrigatórios");
      }

      const normalizedEmail = email.toLowerCase().trim();

      const exists = await this.userRepository.findByEmail(normalizedEmail);
      if (exists) throw new Error("Usuário já existe");

      const allowedRoles = ["ADMIN", "EMPLOYEE", "CUSTOMER"];
      if (!allowedRoles.includes(role)) {
        throw new Error("Role inválida");
      }

      // 🔐 senha
      const passwordHash = await this.passwordService.hash(password);

      // 👤 USER
      const user = new User({
        id: randomUUID(),
        email: normalizedEmail,
        passwordHash,
        role,
        status: "ACTIVE"
      });

      await this.userRepository.save(user);

      console.log("[REGISTER] User criado", user.id);

      // =========================
      // 🏢 EMPRESA + MEMBROS
      // =========================
      if (role === "ADMIN" || role === "EMPLOYEE") {

        const company = {
          id: randomUUID(),
          name: companyData?.name || "Empresa sem nome",
          document: companyData?.document || "00000000000000",
          email: companyData?.email || null,
          phone: companyData?.phone || null,
          status: "ACTIVE",
          plan: "FREE"
        };

        await this.companyRepository.criar(company);

        const membership = new Membership({
          id: randomUUID(),
          userId: user.id,
          companyId: company.id,
          role: role === "ADMIN" ? "OWNER" : "STAFF",
          status: "ACTIVE"
        });

        await this.membershipRepository.criar(membership);

        console.log("[REGISTER] Company + Membership criados");
      }

      // =========================
      // 👤 CLIENTE FINAL
      // =========================
      if (role === "CUSTOMER") {

        const customerProfile = new CustomerProfile({
          id: randomUUID(),
          userId: user.id,
          name: customerData?.name || "Cliente",
          phone: customerData?.phone || null,
          document: customerData?.document || null
        });

        await this.customerRepository.criar(customerProfile);

        console.log("[REGISTER] CustomerProfile criado");
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      };

    } catch (error) {
      console.error("[REGISTER] ERRO", {
        message: error.message,
        stack: error.stack
      });

      throw error;
    }
  }
}

module.exports = RegisterUserUseCase;