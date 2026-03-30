export type Logger = {
  log: (message: string, ...args: unknown[]) => void
  debug: (message: string, ...args: unknown[]) => void
  error: (message: string, ...args: unknown[]) => void
}

export function createLogger(tag: string): Logger {
  return {
    log: (message: string, ...args: unknown[]) => console.log(`[${tag}]`, message, ...args),
    debug: (message: string, ...args: unknown[]) => console.debug(`[${tag}]`, message, ...args),
    error: (message: string, ...args: unknown[]) => console.error(`[${tag}]`, message, ...args),
  }
}

export function createScopedLogger(tag: string, requestId: string): Logger {
  return createLogger(`${tag}/${requestId}`)
}
