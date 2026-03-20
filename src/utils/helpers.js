/**
 * Application response helper
 */
const sendResponse = (res, statusCode, data, message = '') => {
  return res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 300,
    message,
    data
  });
};

/**
 * Application error response helper
 */
const sendError = (res, statusCode, message, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};

/**
 * Async handler wrapper to avoid try-catch in every route
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validate required fields in request body
 */
const validateRequired = (body, fields) => {
  const missing = fields.filter(field => !body[field]);
  if (missing.length > 0) {
    return {
      valid: false,
      missing
    };
  }
  return { valid: true };
};

/**
 * Sanitize string input
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

/**
 * Generate a unique ID
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Sleep utility for delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  sendResponse,
  sendError,
  asyncHandler,
  validateRequired,
  sanitizeString,
  generateId,
  sleep
};
