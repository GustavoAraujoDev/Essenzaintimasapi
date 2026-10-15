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
    console.log("[REGISTER] Iniciando registro", { email, role });
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
    // 3. Autorização do cadastro.
    // CUSTOMER pode fazer autocadastro.
    // ADMIN e EMPLOYEE precisam de um administrador autenticado.
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
      // O administrador precisa ter vínculo empresarial ativo.
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
    // 4. Preparar a empresa antes de criar os registros.
    let company = null;
    let membership = null;
    if (role === "ADMIN") {
      // O novo ADMIN recebe uma empresa própria.
      if (!companyData?.name?.trim()) {
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
      membership = new Membership({
        id: randomUUID(),
        userId: null, // Definido após criar o usuário.
        companyId: company.id,
        role: "OWNER",
        status: "ACTIVE"
      });
    }
    if (role === "EMPLOYEE") {
      // Funcionário entra na empresa do ADMIN autenticado.
      // Não cria uma empresa nova.
      company = null;
      membership = new Membership({
        id: randomUUID(),
        userId: null, // Definido após criar o usuário.
        companyId: actorMembership.companyId,
        role: "STAFF",
        status: "ACTIVE"
      });
    }
    // 5. Gerar hash da senha.
    const passwordHash =
      await this.passwordService.hash(password);
    // 6. Criar usuário.
    const user = new User({
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash,
      role,
      status: "ACTIVE"
    });
    // 7. Persistir usuário e seus registros associados.
    // Idealmente, estas operações devem usar uma transação
    // MongoDB para evitar cadastros parcialmente concluídos.
    await this.userRepository.save(user);
    if (role === "ADMIN") {
      await this.companyRepository.criar(company);
    }
    if (membership) {
      // Define o ID real do usuário recém-criado.
      membership.userId = user.id;
      await this.membershipRepository.criar(membership);
    }
    // 8. Criar perfil de cliente somente para CUSTOMER.
    if (role === "CUSTOMER" && customerData) {
      if (!customerData.name?.trim()) {
        throw new Error("CUSTOMER_NAME_REQUIRED");
      }
      const customerProfile = new CustomerProfile({
        id: randomUUID(),
        userId: user.id,
        name: customerData.name.trim(),
        phone: customerData.phone || null,
        document: customerData.document || null
      });
      await this.customerRepository.criar(customerProfile);
    }
    console.log("[REGISTER] Cadastro concluído", {
      userId: user.id,
      role: user.role,
      companyId: membership?.companyId || company?.id || null
    });
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      companyId: membership?.companyId || company?.id || null
    };
  }
}
module.exports = RegisterUserUseCase;