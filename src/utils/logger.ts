export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

class ConsoleLogger implements Logger {
  private level: LogLevel = "info";
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  debug(...args: any[]): void {
    if (this.shouldLog("debug")) console.debug("[debug]", ...args);
  }

  info(...args: any[]): void {
    if (this.shouldLog("info")) console.log("[info]", ...args);
  }

  warn(...args: any[]): void {
    if (this.shouldLog("warn")) console.warn("[warn]", ...args);
  }

  error(...args: any[]): void {
    if (this.shouldLog("error")) console.error("[error]", ...args);
  }
}

export const logger = new ConsoleLogger();

export function setLogLevel(level: LogLevel): void {
  logger.setLevel(level);
}
