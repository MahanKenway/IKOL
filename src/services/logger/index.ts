export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  updateId?: number;
  userId?: number;
  module?: string;
  provider?: string;
  latency?: number;
  status?: 'success' | 'error' | 'timeout' | 'rate_limited';
  errorId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  ctx?: LogContext;
}

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export class Logger {
  private level: LogLevel;
  private baseContext: LogContext;

  constructor(level: LogLevel = 'info', baseContext: LogContext = {}) {
    this.level = level;
    this.baseContext = baseContext;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS.indexOf(level) >= LEVELS.indexOf(this.level);
  }

  private emit(level: LogLevel, msg: string, ctx?: LogContext) {
    if (!this.shouldLog(level)) return;
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      msg,
      ctx: { ...this.baseContext, ...ctx },
    };
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  debug(msg: string, ctx?: LogContext) { this.emit('debug', msg, ctx); }
  info(msg: string, ctx?: LogContext) { this.emit('info', msg, ctx); }
  warn(msg: string, ctx?: LogContext) { this.emit('warn', msg, ctx); }
  error(msg: string, ctx?: LogContext) { this.emit('error', msg, ctx); }

  child(baseContext: LogContext): Logger {
    return new Logger(this.level, { ...this.baseContext, ...baseContext });
  }

  withRequest(requestId: string): Logger {
    return this.child({ requestId });
  }
}

let defaultLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  defaultLevel = level;
}

export function getLogger(context?: LogContext): Logger {
  return new Logger(defaultLevel, context || {});
}

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}
