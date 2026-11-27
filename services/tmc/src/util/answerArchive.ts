import { extractTarZstd } from "@/util/helpers"
import type { ExerciseFile, PublicSpec } from "@/util/stateInterfaces"
import { studentFilesInEditorOrder } from "@/util/studentFiles"

/** Downloads a project archive and returns the files in it. */
async function fetchArchiveFiles(url: string): Promise<ExerciseFile[]> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download the archive: ${response.status.toString()}`)
  }
  return await extractTarZstd(Buffer.from(await response.arrayBuffer()))
}

/** Downloads an answer or project archive and returns its student files in editor order. */
export async function fetchStudentFiles(
  url: string,
  publicSpec: PublicSpec,
): Promise<ExerciseFile[]> {
  return studentFilesInEditorOrder(await fetchArchiveFiles(url), publicSpec)
}

export interface EditorSeed {
  /** What the editor opens: the previous submission's student files, else the stub's. */
  files: ExerciseFile[]
  /**
   * The stub's student files, which Reset returns to. Null when the stub failed to download but a
   * previous answer did, so an unrelated stub failure does not lock the student out of their work.
   */
  startingFiles: ExerciseFile[] | null
}

/** The browser editor's starting point. Empty for an editor-mode exercise, which has no editor. */
export async function initialEditorFiles(
  publicSpec: PublicSpec,
  previousSubmissionArchiveUrl: string | null,
): Promise<EditorSeed> {
  if (publicSpec.type !== "browser") {
    return { files: [], startingFiles: [] }
  }
  const stubDownload = fetchStudentFiles(publicSpec.stub_download_url, publicSpec)
  if (previousSubmissionArchiveUrl === null) {
    const startingFiles = await stubDownload
    return { files: startingFiles, startingFiles }
  }
  const [stub, previous] = await Promise.allSettled([
    stubDownload,
    fetchStudentFiles(previousSubmissionArchiveUrl, publicSpec),
  ])
  if (previous.status === "rejected") {
    throw previous.reason
  }
  return {
    files: previous.value,
    startingFiles: stub.status === "fulfilled" ? stub.value : null,
  }
}
