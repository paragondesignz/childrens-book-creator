/**
 * Structured Logging Utility
 * Provides consistent, structured logging across the application
 */

import { isProduction, isDevelopment } from './env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private serviceName: string;

  constructor(serviceName: string = 'app') {
    this.serviceName = serviceName;
  }

  /**
   * Formats a log entry as JSON
   */
  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error): string {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: {
        service: this.serviceName,
        ...context,
      },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: !isProduction() ? error.stack : undefined,
      };
    }

    if (isDevelopment()) {
      // Pretty print in development
      return JSON.stringify(entry, null, 2);
    }

    // Single line JSON in production (for log aggregators)
    return JSON.stringify(entry);
  }

  /**
   * Outputs log to console with appropriate level
   */
  private output(level: LogLevel, formattedLog: string): void {
    switch (level) {
      case 'debug':
        console.debug(formattedLog);
        break;
      case 'info':
        console.log(formattedLog);
        break;
      case 'warn':
        console.warn(formattedLog);
        break;
      case 'error':
        console.error(formattedLog);
        break;
    }

    // In production, send to monitoring service
    if (isProduction()) {
      // TODO: Send to external logging service (Datadog, CloudWatch, etc.)
      // this.sendToExternalService(level, formattedLog);
    }
  }

  /**
   * Debug level logging (disabled in production)
   */
  debug(message: string, context?: LogContext): void {
    if (isProduction()) return; // Skip debug logs in production

    const formatted = this.formatLog('debug', message, context);
    this.output('debug', formatted);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    const formatted = this.formatLog('info', message, context);
    this.output('info', formatted);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    const formatted = this.formatLog('warn', message, context);
    this.output('warn', formatted);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const formatted = this.formatLog('error', message, context, error);
    this.output('error', formatted);
  }

  /**
   * Creates a child logger with additional context
   */
  child(childContext: LogContext): Logger {
    const childLogger = new Logger(this.serviceName);
    const originalFormatLog = this.formatLog.bind(this);

    childLogger.formatLog = (level, message, context?, error?) => {
      return originalFormatLog(level, message, { ...childContext, ...context }, error);
    };

    return childLogger;
  }

  /**
   * Logs API request
   */
  logRequest(req: Request, context?: LogContext): void {
    this.info('API Request', {
      method: req.method,
      url: req.url,
      headers: !isProduction() ? Object.fromEntries(req.headers.entries()) : undefined,
      ...context,
    });
  }

  /**
   * Logs API response
   */
  logResponse(req: Request, statusCode: number, duration: number, context?: LogContext): void {
    this.info('API Response', {
      method: req.method,
      url: req.url,
      statusCode,
      duration: `${duration}ms`,
      ...context,
    });
  }

  /**
   * Logs database query
   */
  logQuery(query: string, duration: number, context?: LogContext): void {
    this.debug('Database Query', {
      query: !isProduction() ? query : '[REDACTED]',
      duration: `${duration}ms`,
      ...context,
    });
  }

  /**
   * Logs external API call
   */
  logExternalCall(service: string, endpoint: string, duration: number, context?: LogContext): void {
    this.info('External API Call', {
      service,
      endpoint,
      duration: `${duration}ms`,
      ...context,
    });
  }

  /**
   * Logs job/task execution
   */
  logJob(jobName: string, status: 'started' | 'completed' | 'failed', context?: LogContext): void {
    if (status === 'failed') {
      this.error(`Job ${status}: ${jobName}`, undefined, context);
    } else {
      this.info(`Job ${status}: ${jobName}`, context);
    }
  }
}

// Default logger instance
export const logger = new Logger('app');

// Create specialized loggers for different parts of the app
export const apiLogger = new Logger('api');
export const workerLogger = new Logger('worker');
export const dbLogger = new Logger('database');
export const queueLogger = new Logger('queue');

export default logger;
