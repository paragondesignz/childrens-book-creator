// Load environment variables for worker process
if (typeof window === 'undefined') {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not available or already loaded
  }
}

import Redis from 'ioredis';

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  throw new Error('REDIS_URL is not defined');
};

const redisConfig: any = {
  maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
  enableReadyCheck: true,
};

// Configure TLS for Upstash
if (process.env.REDIS_TLS_ENABLED === 'true') {
  redisConfig.tls = {
    rejectUnauthorized: false,
  };
  redisConfig.family = 6; // Use IPv6
}

export const redis = new Redis(getRedisUrl(), redisConfig);

// Export configuration object for BullMQ (it needs the config, not the instance)
export const bullMQConnection = {
  url: getRedisUrl(),
  ...redisConfig,
};

// Also export redis instance for other uses
export const redisConnection = redis;

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});
