type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      ...context,
    };

    if (process.env.NODE_ENV === "production") {
      console.log(JSON.stringify(entry));
    } else {
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      if (context) {
        console[level](prefix, message, context);
      } else {
        console[level](prefix, message);
      }
    }
  }

  debug(message: string, context?: LogContext) {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  error(message: string, context?: LogContext) {
    this.log("error", message, context);
  }
}

export const logger = new Logger();
