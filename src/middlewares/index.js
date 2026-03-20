const uploadMiddleware = require('./uploadMiddleware');
const { errorHandler, notFoundHandler } = require('./errorHandler');

module.exports = {
  uploadMiddleware,
  errorHandler,
  notFoundHandler
};
