// src/lib/logger.ts
/**
 * Safe Logger Utility
 *
 * Prevents logging in production to avoid exposing sensitive data
 * Only logs in development mode
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Log general information (development only)
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log errors (always logged, but sanitized in production)
   */
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production, log generic message without sensitive details
      console.error('An error occurred. Check server logs for details.');
    }
  },

  /**
   * Log warnings (development only)
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Log debug information (development only)
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Log info (development only)
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
};

/**
 * For development convenience - same as logger but shorter
 */
export const log = logger.log;
export const logError = logger.error;
export const logWarn = logger.warn;
export const logDebug = logger.debug;
