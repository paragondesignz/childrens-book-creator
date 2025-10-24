import Redis from 'ioredis';

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  throw new Error('REDIS_URL is not defined');
};

const redisConfig: any = {
  maxRetriesPerRequest: 3,
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

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});
