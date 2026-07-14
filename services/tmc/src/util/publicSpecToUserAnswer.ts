import { extractTarZstd } from "@/util/helpers"
import type { PublicSpec, UserAnswer } from "@/util/stateInterfaces"

export async function publicSpecToIframeUserAnswer(publicSpec: PublicSpec): Promise<UserAnswer> {
  if (publicSpec.type === "browser") {
    const stubResponse = await fetch(publicSpec.stub_download_url)
    const tarZstdArchive = await stubResponse.arrayBuffer()
    let files = await extractTarZstd(Buffer.from(tarZstdArchive))
    const order = publicSpec.student_file_paths
    if (order.length > 0) {
      const indexOf = (path: string) => {
        const i = order.indexOf(path)
        return i === -1 ? 1e9 : i
      }
      files = [...files].toSorted((a, b) => indexOf(a.filepath) - indexOf(b.filepath))
    }
    return { type: "browser", files }
  } else if (publicSpec.type === "editor") {
    return { type: "editor", archive_download_url: publicSpec.stub_download_url }
  }
  throw new Error("unreachable")
}
