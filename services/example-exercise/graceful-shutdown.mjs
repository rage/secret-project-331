/** Cloud Run sends SIGKILL 10 s after SIGTERM; exiting by this leaves room for the process to end. */
export const DRAIN_DEADLINE_MS = 8_000

/**
 * On `SIGTERM`, stops accepting connections and exits once in-flight requests have finished, or
 * at `deadlineMs` with status 1 if some haven't.
 *
 * @param {import("node:http").Server} server
 * @param {{ deadlineMs?: number, exit?: (code: number) => void, signals?: { once: (signal: string, handler: () => void) => unknown } }} [options]
 *   `exit` and `signals` default to the process's; tests replace them.
 */
export function drainOnSigterm(server, options = {}) {
  const { deadlineMs = DRAIN_DEADLINE_MS, exit = process.exit, signals = process } = options
  signals.once("SIGTERM", () => {
    const deadline = setTimeout(() => exit(1), deadlineMs)
    deadline.unref()
    // A keep-alive connection turns idle once its last response is sent, and would then hold
    // `close` open until the client hangs up.
    const idleSweep = setInterval(() => server.closeIdleConnections(), 100)
    idleSweep.unref()
    server.close(() => {
      clearTimeout(deadline)
      clearInterval(idleSweep)
      exit(0)
    })
    server.closeIdleConnections()
  })
}
