const crypto = require('crypto');

class MemoryStore {
  constructor() {
    this.sessions = new Map();
  }
  get(sid) {
    const entry = this.sessions.get(sid);
    return entry ? entry.data : undefined;
  }
  set(sid, sess) {
    this.sessions.set(sid, { data: { ...sess }, updatedAt: Date.now() });
  }
  destroy(sid) {
    this.sessions.delete(sid);
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const [key, value] = part.split('=');
    if (!key) return;
    out[key.trim()] = decodeURIComponent((value || '').trim());
  });
  return out;
}

module.exports = function session(options = {}) {
  const store = options.store || new MemoryStore();
  const name = options.name || 'sid';
  const cookie = options.cookie || { path: '/', httpOnly: true, maxAge: 1000 * 60 * 60 * 24 };

  return function sessionMiddleware(req, res, next) {
    const cookies = parseCookies(req.headers.cookie);
    let sid = cookies[name];
    let sessionData = sid && store.get(sid);
    if (!sessionData) {
      sid = crypto.randomBytes(16).toString('hex');
      sessionData = {};
      store.set(sid, sessionData);
      const cookieParts = [`${name}=${encodeURIComponent(sid)}`, `Path=${cookie.path || '/'}`];
      if (cookie.httpOnly !== false) cookieParts.push('HttpOnly');
      if (cookie.sameSite) cookieParts.push(`SameSite=${cookie.sameSite}`);
      if (cookie.secure) cookieParts.push('Secure');
      if (cookie.maxAge) cookieParts.push(`Max-Age=${Math.floor(cookie.maxAge / 1000)}`);
      res.setHeader('Set-Cookie', cookieParts.join('; '));
    }
    req.sessionID = sid;
    req.session = sessionData;
    const originalEnd = res.end;
    res.end = function endProxy(chunk, encoding, cb) {
      store.set(sid, req.session || {});
      return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
  };
};

module.exports.MemoryStore = MemoryStore;
