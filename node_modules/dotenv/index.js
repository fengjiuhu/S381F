const fs = require('fs');
const path = require('path');

function parse(content) {
  const out = {};
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  });
  return out;
}

module.exports.config = function config(options = {}) {
  const filePath = options.path || path.join(process.cwd(), '.env');
  if (!fs.existsSync(filePath)) {
    return { parsed: {} };
  }
  const parsed = parse(fs.readFileSync(filePath, 'utf8'));
  Object.keys(parsed).forEach((key) => {
    if (process.env[key] === undefined) {
      process.env[key] = parsed[key];
    }
  });
  return { parsed };
};
