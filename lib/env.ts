/**
 * Environment Variable Validation
 * Ensures all required environment variables are set before app starts
 */

const requiredEnvVars = [
  // Application
  'NODE_ENV',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',

  // AI Services
  'GEMINI_API_KEY',
  'REPLICATE_API_TOKEN',

  // Database
  'DATABASE_URL',
] as const;

const optionalEnvVars = [
  // Redis (optional in development)
  'REDIS_URL',

  // Payment (can be skipped for now)
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',

  // Email
  'SENDGRID_API_KEY',

  // Print on Demand
  'LULU_API_KEY',

  // Monitoring
  'SENTRY_DSN',
] as const;

interface ValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validates that all required environment variables are set
 * @param throwOnError - If true, throws an error when validation fails
 * @returns ValidationResult
 */
export function validateEnv(throwOnError = true): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check optional variables (warnings only)
  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      warnings.push(envVar);
    }
  }

  const isValid = missing.length === 0;

  if (!isValid && throwOnError) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\n` +
      `Please set these in your .env file. See .env.example for reference.`
    );
  }

  return {
    isValid,
    missing,
    warnings,
  };
}

/**
 * Gets an environment variable with type safety
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];

  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not set`);
  }

  return value;
}

/**
 * Gets a required environment variable (throws if not set)
 */
export function getRequiredEnv(key: string): string {
  return getEnv(key);
}

/**
 * Gets an optional environment variable
 */
export function getOptionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

/**
 * Checks if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Checks if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Checks if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

// Validate environment on module load (only in non-test environments)
if (!isTest()) {
  const result = validateEnv(false);

  if (!result.isValid) {
    console.error('❌ Environment validation failed!');
    console.error('Missing required variables:', result.missing);

    if (isProduction()) {
      // In production, throw immediately
      throw new Error('Missing required environment variables in production');
    } else {
      // In development, just warn
      console.warn('⚠️  App may not function correctly without these variables');
    }
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  Optional environment variables not set:', result.warnings);
    console.warn('   Some features may be limited');
  }

  if (result.isValid && result.warnings.length === 0) {
    console.log('✅ Environment validation passed');
  }
}

export default {
  validateEnv,
  getEnv,
  getRequiredEnv,
  getOptionalEnv,
  isProduction,
  isDevelopment,
  isTest,
};
