import { uploadFileFromPage } from "."
import { createBlobURL, revokeBlobURL } from "@wordpress/blob"
import { UploadMediaOptions, MediaItem } from "@wordpress/media-utils"

// This thingy should support multiple file uploads, but Gutenberg seem to call uploadMedia for each file separately
// if user uploads many file, for example using the Gallery block.
export async function uploadMedia({
  allowedTypes,
  filesList,
  maxUploadFileSize,
  onError = () => undefined,
  onFileChange,
  courseId,
}: Omit<UploadMediaOptions, "onError" | "onFileChange" | "additionalData"> & {
  // We need to omit the UploadMediaOptions onError function,
  // because it seems to not be supported yet or the types definition is not up-to-date
  // Blocks still seem to use one param:
  // https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/image/edit.js#L113-L116
  courseId: string
  onError: (message: string) => void
  onFileChange: (files: Partial<MediaItem>[]) => void
}): Promise<void> {
  const validFiles = Array.from(filesList).filter((file) =>
    validateFileAndBroadcastErrors(file, allowedTypes, maxUploadFileSize, onError),
  )

  const mediaItems: Partial<MediaItem>[] = validFiles.map((file) => {
    // Indicate in the UI that the upload has started by initially placing a placeholder blob url.
    return { url: createBlobURL(file) }
  })
  // Tell gutenberg to show the placeholders
  onFileChange(mediaItems)

  const promises = validFiles.map(async (file, i) => {
    let res: Partial<MediaItem> | null = null
    try {
      const uploadedMedia = await uploadFileFromPage(file, courseId)
      res = {
        alt: "Add alt",
        caption: "Add caption",
        title: "Add title",
        url: uploadedMedia.url,
      }
    } catch (error) {
      onError(formatError(file, error?.data?.detail || "Upload failed"))
    } finally {
      // Upload has either succeeded or failed so we can remove the placeholder that is being used as a upload indicator.
      revokeBlobURL(mediaItems[i]?.url)
      // Either sets the result or sets the item to null
      mediaItems[i] = res
      // Broadcast only succeeded items to the consumer
      onFileChange(mediaItems.filter((o) => !!o))
    }
  })
  await Promise.all(promises)
}

function isFileTypeAllowed(type: string, allowedTypes: string[] | undefined): boolean {
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

function validateFileAndBroadcastErrors(
  file: File,
  allowedTypes: string[],
  maxSize: number,
  onError: (message: string) => void,
): boolean {
  if (file.type && !isFileTypeAllowed(file.type, allowedTypes)) {
    onError(formatError(file, `File type (${file.type}) not supported.`))
    return false
  }

  if (file.size <= 0) {
    onError(formatError(file, `You sent an empty file.`))
    return false
  }

  if (maxSize && file.size > maxSize) {
    const fileSizeMb = Math.ceil(file.size * 0.000001)
    onError(
      formatError(file, `File is too big. Your file was ${fileSizeMb}MB while the limit is 10MB.`),
    )
    return false
  }
  return true
}

function formatError(file: File, message: string): string {
  return `${file.name}: ${message}`
}
