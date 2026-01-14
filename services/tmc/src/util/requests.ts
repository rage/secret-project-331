import { TestRequest } from "@/app/api/test/route"
import { RunResult } from "@/tmc/cli"

export const runBrowserTests = async (
  templateDownloadUrl: string,
  filename: string,
  filecontents: string,
): Promise<string> => {
  const args: TestRequest = {
    type: "browser",
    templateDownloadUrl: templateDownloadUrl,
    files: [{ filepath: filename, contents: filecontents }],
  }
  console.log("Posting test request")
  const result = await fetch("/tmc/api/test", { method: "POST", body: JSON.stringify(args) })
  const json = await result.json()
  return json["id"]
}

// do not await, use .then
export const waitForTestResults = async (testRunId: string): Promise<RunResult | null> => {
  const startTime = Date.now()
  const timeoutMs = 1000 * 60 * 5 // 5 minutes

  while (Date.now() - startTime < timeoutMs) {
    const runResult = await checkTestRun(testRunId)
    if (runResult !== null) {
      return runResult
    }
    // Wait for two seconds before next check
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2))
  }
  return null
}

export const checkTestRun = async (testRunId: string): Promise<RunResult | null> => {
  const result = await fetch(`/tmc/api/testrun?id=${testRunId}`, { method: "GET" })
  if (result.status !== 200) {
    return null
  }
  const json = await result.json()
  return json
}
