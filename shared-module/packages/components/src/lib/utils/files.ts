export function fileListToArray(files: FileList | File[] | null | undefined): File[] {
  if (!files) {
    return []
  }

  if (Array.isArray(files)) {
    return files
  }

  return Array.from(files)
}

export function formatFileName(fileName: string) {
  return fileName.trim().length > 0 ? fileName.trim() : "Unnamed file"
}

export function summarizeFiles(
  files: FileList | File[] | null | undefined,
  emptyLabel = "No file selected",
) {
  const resolvedFiles = fileListToArray(files)

  if (resolvedFiles.length === 0) {
    return emptyLabel
  }

  if (resolvedFiles.length === 1) {
    return formatFileName(resolvedFiles[0]?.name ?? emptyLabel)
  }

  if (resolvedFiles.length <= 3) {
    return resolvedFiles.map((file) => formatFileName(file.name)).join(", ")
  }

  const visibleNames = resolvedFiles.slice(0, 2).map((file) => formatFileName(file.name))
  return `${visibleNames.join(", ")} +${resolvedFiles.length - 2} more`
}
