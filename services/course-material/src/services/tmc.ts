import axios from "axios"

const tmcClient = axios.create({
  baseURL: "/tmc/api",
  headers: { "Content-Type": "application/json" },
})

export const runBrowserTests = async (
  templateDownloadUrl: string,
  filename: string,
  filecontents: string,
): Promise<string> => {
  const args = {
    type: "browser",
    templateDownloadUrl: templateDownloadUrl,
    files: [{ filepath: filename, contents: filecontents }],
  }
  console.log("Posting test request")
  const result = await tmcClient.post("/test", args)
  return result.data["id"]
}

export const checkTestRun = async (testRunId: string): Promise<unknown | null> => {
  const params = new URLSearchParams([["id", testRunId]])
  const result = await tmcClient.get("/testrun", { params })
  if (result.status !== 200) {
    console.error("err")
    return null
  }
  return result.data
}
