// Load environment variables for worker process
if (typeof window === 'undefined') {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not available or already loaded
  }
}

import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  throw new Error('REDIS_URL is not defined');
};

const getRedisConfig = (): RedisOptions => {
  const config: RedisOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
    enableReadyCheck: true,
    lazyConnect: true, // Don't connect immediately
  };

  // Configure TLS for Upstash
  if (process.env.REDIS_TLS_ENABLED === 'true') {
    config.tls = {
      rejectUnauthorized: false,
    };
    config.family = 6; // Use IPv6
  }

  return config;
};

// Create a function that returns Redis connection lazily
export const createRedisConnection = (): Redis => {
  const redisUrl = getRedisUrl();
  const config = getRedisConfig();

  const connection = new Redis(redisUrl, config);

  connection.on('error', (error) => {
    console.error('Redis connection error:', error);
  });

  connection.on('connect', () => {
    console.log('Redis connected successfully');
  });

  return connection;
};

// Export configuration for BullMQ
export const getBullMQConnectionConfig = () => {
  return {
    host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : undefined,
    port: process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port || '6379') : undefined,
    username: process.env.REDIS_URL && new URL(process.env.REDIS_URL).username ? new URL(process.env.REDIS_URL).username : 'default',
    password: process.env.REDIS_URL && new URL(process.env.REDIS_URL).password ? new URL(process.env.REDIS_URL).password : undefined,
    ...getRedisConfig(),
  };
};

// Legacy exports for backward compatibility - but these should not be used
// They're here only to prevent import errors
export const redis = null as any;
export const redisConnection = null as any;
export const bullMQConnection = null as any;
