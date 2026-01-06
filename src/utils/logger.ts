/**
 * Logger utility with debug flag support
 *
 * - info: Basic logging (always on) - key events
 * - debug: Verbose logging (only when DEBUG=true)
 * - warn: Warning logging (always on)
 * - error: Error logging (always on)
 *
 * Each logger instance is tagged with a component name for easy filtering.
 */

// Check debug flag at module load time
// Note: We read directly from process.env to avoid circular dependency with config.ts
const isDebug = process.env.DEBUG === "true";

// Global flag to disable all logging (useful for testing)
let loggingEnabled = true;

/**
 * Enable or disable all logging globally
 */
export function setLoggingEnabled(enabled: boolean): void {
  loggingEnabled = enabled;
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return isDebug;
}

/**
 * Format a timestamp for log output
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace("T", " ").substring(0, 19);
}

/**
 * Format a log message with timestamp and tag
 */
function formatMessage(tag: string, level: string, message: string): string {
  return `[${getTimestamp()}] [${tag}] ${level ? `[${level}] ` : ""}${message}`;
}

/**
 * Safely stringify objects for logging
 */
function stringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export interface Logger {
  /** Basic logging - always on. Use for key events. */
  info: (message: string, ...args: unknown[]) => void;
  /** Verbose logging - only when DEBUG=true. Use for detailed tracing. */
  debug: (message: string, ...args: unknown[]) => void;
  /** Warning logging - always on. Use for non-fatal issues. */
  warn: (message: string, ...args: unknown[]) => void;
  /** Error logging - always on. Use for errors and failures. */
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Create a logger instance for a specific component
 *
 * @param tag - Component name (e.g., "Scheduler", "EventService")
 * @returns Logger instance with info, debug, warn, error methods
 *
 * @example
 * const log = createLogger("Scheduler");
 * log.info("Event started");
 * log.debug("Detailed trace info", { eventId: 123 });
 * log.error("Failed to fetch channel", error);
 */
export function createLogger(tag: string): Logger {
  return {
    info: (message: string, ...args: unknown[]) => {
      if (!loggingEnabled) return;
      const formatted = formatMessage(tag, "", message);
      if (args.length > 0) {
        console.log(formatted, ...args.map((a) => (typeof a === "object" ? stringify(a) : a)));
      } else {
        console.log(formatted);
      }
    },

    debug: (message: string, ...args: unknown[]) => {
      if (!loggingEnabled || !isDebug) return;
      const formatted = formatMessage(tag, "DEBUG", message);
      if (args.length > 0) {
        console.log(formatted, ...args.map((a) => (typeof a === "object" ? stringify(a) : a)));
      } else {
        console.log(formatted);
      }
    },

    warn: (message: string, ...args: unknown[]) => {
      if (!loggingEnabled) return;
      const formatted = formatMessage(tag, "WARN", message);
      if (args.length > 0) {
        console.warn(formatted, ...args.map((a) => (typeof a === "object" ? stringify(a) : a)));
      } else {
        console.warn(formatted);
      }
    },

    error: (message: string, ...args: unknown[]) => {
      if (!loggingEnabled) return;
      const formatted = formatMessage(tag, "ERROR", message);
      if (args.length > 0) {
        console.error(formatted, ...args.map((a) => (typeof a === "object" ? stringify(a) : a)));
      } else {
        console.error(formatted);
      }
    },
  };
}

/**
 * Collector for capturing logs during a specific operation.
 * Useful for returning logs in command responses.
 */
export class LogCollector {
  private logs: string[] = [];
  private tag: string;

  constructor(tag: string) {
    this.tag = tag;
  }

  info(message: string): void {
    const formatted = `[INFO] ${message}`;
    this.logs.push(formatted);
    if (loggingEnabled) {
      console.log(formatMessage(this.tag, "", message));
    }
  }

  debug(message: string): void {
    const formatted = `[DEBUG] ${message}`;
    this.logs.push(formatted);
    if (loggingEnabled && isDebug) {
      console.log(formatMessage(this.tag, "DEBUG", message));
    }
  }

  warn(message: string): void {
    const formatted = `[WARN] ${message}`;
    this.logs.push(formatted);
    if (loggingEnabled) {
      console.warn(formatMessage(this.tag, "WARN", message));
    }
  }

  error(message: string): void {
    const formatted = `[ERROR] ${message}`;
    this.logs.push(formatted);
    if (loggingEnabled) {
      console.error(formatMessage(this.tag, "ERROR", message));
    }
  }

  /**
   * Get all collected logs
   */
  getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Get logs as a formatted string
   */
  getLogsFormatted(): string {
    return this.logs.join("\n");
  }

  /**
   * Clear collected logs
   */
  clear(): void {
    this.logs = [];
  }
}
