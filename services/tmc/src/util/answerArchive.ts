import basePath from "@/lib/basePath"
import { extractTarZstd } from "@/util/helpers"
import type { ExerciseFile, PublicSpec } from "@/util/stateInterfaces"

/** The host names the entries of its answer-file zip export from this mime; it maps it to `.tar.zst`. */
const ARCHIVE_MIME = "application/x-zstd-compressed-tar"

/** Name the packed browser answer is stored under; the host shows it when the archive is downloaded. */
const PACKED_ARCHIVE_NAME = "submission.tar.zst"

/** Downloads a project archive and returns the files in it. */
export async function fetchArchiveFiles(url: string): Promise<ExerciseFile[]> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download the archive: ${response.status.toString()}`)
  }
  return await extractTarZstd(Buffer.from(await response.arrayBuffer()))
}

/**
 * The files the browser editor starts from: the student's previous submission when they have one,
 * otherwise the exercise stub. Empty for an editor-mode exercise, which has no in-browser editor.
 *
 * Ordered by the public spec's `student_file_paths`, with anything it does not name last.
 */
export async function initialEditorFiles(
  publicSpec: PublicSpec,
  previousSubmissionArchiveUrl: string | null,
): Promise<ExerciseFile[]> {
  if (publicSpec.type !== "browser") {
    return []
  }
  const files = await fetchArchiveFiles(
    previousSubmissionArchiveUrl ?? publicSpec.stub_download_url,
  )
  const order = publicSpec.student_file_paths
  if (order.length === 0) {
    return files
  }
  const rank = (filepath: string) => {
    const index = order.indexOf(filepath)
    return index === -1 ? order.length : index
  }
  return [...files].toSorted((a, b) => rank(a.filepath) - rank(b.filepath))
}

/**
 * Packs the browser editor's files into the archive the answer consists of, using the service's own
 * pack endpoint because the iframe has no compressor.
 *
 * The returned file is what gets uploaded through the host's file-upload channel.
 */
export async function packBrowserAnswer(files: readonly ExerciseFile[]): Promise<File> {
  const response = await fetch(`${basePath()}/api/pack-browser-answer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(files),
  })
  if (!response.ok) {
    throw new Error(`Failed to pack the answer: ${response.status.toString()}`)
  }
  return new File([await response.blob()], PACKED_ARCHIVE_NAME, { type: ARCHIVE_MIME })
}
