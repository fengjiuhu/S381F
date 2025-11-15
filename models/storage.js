const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

async function ensureDataDir() {
  await fs.promises.mkdir(dataDir, { recursive: true });
}

async function readCollection(fileName, defaultValue) {
  await ensureDataDir();
  const filePath = path.join(dataDir, fileName);
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data.map((item) => ({ ...item })) : { ...data };
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeCollection(fileName, defaultValue);
      return Array.isArray(defaultValue) ? [...defaultValue] : { ...defaultValue };
    }
    throw err;
  }
}

async function writeCollection(fileName, data) {
  await ensureDataDir();
  const filePath = path.join(dataDir, fileName);
  const serialised = JSON.stringify(data, null, 2);
  await fs.promises.writeFile(filePath, serialised, 'utf8');
}

module.exports = {
  readCollection,
  writeCollection,
};
