// Simple logger for renderer process (browser environment)
// Cannot use Winston here as it requires Node.js APIs

class RendererLogger {
  private isDebug = true; // Always enable debug in development

  info(message: string, ...args: unknown[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.isDebug) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
}

export default new RendererLogger();
