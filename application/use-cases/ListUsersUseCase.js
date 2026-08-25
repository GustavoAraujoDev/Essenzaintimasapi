class ListUsersUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute() {
    // Retorna todos os usuários como entidades
    return await this.userRepository.findAll();
  }
}

module.exports = ListUsersUseCase;
