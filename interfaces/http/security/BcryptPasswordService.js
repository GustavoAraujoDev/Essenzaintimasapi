const bcrypt = require('bcrypt');
const PasswordService =  require('../../../domain/services/PasswordService');

class BcryptPasswordService extends PasswordService {
  async hash(password) {
    return bcrypt.hash(password, 12);
  }

  async compare(password, hash) {
    return bcrypt.compare(password, hash);
  }
}

module.exports = BcryptPasswordService;
