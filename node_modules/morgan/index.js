module.exports = function morgan() {
  return function logger(req, res, next) {
    const start = Date.now();
    const originalEnd = res.end;
    res.end = function endProxy(chunk, encoding, cb) {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`);
      return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
  };
};
