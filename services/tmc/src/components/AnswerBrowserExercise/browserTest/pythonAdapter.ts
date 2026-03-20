import type { BrowserTestRunnerAdapter } from "./types"

function getTestWorkerUrl(): string {
  const base = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BASE_PATH
  return `${base ?? ""}/browserTestWorker.js`
}

/**
 * Builds the full script for the Python runtime: injects base64-encoded user code
 * so the server-generated script can decode it (expects __webeditor_user_code_b64).
 */
function buildScript(specScript: string, userCode: string): string {
  const base64Code = btoa(unescape(encodeURIComponent(userCode)))
  const safeBase64 = base64Code.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return `__webeditor_user_code_b64 = "${safeBase64}"\n${specScript}`
}

export function getPythonBrowserTestAdapter(): BrowserTestRunnerAdapter {
  return {
    canRun(filepath: string): boolean {
      return filepath.endsWith(".py")
    },
    getCannotRunMessage: () => "Only Python files can be tested.",
    buildScript,
    getWorkerUrl: getTestWorkerUrl,
  }
}
