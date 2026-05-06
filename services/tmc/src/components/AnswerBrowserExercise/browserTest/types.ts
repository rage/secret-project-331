import type { BrowserTestSpec } from "@/util/stateInterfaces"

/** Adapter for running in-browser tests for a given runtime (e.g. Python/Pyodide). */
export type BrowserTestRunnerAdapter = {
  canRun(filepath: string): boolean
  /** User-facing message when canRun returns false (e.g. "Only Python files can be tested."). */
  getCannotRunMessage(): string
  buildScript(specScript: string, userCode: string): string
  getWorkerUrl(): string
}

/** Returns the adapter for the given runtime, or null if unsupported. */
export type GetBrowserTestAdapter = (
  runtime: BrowserTestSpec["runtime"],
) => BrowserTestRunnerAdapter | null
