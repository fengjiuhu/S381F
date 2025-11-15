module.exports = function methodOverride(source = '_method') {
  return function methodOverrideMiddleware(req, res, next) {
    if (req.method.toUpperCase() === 'POST') {
      let method;
      if (req.body && req.body[source]) {
        method = req.body[source];
        delete req.body[source];
      } else if (req.query && req.query[source]) {
        method = req.query[source];
      }
      if (method) {
        req.method = method.toUpperCase();
      }
    }
    next();
  };
};
