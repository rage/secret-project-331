import type { FileUploadResultEntry } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import type { GradingRequestFile } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types-2"

/**
 * What the playground remembers about the files it has uploaded on an iframe's behalf, keyed by
 * host file id.
 *
 * The upload response carries only an id and a url, and the playground has no submission rows to
 * read the rest back from, so the name, mime and size are kept from the `File` objects the iframe
 * handed over.
 */
export type PlaygroundUploadedFiles = Record<string, GradingRequestFile>

/** Pairs an upload response with the files it was made from; both are in request order. */
export function recordPlaygroundUploads(
  known: PlaygroundUploadedFiles,
  files: readonly File[],
  entries: readonly FileUploadResultEntry[],
): PlaygroundUploadedFiles {
  const recorded: PlaygroundUploadedFiles = { ...known }
  entries.forEach((entry, index) => {
    const file = files[index]
    if (!file) {
      return
    }
    recorded[entry.id] = {
      id: entry.id,
      name: file.name,
      mime: file.type,
      size_bytes: file.size,
      download_url: entry.url,
    }
  })
  return recorded
}

/**
 * The `submission_files` of a grading request for an answer that named `fileIds`, in answer order.
 *
 * Throws on an id the playground did not upload itself, because grading a file answer with files
 * silently missing would look like a bug in the exercise service being developed.
 */
export function playgroundSubmissionFiles(
  fileIds: readonly string[] | undefined,
  known: PlaygroundUploadedFiles,
): GradingRequestFile[] {
  return (fileIds ?? []).map((id) => {
    const file = known[id]
    if (!file) {
      throw new Error(`The answer names a file the playground did not upload: ${id}`)
    }
    return file
  })
}
