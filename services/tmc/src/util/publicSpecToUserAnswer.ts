import { PublicSpec, UserAnswer } from "@/util/stateInterfaces"

export async function publicSpecToIframeUserAnswer(publicSpec: PublicSpec): Promise<UserAnswer> {
  if (publicSpec.type === "browser") {
    const res = await fetch("/api/extract-stub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stub_download_url: publicSpec.stub_download_url }),
    })
    if (!res.ok) {
      throw new Error(`extract-stub failed: ${res.status}`)
    }
    const { files: rawFiles } = (await res.json()) as {
      files: Array<{ filepath: string; contents: string }>
    }
    const order = publicSpec.student_file_paths
    let files = rawFiles ?? []
    if (order.length > 0) {
      const indexOf = (path: string) => {
        const i = order.indexOf(path)
        return i === -1 ? 1e9 : i
      }
      files = [...files].sort((a, b) => indexOf(a.filepath) - indexOf(b.filepath))
    }
    return { type: "browser", files }
  } else if (publicSpec.type === "editor") {
    return { type: "editor", archive_download_url: publicSpec.stub_download_url }
  } else {
    throw new Error("unreachable")
  }
}
