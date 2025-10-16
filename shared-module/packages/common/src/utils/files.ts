// These limits must match the limits in server/src/controllers/helpers/file_uploading.rs
// If you modify these, update the Rust file as well.
// Note: The nginx ingress also has a limit on max request size (see kubernetes/base/ingress.yml). That one should not be increased too much.
export const FILE_SIZE_LIMITS = {
  // 10 MB for images
  IMAGE: 10 * 1024 * 1024,
  // 100 MB for audio
  AUDIO: 100 * 1024 * 1024,
  // 100 MB for video, if you want bigger videos, use Youtube or Unitube.
  VIDEO: 100 * 1024 * 1024,
  // 25 MB for other documents
  DOCUMENT: 25 * 1024 * 1024,
  // 10 MB default fallback
  DEFAULT: 10 * 1024 * 1024,
} as const

/**
 * Gets the maximum file size for a specific file type based on the file's MIME type.
 *
 * @param file The file to check the type for.
 * @returns The maximum allowed size in bytes for this file type.
 */
export function getMaxFileSizeForType(file: File): number {
  // Handle cases where file.type might be empty or undefined
  if (!file.type || file.type.trim() === "") {
    return FILE_SIZE_LIMITS.DEFAULT
  }

  // Extract the main type from MIME type (e.g., "image" from "image/png")
  const typeParts = file.type.split("/")
  const fileType = typeParts.length > 0 ? typeParts[0].toLowerCase() : ""

  switch (fileType) {
    case "image":
      return FILE_SIZE_LIMITS.IMAGE
    case "audio":
      return FILE_SIZE_LIMITS.AUDIO
    case "video":
      return FILE_SIZE_LIMITS.VIDEO
    case "application":
    case "text":
      return FILE_SIZE_LIMITS.DOCUMENT
    default:
      return FILE_SIZE_LIMITS.DEFAULT
  }
}

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

export function fileMatchAudio(file: File): { [key: string]: string | undefined } | undefined {
  if (!file) {
    return
  }

  const extensionIndex = file.name.lastIndexOf(".")
  const fileExtension = extensionIndex > 0 ? file.name.substring(extensionIndex) : undefined
  const fileType = file.type || undefined

  return { extension: fileExtension, type: fileType }
}

/**
 * Validates a file based on its size and a whitelist of allowed mimetypes and extensions. Throws
 * an error detailing a reason for disqualification if the validation fails.
 *
 * @param file File to validate.
 * @param allowedTypes Array of valid mimetypes and file extensions. Mimetypes are eg. of the form
 * `image` or `image/png`. Extensions start with a dot eg. `.png`.
 * @param maxSize Maximum size of the file in bytes. If not provided, uses the appropriate limit based on file type.
 */
export function validateFile(file: File, allowedTypes: string[], maxSize?: number): void {
  if (file.size <= 0) {
    throw new Error(formatError(file, `You sent an empty file.`))
  }

  // Use the appropriate file size limit based on file type if maxSize is not provided
  const fileSizeLimit = maxSize ?? getMaxFileSizeForType(file)
  const fileSizeMb = Math.ceil(file.size * 0.000001)
  const limitMb = Math.ceil(fileSizeLimit * 0.000001)

  if (file.size > fileSizeLimit) {
    throw new Error(
      formatError(
        file,
        `File is too big. Your file was ${fileSizeMb}MB while the limit is ${limitMb}MB.`,
      ),
    )
  }

  if (!fileMatchesType(file, allowedTypes)) {
    throw new Error(formatError(file, `File type (${file.type}) not supported.`))
  }
}

function formatError(file: File, message: string): string {
  return `${file.name}: ${message}`
}
