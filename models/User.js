const crypto = require('crypto');
const { readCollection, writeCollection } = require('./storage');

const USERS_FILE = 'users.json';

async function loadUsers() {
  return readCollection(USERS_FILE, []);
}

async function saveUsers(users) {
  await writeCollection(USERS_FILE, users);
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function findOne(filter) {
  const users = await loadUsers();
  return (
    users.find((user) => Object.entries(filter).every(([key, value]) => user[key] === value)) || null
  );
}

async function usernameExists(username) {
  const users = await loadUsers();
  const normalized = username.trim().toLowerCase();
  return users.some((user) => user.username.toLowerCase() === normalized);
}

async function createWithPassword({ username, password, role = 'staff' }) {
  const users = await loadUsers();
  const normalizedUsername = username.trim();
  const now = new Date().toISOString();
  const user = {
    _id: crypto.randomUUID(),
    username: normalizedUsername,
    passwordHash: hashPassword(password),
    role,
    createdAt: now,
  };
  users.push(user);
  await saveUsers(users);
  return { ...user };
}

async function verifyCredentials(username, password) {
  const user = await findOne({ username });
  if (!user) return null;
  return user.passwordHash === hashPassword(password) ? { ...user } : null;
}

async function ensureDefaultAdmin() {
  const admin = await findOne({ username: 'admin' });
  if (!admin) {
    await createWithPassword({ username: 'admin', password: 'admin123', role: 'admin' });
  }
}

module.exports = {
  createWithPassword,
  verifyCredentials,
  findOne,
  ensureDefaultAdmin,
  hashPassword,
  usernameExists,
};
