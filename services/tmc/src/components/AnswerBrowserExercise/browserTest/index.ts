import type { BrowserTestSpec } from "@/util/stateInterfaces"

import { getPythonBrowserTestAdapter } from "./pythonAdapter"
import type { BrowserTestRunnerAdapter, GetBrowserTestAdapter } from "./types"

export type { BrowserTestRunnerAdapter, GetBrowserTestAdapter } from "./types"
export { getPythonBrowserTestAdapter } from "./pythonAdapter"
export { TEST_TIMEOUT_MS } from "./constants"

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
