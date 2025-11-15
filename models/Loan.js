const crypto = require('crypto');
const { readCollection, writeCollection } = require('./storage');

const LOANS_FILE = 'loans.json';

async function loadLoans() {
  return readCollection(LOANS_FILE, []);
}

async function saveLoans(loans) {
  await writeCollection(LOANS_FILE, loans);
}

async function find(filter = {}) {
  const loans = await loadLoans();
  return loans.filter((loan) =>
    Object.entries(filter).every(([key, value]) => (value === undefined ? true : loan[key] === value)),
  );
}

async function findById(id) {
  const loans = await loadLoans();
  return loans.find((loan) => loan._id === id) || null;
}

async function create(data) {
  const loans = await loadLoans();
  const now = new Date().toISOString();
  const loan = {
    _id: crypto.randomUUID(),
    borrowerName: data.borrowerName,
    borrowerEmail: data.borrowerEmail,
    cdId: data.cdId,
    cdTitle: data.cdTitle,
    status: data.status || 'borrowed',
    borrowedAt: data.borrowedAt ? new Date(data.borrowedAt).toISOString() : now,
    returnedAt: data.returnedAt ? new Date(data.returnedAt).toISOString() : null,
    createdAt: now,
    updatedAt: now,
  };
  loans.push(loan);
  await saveLoans(loans);
  return { ...loan };
}

function extractUpdates(update) {
  if (!update) return {};
  if (update.$set) return { ...update.$set };
  return { ...update };
}

async function findByIdAndUpdate(id, update) {
  const loans = await loadLoans();
  const index = loans.findIndex((loan) => loan._id === id);
  if (index === -1) return null;
  const updates = extractUpdates(update);
  const nextLoan = { ...loans[index], ...updates, updatedAt: new Date().toISOString() };
  loans[index] = nextLoan;
  await saveLoans(loans);
  return { ...nextLoan };
}

async function deleteMany(filter = {}) {
  const loans = await loadLoans();
  const remaining = loans.filter(
    (loan) => !Object.entries(filter).every(([key, value]) => (value === undefined ? true : loan[key] === value)),
  );
  if (remaining.length === loans.length) return 0;
  await saveLoans(remaining);
  return loans.length - remaining.length;
}

module.exports = {
  find,
  findById,
  create,
  findByIdAndUpdate,
  deleteMany,
};
