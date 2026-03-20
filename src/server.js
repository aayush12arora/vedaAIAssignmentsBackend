const express = require('express');
const http = require('http');
const cors = require('cors');

const config = require('./config');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares');
const socketService = require('./services/socketService');
const { initializeQueue } = require('./workers/questionGenerationWorker');

// Create Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (development)
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// API Routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize services and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis
    await connectRedis();

    // Initialize Socket.IO
    socketService.initialize(server);

    // Initialize BullMQ worker
    initializeQueue();

    // Start server
    server.listen(config.port, "0.0.0.0", () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                 VedaAI Backend Server                 ║
╠═══════════════════════════════════════════════════════╣
║  Environment: ${config.nodeEnv.padEnd(38)}║
║  Port: ${String(config.port).padEnd(45)}║
║  Frontend URL: ${config.frontendUrl.padEnd(36)}║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\nShutting down gracefully...');
  
  server.close(async () => {
    console.log('HTTP server closed');
    
    const { closeQueue } = require('./workers/questionGenerationWorker');
    const { disconnectRedis } = require('./config/redis');
    const { disconnectDB } = require('./config/database');
    
    await closeQueue();
    await disconnectRedis();
    await disconnectDB();
    
    console.log('All connections closed');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
startServer();

module.exports = { app, server };
