const { createClient } = require('redis');
const config = require('./index');

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis Client Connected');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error(`Redis Connection Error: ${error.message}`);
    return null;
  }
};

const getRedisClient = () => {
  return redisClient;
};

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log('Redis Disconnected');
  }
};

// Cache helper functions
const cacheSet = async (key, value, expireSeconds = 3600) => {
  if (!redisClient) return null;
  try {
    await redisClient.setEx(key, expireSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis Cache Set Error:', error);
    return false;
  }
};

const cacheGet = async (key) => {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis Cache Get Error:', error);
    return null;
  }
};

const cacheDelete = async (key) => {
  if (!redisClient) return null;
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Redis Cache Delete Error:', error);
    return false;
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis,
  cacheSet,
  cacheGet,
  cacheDelete
};
