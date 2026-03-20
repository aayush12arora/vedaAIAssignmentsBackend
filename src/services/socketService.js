const { Server } = require('socket.io');
const config = require('../config');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
  }

  /**
   * Initialize Socket.IO server
   * @param {Object} server - HTTP server instance
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: config.frontendUrl,
        methods: ['GET', 'POST'],
        credentials: true
      },
       transports: ["websocket"],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    console.log('Socket.IO server initialized');
  }

  /**
   * Setup socket event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, { socket, subscriptions: [] });

      // Handle assignment subscription
      socket.on('subscribe:assignment', (assignmentId) => {
        socket.join(`assignment:${assignmentId}`);
        console.log(`Client ${socket.id} subscribed to assignment: ${assignmentId}`);
      });

      // Handle assignment unsubscription
      socket.on('unsubscribe:assignment', (assignmentId) => {
        socket.leave(`assignment:${assignmentId}`);
        console.log(`Client ${socket.id} unsubscribed from assignment: ${assignmentId}`);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
        this.connectedClients.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  /**
   * Emit event to specific assignment room
   * @param {string} assignmentId - Assignment ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emitToAssignment(assignmentId, event, data) {
    if (this.io) {
      this.io.to(`assignment:${assignmentId}`).emit(event, data);
    }
  }

  /**
   * Emit job status update
   * @param {string} assignmentId - Assignment ID
   * @param {string} status - Job status
   * @param {Object} data - Additional data
   */
  emitJobStatus(assignmentId, status, data = {}) {
    this.emitToAssignment(assignmentId, 'job:status', {
      assignmentId,
      status,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * Emit generation progress
   * @param {string} assignmentId - Assignment ID
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} message - Progress message
   */
  emitProgress(assignmentId, progress, message = '') {
    this.emitToAssignment(assignmentId, 'generation:progress', {
      assignmentId,
      progress,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit generation complete event
   * @param {string} assignmentId - Assignment ID
   * @param {Object} questionPaper - Generated question paper
   */
  emitGenerationComplete(assignmentId, questionPaper) {
    this.emitToAssignment(assignmentId, 'generation:complete', {
      assignmentId,
      questionPaper,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit generation error event
   * @param {string} assignmentId - Assignment ID
   * @param {string} error - Error message
   */
  emitGenerationError(assignmentId, error) {
    this.emitToAssignment(assignmentId, 'generation:error', {
      assignmentId,
      error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast to all connected clients
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  broadcast(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  /**
   * Get connected clients count
   * @returns {number} - Number of connected clients
   */
  getConnectedClientsCount() {
    return this.connectedClients.size;
  }
}

// Singleton instance
const socketService = new SocketService();

module.exports = socketService;
