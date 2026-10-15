const UserPolicy = require("../../../domain/policies/UserPolicy");
class LoginUserUseCase {
  constructor(
    userRepo,
    membershipRepo,
    passwordHasher,
    tokenService,
    eventDispatcher
  ) {
    this.userRepo = userRepo;
    this.membershipRepo = membershipRepo;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
    this.eventDispatcher = eventDispatcher;
  }
  async execute({ email, password, context = {} }) {
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      throw new Error("INVALID_CREDENTIALS");
    }
    const user = await this.userRepo.findByEmail(
      email.trim().toLowerCase()
    );
    if (!user) {
      throw new Error("INVALID_CREDENTIALS");
    }
    // 1. Verifica se a conta está ativa e se a senha é válida.
    if (user.status !== "ACTIVE") {
      throw new Error("LOGIN_NOT_ALLOWED");
    }
    const validPassword = await this.passwordHasher.compare(
      password,
      user.passwordHash
    );
    if (!validPassword) {
      user.registerFailedLogin();
      await this.userRepo.update(user);
      await this.eventDispatcher.dispatchAll(
        user.pullDomainEvents()
      );
      throw new Error("INVALID_CREDENTIALS");
    }
    // 2. Autorização centralizada no backend.
    // Somente ADMIN e EMPLOYEE são permitidos.
    if (!UserPolicy.canLogin(user, context)) {
      throw new Error("LOGIN_NOT_ALLOWED");
    }
    // 3. Verifica o vínculo empresarial.
    // Nenhum papel não autorizado recebe acesso.
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      throw new Error("LOGIN_NOT_ALLOWED");
    }
    const membership =
      await this.membershipRepo.buscarPorId(user.id);
    if (!membership) {
      throw new Error("USER_WITHOUT_COMPANY");
    }
    const validMembershipRoles = {
  ADMIN: ["OWNER"],
  EMPLOYEE: ["STAFF"]
};

const allowedRoles = validMembershipRoles[user.role];

if (
  !allowedRoles ||
  !allowedRoles.includes(membership.role)
) {
  throw new Error("MEMBERSHIP_ROLE_MISMATCH");
}

if (membership.status !== "ACTIVE") {
  throw new Error("MEMBERSHIP_INACTIVE");
}
    // 4. Registra o login bem-sucedido.
    user.registerSuccessfulLogin(context);
    await this.userRepo.update(user);
    await this.eventDispatcher.dispatchAll(
      user.pullDomainEvents()
    );
    // 5. Emite os tokens somente após todas as validações.
    const accessToken =
      this.tokenService.generateAccessToken(
        user,
        membership
      );
    const refreshToken =
      await this.tokenService.generateRefreshToken(user);
    return {
      accessToken,
      refreshToken
    };
  }
}
module.exports = LoginUserUseCase;
