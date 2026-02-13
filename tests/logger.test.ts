import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, setLogLevel } from '../src/utils/logger';

describe('logger', () => {
  beforeEach(() => {
    setLogLevel('info');
  });

  it('should log info messages', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test message');
    expect(consoleSpy).toHaveBeenCalledWith('[info]', 'test message');
    consoleSpy.mockRestore();
  });

  it('should log debug messages when level is debug', () => {
    setLogLevel('debug');
    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    logger.debug('debug message');
    expect(consoleSpy).toHaveBeenCalledWith('[debug]', 'debug message');
    consoleSpy.mockRestore();
  });

  it('should not log debug messages when level is info', () => {
    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    logger.debug('debug message');
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log error messages', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('error message');
    expect(consoleSpy).toHaveBeenCalledWith('[error]', 'error message');
    consoleSpy.mockRestore();
  });

  it('should log warn messages', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('warn message');
    expect(consoleSpy).toHaveBeenCalledWith('[warn]', 'warn message');
    consoleSpy.mockRestore();
  });

  it('should support setting log level', () => {
    setLogLevel('error');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.info('should not log');
    expect(logSpy).not.toHaveBeenCalled();

    logger.error('should log');
    expect(errorSpy).toHaveBeenCalledWith('[error]', 'should log');

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
