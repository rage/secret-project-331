export function isFileTypeAllowed(type: string, allowedTypes: string[] | undefined): boolean {
  if (!allowedTypes) {
    return true
  }
  const allowingRule = allowedTypes.find((at) => {
    if (at.indexOf("/") !== -1) {
      return type === at
    }
    return type.startsWith(at)
  })
  return allowingRule !== undefined
}

export function validateFile(file: File, allowedTypes: string[], maxSize = 10485760): void {
  if (file.type && !isFileTypeAllowed(file.type, allowedTypes)) {
    throw new Error(formatError(file, `File type (${file.type}) not supported.`))
  }

  if (file.size <= 0) {
    throw new Error(formatError(file, `You sent an empty file.`))
  }

  if (maxSize && file.size > maxSize) {
    const fileSizeMb = Math.ceil(file.size * 0.000001)
    throw new Error(
      formatError(file, `File is too big. Your file was ${fileSizeMb}MB while the limit is 10MB.`),
    )
  }
}

function formatError(file: File, message: string): string {
  return `${file.name}: ${message}`
}
