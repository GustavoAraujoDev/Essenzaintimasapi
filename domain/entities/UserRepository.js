const User = require('../entities/user/user');

class UserRepository {
  findByEmail(email){}
  save(user){}
  findById(id){}
  findAll(){}
  findAccountById(id) {}
  findByEmailNormalized(email) {}
  savePendingEmailChange(id, email, tokenHash, expiresAt) {}
  
  confirmPendingEmailChange(tokenHash){}
}

module.exports = UserRepository;
