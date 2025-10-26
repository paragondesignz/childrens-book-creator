/**
 * Centralized Error Handling
 * Provides consistent error types, messages, and logging across the application
 */

import { NextResponse } from 'next/server';
import { isProduction } from './env';

// Custom Error Classes
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(429, message, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: any) {
    super(
      502,
      `External service error: ${service}`,
      'EXTERNAL_SERVICE_ERROR',
      originalError
    );
    this.name = 'ExternalServiceError';
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, originalError?: any) {
    super(
      500,
      `Database error during ${operation}`,
      'DATABASE_ERROR',
      originalError
    );
    this.name = 'DatabaseError';
  }
}

// Error Response Interface
interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: any;
    timestamp: string;
    path?: string;
  };
}

/**
 * Formats an error for API response
 */
export function formatErrorResponse(
  error: Error | AppError,
  path?: string
): ErrorResponse {
  const isAppError = error instanceof AppError;

  return {
    error: {
      message: error.message,
      code: isAppError ? error.code : 'INTERNAL_SERVER_ERROR',
      statusCode: isAppError ? error.statusCode : 500,
      details: isAppError && !isProduction() ? error.details : undefined,
      timestamp: new Date().toISOString(),
      path,
    },
  };
}

/**
 * Creates a Next.js error response
 */
export function createErrorResponse(
  error: Error | AppError,
  path?: string
): NextResponse {
  const formattedError = formatErrorResponse(error, path);
  const statusCode = formattedError.error.statusCode;

  // Log error (in production, this should go to your logging service)
  logError(error, {
    path,
    statusCode,
  });

  return NextResponse.json(formattedError, { status: statusCode });
}

/**
 * Logs an error with context
 */
export function logError(error: Error | AppError, context?: Record<string, any>) {
  const isAppError = error instanceof AppError;
  const logLevel = isAppError && error.statusCode < 500 ? 'warn' : 'error';

  const logData = {
    name: error.name,
    message: error.message,
    code: isAppError ? error.code : undefined,
    statusCode: isAppError ? error.statusCode : 500,
    stack: !isProduction() ? error.stack : undefined,
    details: isAppError ? error.details : undefined,
    ...context,
    timestamp: new Date().toISOString(),
  };

  if (logLevel === 'error') {
    console.error('❌ Error:', JSON.stringify(logData, null, 2));
  } else {
    console.warn('⚠️  Warning:', JSON.stringify(logData, null, 2));
  }

  // In production, send to monitoring service (Sentry, Datadog, etc.)
  if (isProduction()) {
    // TODO: Integrate with Sentry or similar
    // Sentry.captureException(error, { extra: logData });
  }
}

/**
 * Safe error handler for async route handlers
 */
export function withErrorHandler(
  handler: (req: Request, context?: any) => Promise<Response>
) {
  return async (req: Request, context?: any): Promise<Response> => {
    try {
      return await handler(req, context);
    } catch (error) {
      if (error instanceof Error) {
        return createErrorResponse(error, req.url);
      }

      // Handle non-Error objects
      return createErrorResponse(
        new AppError(500, 'An unexpected error occurred'),
        req.url
      );
    }
  };
}

/**
 * Validates that a value is not null or undefined
 */
export function assertExists<T>(
  value: T | null | undefined,
  errorMessage: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(errorMessage);
  }
}

/**
 * Safely parses JSON and throws ValidationError on failure
 */
export async function safeParseJSON<T = any>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    return body as T;
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body');
  }
}

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  formatErrorResponse,
  createErrorResponse,
  logError,
  withErrorHandler,
  assertExists,
  safeParseJSON,
};
