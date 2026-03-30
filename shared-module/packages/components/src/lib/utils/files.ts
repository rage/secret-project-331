export function fileListToArray(files: FileList | File[] | null | undefined): File[] {
  if (!files) {
    return []
  }

  if (Array.isArray(files)) {
    return files
  }

  return Array.from(files)
}

/** Returns the trimmed file name, or an empty string when the name is blank. */
export function formatFileName(fileName: string): string {
  return fileName.trim()
}

export type FileSummaryLabels = {
  empty: string
  unnamedFile: string
  /** Localized “+N more” segment when more than three files are selected. */
  formatMoreFiles: (additionalCount: number) => string
}

/**
 * Builds a short summary of a file list. Callers must pass translated labels
 * (empty, unnamed file, and formatMoreFiles).
 */
export function summarizeFiles(
  files: FileList | File[] | null | undefined,
  labels: FileSummaryLabels,
): string {
  const resolvedFiles = fileListToArray(files)

  if (resolvedFiles.length === 0) {
    return labels.empty
  }

  const displayName = (name: string) => {
    const trimmed = formatFileName(name)
    return trimmed.length > 0 ? trimmed : labels.unnamedFile
  }

  if (resolvedFiles.length === 1) {
    return displayName(resolvedFiles[0]?.name ?? "")
  }

  if (resolvedFiles.length <= 3) {
    return resolvedFiles.map((file) => displayName(file.name)).join(", ")
  }

  const visibleNames = resolvedFiles.slice(0, 2).map((file) => displayName(file.name))
  return `${visibleNames.join(", ")} ${labels.formatMoreFiles(resolvedFiles.length - 2)}`
}
