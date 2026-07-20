// Cloudflare Workers compatible logger

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

  debug(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('debug')) return;
    console.log(`[DEBUG] ${message}`, { ...this.context, ...context });
  }

  info(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('info')) return;
    console.log(`[INFO] ${message}`, { ...this.context, ...context });
  }

  warn(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('warn')) return;
    console.warn(`[WARN] ${message}`, { ...this.context, ...context });
  }

  error(message: string, error?: Error, context?: Record<string, unknown>) {
    if (!this.shouldLog('error')) return;
    console.error(`[ERROR] ${message}`, error, { ...this.context, ...context });
  }

  child(context: Record<string, unknown>): Logger {
    return new Logger(this.level, { ...this.context, ...context });
  }
}

// Singleton logger
let logger: Logger | null = null;

export function getLogger(context?: LogLevel | Record<string, unknown>): Logger {
  if (!logger) {
    if (typeof context === 'string') {
      logger = new Logger(context);
    } else if (context && typeof context === 'object') {
      logger = new Logger('info', context);
    } else {
      logger = new Logger('info');
    }
  }
  return logger;
}
