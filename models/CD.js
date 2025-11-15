const crypto = require('crypto');
const { readCollection, writeCollection } = require('./storage');

const CDS_FILE = 'cds.json';

async function loadCDs() {
  return readCollection(CDS_FILE, []);
}

async function saveCDs(cds) {
  await writeCollection(CDS_FILE, cds);
}

function normaliseCD(data) {
  const total =
    typeof data.totalCopies === 'number' ? data.totalCopies : Number(data.totalCopies) || 0;
  let available;
  if (typeof data.availableCopies === 'number') {
    available = data.availableCopies;
  } else {
    available = Number(data.availableCopies ?? total);
    if (!Number.isFinite(available)) available = total;
  }
  const clampedAvailable = Math.max(0, Math.min(available, total));
  return {
    ...data,
    year: typeof data.year === 'number' ? data.year : Number(data.year) || 0,
    totalCopies: total,
    availableCopies: clampedAvailable,
  };
}

async function countDocuments() {
  const cds = await loadCDs();
  return cds.length;
}

async function find() {
  const cds = await loadCDs();
  return cds.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

async function findById(id) {
  const cds = await loadCDs();
  return cds.find((cd) => cd._id === id) || null;
}

function extractUpdates(update) {
  if (!update) return {};
  if (update.$set) return { ...update.$set };
  return { ...update };
}

async function findByIdAndUpdate(id, update) {
  const cds = await loadCDs();
  const index = cds.findIndex((cd) => cd._id === id);
  if (index === -1) return null;
  const updates = normaliseCD({ ...cds[index], ...extractUpdates(update) });
  cds[index] = { ...cds[index], ...updates, updatedAt: new Date().toISOString() };
  await saveCDs(cds);
  return { ...cds[index] };
}

async function findByIdAndDelete(id) {
  const cds = await loadCDs();
  const index = cds.findIndex((cd) => cd._id === id);
  if (index === -1) return null;
  const [removed] = cds.splice(index, 1);
  await saveCDs(cds);
  return { ...removed };
}

async function create(data) {
  const cds = await loadCDs();
  const now = new Date().toISOString();
  const cd = normaliseCD({
    _id: crypto.randomUUID(),
    title: data.title,
    artist: data.artist,
    genre: data.genre,
    year: data.year,
    totalCopies: data.totalCopies,
    availableCopies: data.availableCopies ?? data.totalCopies,
    createdAt: now,
    updatedAt: now,
  });
  cds.push(cd);
  await saveCDs(cds);
  return { ...cd };
}

async function adjustAvailableCopies(id, delta) {
  const cd = await findById(id);
  if (!cd) return null;
  const newAvailable = Math.max(0, Math.min((cd.availableCopies || 0) + delta, cd.totalCopies || 0));
  return findByIdAndUpdate(id, { availableCopies: newAvailable });
}

module.exports = {
  countDocuments,
  find,
  findById,
  create,
  findByIdAndUpdate,
  findByIdAndDelete,
  adjustAvailableCopies,
};
