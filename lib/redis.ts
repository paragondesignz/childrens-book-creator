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

const getRedisConfig = () => {
  const config: any = {
    maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
    enableReadyCheck: true,
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

// Skip Redis initialization during Next.js build phase
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

let redisInstance: Redis | null = null;
let bullMQConfig: any = null;

// Lazy initialization for Redis
const getRedisInstance = () => {
  if (isBuildTime) {
    throw new Error('Redis should not be accessed during build time');
  }

  if (!redisInstance) {
    redisInstance = new Redis(getRedisUrl(), getRedisConfig());

    redisInstance.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    redisInstance.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }

  return redisInstance;
};

// Lazy initialization for BullMQ connection config
const getBullMQConnection = () => {
  if (isBuildTime) {
    // Return a dummy config during build time
    return {};
  }

  if (!bullMQConfig) {
    bullMQConfig = {
      url: getRedisUrl(),
      ...getRedisConfig(),
    };
  }

  return bullMQConfig;
};

// Export getters instead of direct instances
export const redis = new Proxy({} as Redis, {
  get: (target, prop) => {
    const instance = getRedisInstance();
    return (instance as any)[prop];
  }
});

export const bullMQConnection = new Proxy({} as any, {
  get: (target, prop) => {
    const config = getBullMQConnection();
    return config[prop];
  },
  ownKeys: (target) => {
    const config = getBullMQConnection();
    return Reflect.ownKeys(config);
  },
  getOwnPropertyDescriptor: (target, prop) => {
    const config = getBullMQConnection();
    return Object.getOwnPropertyDescriptor(config, prop);
  }
});

export const redisConnection = redis;
