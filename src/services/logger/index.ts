export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export class Logger {
  private level: LogLevel;
  private context: Record<string, unknown>;

  constructor(level: LogLevel = 'info', context: Record<string, unknown> = {}) {
    this.level = level;
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatEntry(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const contextStr = Object.keys(entry.context || {}).length
      ? ` ${JSON.stringify(entry.context)}`
      : '';
    const errorStr = entry.error ? `\n${entry.error.stack}` : '';
    return `${prefix} ${entry.message}${contextStr}${errorStr}`;
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('debug')) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      context: { ...this.context, ...context },
    };
    console.log(this.formatEntry(entry));
  }

  info(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('info')) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context: { ...this.context, ...context },
    };
    console.log(this.formatEntry(entry));
  }

  warn(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('warn')) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context: { ...this.context, ...context },
    };
    console.warn(this.formatEntry(entry));
  }

  error(message: string, error?: Error, context?: Record<string, unknown>) {
    if (!this.shouldLog('error')) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context: { ...this.context, ...context },
      error,
    };
    console.error(this.formatEntry(entry));
  }

  // Create child logger with additional context
  child(context: Record<string, unknown>): Logger {
    return new Logger(this.level, { ...this.context, ...context });
  }
}

// Singleton logger instance
let logger: Logger | null = null;

// Accept LogLevel or context object
export function getLogger(levelOrContext?: LogLevel | { module?: string; service?: string }): Logger {
  if (!logger) {
    let level: LogLevel = 'info';
    let context: Record<string, unknown> = {};

    if (typeof levelOrContext === 'string') {
      level = levelOrContext;
    } else if (levelOrContext && typeof levelOrContext === 'object') {
      context = levelOrContext;
    }

    logger = new Logger(level, context);
  }
  return logger;
}
