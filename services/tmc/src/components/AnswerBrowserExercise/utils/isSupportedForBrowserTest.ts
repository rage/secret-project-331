import { extensionToLanguage } from "./extensionToLanguage"

import type { BrowserTestSpec } from "@/util/stateInterfaces"

/**
 * Returns true if the given file can be tested in the browser for the given runtime.
 * Used to enable/disable the Test button.
 */
export function isSupportedForBrowserTest(
  filepath: string,
  runtime: BrowserTestSpec["runtime"],
): boolean {
  const lang = extensionToLanguage(filepath)
  if (lang == null) {
    return false
  }
  switch (runtime) {
    case "python":
      return lang === "python"
    default:
      return false
  }
}
