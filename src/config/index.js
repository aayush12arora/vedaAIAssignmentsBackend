require('dotenv').config();

// ── Required env vars — fail fast with a clear message ──────────────────────
const REQUIRED = ['MONGODB_URI', 'GEMINI_API_KEY'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`\n[config] FATAL — missing required environment variables:\n  ${missing.join('\n  ')}\n`);
  process.exit(1);
}

const frontendUrls = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  // Server Configuration
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: frontendUrls[0] || 'http://localhost:3000',
  frontendUrls,

  // MongoDB Configuration
  mongodb: {
    uri: process.env.MONGODB_URI,
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    maxRetriesPerRequest: null,
  },

  // Gemini API Configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },

  // BullMQ Queue Configuration
  queue: {
    questionGeneration: 'question-generation',
    pdfGeneration: 'pdf-generation',
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB default
    allowedTypes: ['application/pdf', 'text/plain'],
  }
};
