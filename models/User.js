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

async function createWithPassword({ username, password, role = 'member', displayName, email }) {
  const users = await loadUsers();
  const normalizedUsername = username.trim();
  const now = new Date().toISOString();
  const user = {
    _id: crypto.randomUUID(),
    username: normalizedUsername,
    passwordHash: hashPassword(password),
    role,
    displayName: displayName?.trim() || normalizedUsername,
    email: email?.trim() || '',
    createdAt: now,
  };
  users.push(user);
  await saveUsers(users);
  return { ...user };
}

async function verifyCredentials(username, password) {
  const users = await loadUsers();
  const normalized = username.trim().toLowerCase();
  const user =
    users.find((entry) => entry.username && entry.username.toLowerCase() === normalized) || null;
  if (!user) return null;
  if (user.passwordHash !== hashPassword(password)) return null;
  const sanitized = { ...user };
  sanitized.displayName = sanitized.displayName || sanitized.username;
  sanitized.email = sanitized.email || '';
  return sanitized;
}

async function ensureDefaultAdmin() {
  const admin = await findOne({ username: 'admin' });
  if (!admin) {
    await createWithPassword({
      username: 'admin',
      password: 'admin',
      role: 'admin',
      displayName: 'Library Administrator',
      email: 'admin@local',
    });
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
