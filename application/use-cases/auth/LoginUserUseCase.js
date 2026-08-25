const UserPolicy = require('../../../domain/policies/UserPolicy');

class LoginUserUseCase {
  constructor(
    userRepo,
    membershipRepo, // 🔥 ADICIONADO
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

  async execute({ email, password, context }) {
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // 🔥 ABAC (Policy pura)
    if (!UserPolicy.canLogin(user, context)) {
      user.registerFailedLogin();
      await this.userRepo.update(user);
      await this.eventDispatcher.dispatchAll(
        user.pullDomainEvents()
      );
      throw new Error('LOGIN_NOT_ALLOWED');
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
      throw new Error('INVALID_CREDENTIALS');
    }

   // 🏢 4. Buscar empresa do usuário (multi-tenant)
    let membership = null;

    // Se NÃO for cliente, ele OBRIGATORIAMENTE precisa de uma empresa
    if (user.role !== 'CUSTOMER') {
      membership = await this.membershipRepo.buscarPorId(user.id);
      
      console.log("Membership encontrada:", membership);

      if (!membership) {
        throw new Error('USER_WITHOUT_COMPANY');
      }
    } else {
      // Se for CUSTOMER, criamos um objeto de "membership" fictício ou nulo
      // para não quebrar a geração do token
      membership = { companyId: 'SYSTEM', role: 'CUSTOMER' }; 
      console.log("Login de Cliente: Membership ignorada.");
    }
    
    user.registerSuccessfulLogin(context);
    await this.userRepo.update(user);

    await this.eventDispatcher.dispatchAll(
      user.pullDomainEvents()
    );

    return {
      accessToken: this.tokenService.generateAccessToken(user, membership),
      refreshToken: await this.tokenService.generateRefreshToken(user)
    };
  }
}

module.exports = LoginUserUseCase;
