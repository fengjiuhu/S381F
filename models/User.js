const crypto = require('crypto');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  passwordHash: String,
  role: { type: String, default: 'staff' },
  createdAt: { type: Date, default: () => new Date() },
});

const User = mongoose.model('User', userSchema);

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

User.createWithPassword = async function createWithPassword({ username, password, role }) {
  const passwordHash = hashPassword(password);
  return User.create({ username, passwordHash, role });
};

User.verifyCredentials = async function verifyCredentials(username, password) {
  const user = await User.findOne({ username });
  if (!user) return null;
  const passwordHash = hashPassword(password);
  if (user.passwordHash !== passwordHash) return null;
  return user;
};

module.exports = User;
module.exports.hashPassword = hashPassword;
