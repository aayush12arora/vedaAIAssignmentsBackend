const mongoose = require('mongoose');
const config = require('./index');

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    if (!config.mongodb.uri) {
      throw new Error('MONGODB_URI is missing. Create backend/.env and set your Atlas connection string.');
    }

    const conn = await mongoose.connect(config.mongodb.uri, {
      // Mongoose 6+ no longer needs these options
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Disconnect from MongoDB
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
  }
};

/**
 * Get mongoose connection
 */
const getConnection = () => mongoose.connection;

module.exports = { connectDB, disconnectDB, getConnection };
