
const User = require("../../domain/entities/user/user");
const Membership = require("../../domain/entities/user/Membership");
const CustomerProfile = require("../../domain/entities/user/CustomerProfile");
const { randomUUID } = require("crypto");
const UserPolicy = require("../../domain/policies/UserPolicy");

class RegisterUserUseCase {
  constructor(
    userRepository,
    passwordService,
    companyRepository,
    membershipRepository,
    customerRepository
  ) {
    this.userRepository = userRepository;
    this.passwordService = passwordService;
    this.companyRepository = companyRepository;
    this.membershipRepository = membershipRepository;
    this.customerRepository = customerRepository;
  }

  async execute({
    email,
    password,
    role,
    authUserId,
    context = {},
    companyData,
    customerData
  }) {
    console.log("[REGISTER] Iniciando registro", {
      email,
      role
    });

    // 1. Validar os dados básicos.
    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      throw new Error("Email e senha são obrigatórios");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const allowedRoles = ["ADMIN", "EMPLOYEE", "CUSTOMER"];

    if (!allowedRoles.includes(role)) {
      throw new Error("ROLE_INVALID");
    }

    // 2. Impedir duplicidade de e-mail.
    const existingUser =
      await this.userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new Error("USER_ALREADY_EXISTS");
    }

    // 3. Validar autorização para cadastro.
    let actor = null;
    let actorMembership = null;

    if (role !== "CUSTOMER") {
      if (!authUserId) {
        throw new Error("AUTHENTICATION_REQUIRED");
      }

      actor = await this.userRepository.findById(authUserId);

      if (!actor || actor.status !== "ACTIVE") {
        throw new Error("ACTOR_NOT_FOUND_OR_INACTIVE");
      }

      if (!UserPolicy.canRegister(actor, context)) {
        throw new Error("REGISTRATION_NOT_ALLOWED");
      }

      if (actor.role !== "ADMIN") {
        throw new Error("REGISTRATION_NOT_ALLOWED");
      }

      // Buscar o vínculo empresarial do administrador.
      actorMembership =
        await this.membershipRepository.buscarPorId(actor.id);

      if (
        !actorMembership ||
        actorMembership.status !== "ACTIVE" ||
        !["OWNER", "ADMIN"].includes(actorMembership.role)
      ) {
        throw new Error("ACTIVE_ADMIN_MEMBERSHIP_REQUIRED");
      }
    }

    // 4. Preparar os dados da empresa.
    // Não criar Membership nesta etapa, pois o usuário
    // ainda não foi criado e salvo.
    let company = null;
    let membership = null;

    if (role === "ADMIN") {
      if (
        typeof companyData?.name !== "string" ||
        !companyData.name.trim()
      ) {
        throw new Error("COMPANY_NAME_REQUIRED");
      }

      company = {
        id: randomUUID(),
        name: companyData.name.trim(),
        document: companyData.document || null,
        email: companyData.email || normalizedEmail,
        phone: companyData.phone || null,
        status: "ACTIVE",
        plan: "FREE"
      };
    }

    if (role === "EMPLOYEE") {
      // O funcionário utilizará a empresa do administrador.
      // Nenhuma empresa nova será criada.
      company = null;
    }

    // 5. Validar o perfil do cliente antes de salvar o usuário.
    if (
      role === "CUSTOMER" &&
      customerData &&
      (
        typeof customerData.name !== "string" ||
        !customerData.name.trim()
      )
    ) {
      throw new Error("CUSTOMER_NAME_REQUIRED");
    }

    // 6. Gerar o hash da senha.
    const passwordHash =
      await this.passwordService.hash(password);

    // 7. Criar a entidade do usuário.
    const user = new User({
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash,
      role,
      status: "ACTIVE"
    });

    // 8. Salvar o usuário.
    await this.userRepository.save(user);

    console.log("[REGISTER] Usuário salvo", {
      userId: user.id,
      role: user.role
    });

    // 9. Criar empresa e vínculo para ADMIN.
    if (role === "ADMIN") {
      await this.companyRepository.criar(company);

      membership = new Membership({
        id: randomUUID(),
        userId: user.id,
        companyId: company.id,
        role: "OWNER",
        status: "ACTIVE"
      });

      await this.membershipRepository.criar(membership);
    }

    // 10. Criar vínculo para EMPLOYEE.
    if (role === "EMPLOYEE") {
      membership = new Membership({
        id: randomUUID(),
        userId: user.id,
        companyId: actorMembership.companyId,
        role: "STAFF",
        status: "ACTIVE"
      });

      await this.membershipRepository.criar(membership);
    }

    // 11. Criar perfil de cliente.
    if (role === "CUSTOMER" && customerData) {
      const customerProfile = new CustomerProfile({
        id: randomUUID(),
        userId: user.id,
        name: customerData.name.trim(),
        phone: customerData.phone || null,
        document: customerData.document || null
      });

      await this.customerRepository.criar(customerProfile);
    }

    // 12. Registrar conclusão.
    const companyId =
      membership?.companyId || company?.id || null;

    console.log("[REGISTER] Cadastro concluído", {
      userId: user.id,
      role: user.role,
      companyId
    });

    // 13. Retornar os dados do usuário.
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      companyId
    };
  }
}

module.exports = RegisterUserUseCase;
