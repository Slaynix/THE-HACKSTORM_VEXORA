'use strict';

/**
 * Global Express error handler.
 * Formats errors cleanly without leaking stack traces or internal secrets to the client.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[server error]', err.name || 'Error', err.message);

  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'An unexpected server error occurred' : err.message;

  res.status(status).json({
    error: message,
  });
}

module.exports = errorHandler;
