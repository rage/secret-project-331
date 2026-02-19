import { getPythonBrowserTestAdapter } from "./pythonAdapter"
import type { BrowserTestRunnerAdapter, GetBrowserTestAdapter } from "./types"

import type { BrowserTestSpec } from "@/util/stateInterfaces"

export type { BrowserTestRunnerAdapter } from "./types"
export { getPythonBrowserTestAdapter } from "./pythonAdapter"
export { TEST_TIMEOUT_MS_EXPORT } from "./pythonAdapter"

export const getBrowserTestAdapter: GetBrowserTestAdapter = (
  runtime: BrowserTestSpec["runtime"],
): BrowserTestRunnerAdapter | null => {
  switch (runtime) {
    case "python":
      return getPythonBrowserTestAdapter()
    default:
      return null
  }
}
