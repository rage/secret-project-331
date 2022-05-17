/* eslint-disable i18next/no-literal-string */
const TEN_MEGABYTES = 10 * 1024 * 1024

/**
 * Checks a file against the provided whitelist of mimetypes and extensions to deem whether it
 * matches any of the provided types or not.
 *
 * @param file The file to check.
 * @param typesAndExtensions Array of mimetypes and file extensions for matching. Mimetypes are
 * eg. of the form `image` or `image/png`. Extensions start with a dot eg. `.png`.
 */
export function fileMatchesType(file: File, typesAndExtensions: string[] | undefined): boolean {
  if (!typesAndExtensions || typesAndExtensions.length === 0) {
    return true
  }

  const extensionIndex = file.name.lastIndexOf(".")
  const fileExtension = extensionIndex > 0 ? file.name.substring(extensionIndex) : undefined
  const fileType = file.type || undefined

  return typesAndExtensions.some((type) => {
    // Matches mime/type
    if (type && type.indexOf("/") !== -1) {
      return type === fileType
    }

    // Matches .extension
    if (type.startsWith(".")) {
      return type === fileExtension
    }

    // Matches mimetype
    if (fileType) {
      return fileType.startsWith(type)
    }

    return false
  })
}

/**
 * Validates a file based on its size and a whitelist of allowed mimetypes and extensions. Throws
 * an error detailing a reason for disqualification if the validation fails.
 *
 * @param file File to validate.
 * @param allowedTypes Array of valid mimetypes and file extensions. Mimetypes are eg. of the form
 * `image` or `image/png`. Extensions start with a dot eg. `.png`.
 * @param maxSize Maximum size of the file in bytes. Defaults to 10MiB.
 */
export function validateFile(file: File, allowedTypes: string[], maxSize = TEN_MEGABYTES): void {
  if (file.size <= 0) {
    throw new Error(formatError(file, `You sent an empty file.`))
  }

  if (file.size > maxSize) {
    const fileSizeMb = Math.ceil(file.size * 0.000001)
    throw new Error(
      formatError(file, `File is too big. Your file was ${fileSizeMb}MB while the limit is 10MB.`),
    )
  }

  if (!fileMatchesType(file, allowedTypes)) {
    throw new Error(formatError(file, `File type (${file.type}) not supported.`))
  }
}

function formatError(file: File, message: string): string {
  return `${file.name}: ${message}`
}
