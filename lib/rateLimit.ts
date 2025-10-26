/**
 * Rate Limiting Utility
 * Provides simple rate limiting for API routes
 */

import { RateLimitError } from './errors';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (use Redis in production for distributed rate limiting)
const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

interface RateLimitOptions {
  /**
   * Maximum number of requests allowed within the window
   */
  maxRequests: number;

  /**
   * Time window in seconds
   */
  windowSeconds: number;

  /**
   * Identifier for the rate limit (usually IP address or user ID)
   */
  identifier: string;
}

/**
 * Checks if a request should be rate limited
 * Throws RateLimitError if limit exceeded
 */
export function checkRateLimit(options: RateLimitOptions): void {
  const { maxRequests, windowSeconds, identifier } = options;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  // Get or create rate limit entry
  let entry = store[identifier];

  if (!entry || entry.resetTime < now) {
    // Create new entry
    entry = {
      count: 1,
      resetTime: now + windowMs,
    };
    store[identifier] = entry;
    return;
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > maxRequests) {
    const resetIn = Math.ceil((entry.resetTime - now) / 1000);
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${resetIn} seconds.`
    );
  }
}

/**
 * Gets the identifier from a request (IP address)
 */
export function getRequestIdentifier(req: Request): string {
  // Try to get real IP from headers (when behind proxy)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a default (not ideal, but prevents errors)
  return 'unknown';
}

/**
 * Rate limit presets for common use cases
 */
export const RateLimits = {
  /**
   * Strict rate limit for sensitive operations (e.g., authentication)
   * 5 requests per minute
   */
  STRICT: {
    maxRequests: 5,
    windowSeconds: 60,
  },

  /**
   * Standard rate limit for API endpoints
   * 60 requests per minute
   */
  STANDARD: {
    maxRequests: 60,
    windowSeconds: 60,
  },

  /**
   * Generous rate limit for read operations
   * 100 requests per minute
   */
  GENEROUS: {
    maxRequests: 100,
    windowSeconds: 60,
  },

  /**
   * Very strict rate limit for expensive operations (e.g., book generation)
   * 3 requests per hour
   */
  EXPENSIVE: {
    maxRequests: 3,
    windowSeconds: 3600,
  },
} as const;

/**
 * Higher-order function to apply rate limiting to an API handler
 */
export function withRateLimit(
  handler: (req: Request, context?: any) => Promise<Response>,
  options: { maxRequests: number; windowSeconds: number }
) {
  return async (req: Request, context?: any): Promise<Response> => {
    const identifier = getRequestIdentifier(req);

    // Check rate limit
    checkRateLimit({
      ...options,
      identifier,
    });

    // If not rate limited, proceed with handler
    return await handler(req, context);
  };
}

export default {
  checkRateLimit,
  getRequestIdentifier,
  withRateLimit,
  RateLimits,
};
