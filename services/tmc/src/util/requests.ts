import { TestRequest } from "@/pages/api/test"
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
  let breaker = true

  // give up after 5min
  new Promise((resolve) => {
    setTimeout(
      () => {
        resolve(null)
      },
      1000 * 60 * 5,
    )
  }).then(() => {
    breaker = false
  })

  while (breaker) {
    const runResult = await checkTestRun(testRunId)
    if (runResult === null) {
      // no results yet...
      // wait for two seconds and try again
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve(null)
        }, 1000 * 2)
      })
    } else {
      return runResult
    }
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
