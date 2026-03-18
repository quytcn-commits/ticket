module.exports = function errorHandler(err, req, res, _next) {
  console.error(err.stack || err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
};
