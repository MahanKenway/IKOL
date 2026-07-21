import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, getLogger, generateRequestId, setLogLevel } from '../src/services/logger/index.js';

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: any;

  beforeEach(() => {
    logger = getLogger({ module: 'test' });
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  it('should create logger with context', () => {
    const log = getLogger({ module: 'test', userId: 123 });
    expect(log).toBeInstanceOf(Logger);
  });

  it('should log info messages as JSON', () => {
    logger.info('test message', { requestId: 'req_123' });
    expect(consoleSpy.log).toHaveBeenCalled();
    const call = consoleSpy.log.mock.calls[0][0];
    const parsed = JSON.parse(call);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('test message');
    expect(parsed.ctx?.requestId).toBe('req_123');
    expect(parsed.ctx?.module).toBe('test');
  });

  it('should log error messages to console.error', () => {
    logger.error('error message', { error: 'something broke' });
    expect(consoleSpy.error).toHaveBeenCalled();
    const call = consoleSpy.error.mock.calls[0][0];
    const parsed = JSON.parse(call);
    expect(parsed.level).toBe('error');
    expect(parsed.msg).toBe('error message');
  });

  it('should log warn messages to console.warn', () => {
    logger.warn('warn message');
    expect(consoleSpy.warn).toHaveBeenCalled();
    const call = consoleSpy.warn.mock.calls[0][0];
    const parsed = JSON.parse(call);
    expect(parsed.level).toBe('warn');
  });

  it('should respect log level', () => {
    const debugLogger = new Logger('debug', { module: 'test' });
    debugLogger.debug('debug msg');
    expect(consoleSpy.log).toHaveBeenCalled();

    consoleSpy.log.mockClear();
    const infoLogger = new Logger('info', { module: 'test' });
    infoLogger.debug('debug msg should not appear');
    expect(consoleSpy.log).not.toHaveBeenCalled();
  });

  it('should create child logger with merged context', () => {
    const child = logger.child({ requestId: 'req_456', userId: 789 });
    child.info('child message');
    const call = consoleSpy.log.mock.calls[0][0];
    const parsed = JSON.parse(call);
    expect(parsed.ctx?.requestId).toBe('req_456');
    expect(parsed.ctx?.userId).toBe(789);
    expect(parsed.ctx?.module).toBe('test');
  });

  it('should generate unique request IDs', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^req_/);
  });

  it('should include timestamp in log entries', () => {
    logger.info('timestamp test');
    const call = consoleSpy.log.mock.calls[0][0];
    const parsed = JSON.parse(call);
    expect(parsed.ts).toBeDefined();
    expect(new Date(parsed.ts).getTime()).not.toBeNaN();
  });
});
