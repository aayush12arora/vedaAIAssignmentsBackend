require('dotenv').config();

module.exports = {
  // Server Configuration
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // MongoDB Configuration
  mongodb: {
    uri: process.env.MONGODB_URI,
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
  },

  // Gemini API Configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },

  // BullMQ Queue Configuration
  queue: {
    questionGeneration: 'question-generation',
    pdfGeneration: 'pdf-generation',
  },

  // File Upload Configuration
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf', 'text/plain'],
  }
};
