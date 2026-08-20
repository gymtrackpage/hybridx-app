// src/lib/logger.ts
/**
 * Safe Logger Utility
 *
 * Prevents logging in production to avoid exposing sensitive data
 * Only logs in development mode
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Reduce a logged value to something safe to emit in production: strings and
 * error identity/messages pass through, anything else is described by shape
 * only so a stray payload can't leak user data into the console.
 */
function summarizeForProduction(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return String(value);
  }
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    const suffix = typeof code === 'string' || typeof code === 'number' ? ` [${code}]` : '';
    return `${value.name}${suffix}: ${value.message}`;
  }
  if (typeof value === 'object') {
    const code = (value as { code?: unknown }).code;
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string') {
      const suffix = typeof code === 'string' || typeof code === 'number' ? ` [${code}]` : '';
      return `${(value as object).constructor?.name ?? 'Object'}${suffix}: ${message}`;
    }
    return `[${(value as object).constructor?.name ?? 'Object'}]`;
  }
  return `[${typeof value}]`;
}

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
   * Log errors (always logged; reduced to a non-sensitive summary in production)
   */
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production this used to print a fixed "check server logs" line and drop
      // the error entirely. Most logger.error calls run in the BROWSER, so there
      // were no server logs to check, and the actual cause — e.g. a Firestore
      // "query requires an index" error, which carries the link needed to fix it —
      // was unrecoverable. Log a compact summary instead: error type, code and
      // message are what make a failure diagnosable, and none of them carry user
      // data, while arbitrary objects are still reduced to their shape.
      console.error(...args.map(summarizeForProduction));
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
