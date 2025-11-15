const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

function express() {
  const stack = [];
  const settings = { views: path.join(process.cwd(), 'views'), 'view engine': 'ejs' };
  const engines = {};

  function matchRoute(pattern, pathname) {
    const params = {};
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = pathname.split('/').filter(Boolean);
    if (patternParts.length !== pathParts.length) return null;
    for (let i = 0; i < patternParts.length; i += 1) {
      const pp = patternParts[i];
      const cp = pathParts[i];
      if (pp.startsWith(':')) {
        params[pp.slice(1)] = decodeURIComponent(cp);
      } else if (pp === '*') {
        continue;
      } else if (pp !== cp) {
        return null;
      }
    }
    return params;
  }

  function handle(req, res) {
    const parsedUrl = url.parse(req.url, true);
    req.originalUrl = req.url;
    req.path = parsedUrl.pathname;
    req.query = parsedUrl.query || {};
    req.params = {};
    req.body = {};
    res.locals = {};
    res.statusCode = 200;

    res.status = function status(code) {
      res.statusCode = code;
      return res;
    };

    res.send = function send(body) {
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(body));
      } else {
        if (!res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        res.end(body);
      }
    };

    res.json = function json(body) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
    };

    res.redirect = function redirect(location) {
      res.statusCode = 302;
      res.setHeader('Location', location);
      res.end();
    };

    res.render = function render(view, data = {}) {
      const engineName = settings['view engine'];
      const engine = engines[engineName];
      if (!engine) {
        res.statusCode = 500;
        res.end('View engine not configured');
        return;
      }
      const viewsPath = settings.views;
      const filePath = path.join(viewsPath, `${view}.${engineName}`);
      engine(filePath, { ...(res.locals || {}), ...data }, (err, html) => {
        if (err) {
          res.statusCode = 500;
          res.end(err.message || 'Template error');
          return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    };

    let idx = -1;
    const method = req.method.toUpperCase();

    function next(err) {
      idx += 1;
      if (idx >= stack.length) {
        if (err) {
          res.statusCode = err.status || 500;
          res.end(err.message || 'Server Error');
          return;
        }
        if (!res.writableEnded) {
          res.statusCode = 404;
          res.end('Not Found');
        }
        return;
      }

      const layer = stack[idx];

      if (err) {
        if (layer.type === 'middleware' && layer.handler.length === 4) {
          return layer.handler(err, req, res, next);
        }
        return next(err);
      }

      if (layer.type === 'middleware') {
        if (layer.path && !req.path.startsWith(layer.path)) {
          return next();
        }
        if (layer.handler.length === 4) {
          return next();
        }
        return layer.handler(req, res, next);
      }

      if (layer.type === 'route') {
        if (layer.method !== method) {
          return next();
        }
        const params = matchRoute(layer.path, req.path);
        if (!params) {
          return next();
        }
        req.params = params;
        if (layer.handler.length >= 3) {
          return layer.handler(req, res, next);
        }
        return layer.handler(req, res);
      }

      return next();
    }

    next();
  }

  const app = {
    use(arg1, arg2) {
      if (typeof arg1 === 'string' && typeof arg2 === 'function') {
        stack.push({ type: 'middleware', path: arg1, handler: arg2 });
      } else if (typeof arg1 === 'function') {
        stack.push({ type: 'middleware', path: null, handler: arg1 });
      }
    },
    get(pathname, handler) {
      stack.push({ type: 'route', method: 'GET', path: pathname, handler });
    },
    post(pathname, handler) {
      stack.push({ type: 'route', method: 'POST', path: pathname, handler });
    },
    put(pathname, handler) {
      stack.push({ type: 'route', method: 'PUT', path: pathname, handler });
    },
    delete(pathname, handler) {
      stack.push({ type: 'route', method: 'DELETE', path: pathname, handler });
    },
    patch(pathname, handler) {
      stack.push({ type: 'route', method: 'PATCH', path: pathname, handler });
    },
    set(key, value) {
      settings[key] = value;
    },
    getSetting(key) {
      return settings[key];
    },
    engine(ext, fn) {
      engines[ext] = fn;
    },
    render(view, data, cb) {
      const engineName = settings['view engine'];
      const engine = engines[engineName];
      const viewsPath = settings.views;
      const filePath = path.join(viewsPath, `${view}.${engineName}`);
      engine(filePath, data, cb);
    },
    listen(port, cb) {
      const server = http.createServer(handle);
      server.listen(port, cb);
      return server;
    },
    handle,
  };

  return app;
}

function json() {
  return function jsonMiddleware(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return next();
    }
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        req.body = data ? JSON.parse(data) : {};
      } catch (err) {
        req.body = {};
      }
      next();
    });
  };
}

function urlencoded() {
  return function urlencodedMiddleware(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/x-www-form-urlencoded')) {
      return next();
    }
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      const body = {};
      data.split('&').filter(Boolean).forEach((pair) => {
        const [key, value] = pair.split('=');
        body[decodeURIComponent(key)] = decodeURIComponent((value || '').replace(/\+/g, ' '));
      });
      req.body = body;
      next();
    });
  };
}

function staticMiddleware(root) {
  const base = path.resolve(root);
  return function staticHandler(req, res, next) {
    const pathname = decodeURIComponent(url.parse(req.url).pathname);
    const safePath = pathname.replace(/^\/+/, '');
    const filePath = path.join(base, safePath);
    if (!filePath.startsWith(base)) {
      return next();
    }
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        return next();
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime = {
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.html': 'text/html',
      }[ext];
      if (mime) {
        res.setHeader('Content-Type', mime);
      }
      const stream = fs.createReadStream(filePath);
      stream.on('error', next);
      stream.pipe(res);
    });
  };
}

module.exports = express;
module.exports.json = json;
module.exports.urlencoded = urlencoded;
module.exports.static = staticMiddleware;
