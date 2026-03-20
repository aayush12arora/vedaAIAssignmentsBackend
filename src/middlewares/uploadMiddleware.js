const multer = require('multer');
const pdfParse = require('pdf-parse');
const config = require('../config');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${config.upload.allowedTypes.join(', ')}`), false);
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize
  }
});

// Middleware to parse PDF content
const parsePdfMiddleware = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    if (req.file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      req.fileContent = pdfData.text;
    } else {
      // Plain text file
      req.fileContent = req.file.buffer.toString('utf-8');
    }
    next();
  } catch (error) {
    console.error('PDF Parse Error:', error);
    return res.status(400).json({
      success: false,
      message: 'Failed to parse uploaded file',
      error: error.message
    });
  }
};

// Combined middleware
const uploadMiddleware = {
  single: (fieldName) => {
    return [
      upload.single(fieldName),
      parsePdfMiddleware
    ];
  }
};

module.exports = uploadMiddleware;
