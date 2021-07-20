import { createBlobURL, revokeBlobURL } from "@wordpress/blob"
import { MediaItem, UploadMediaOptions } from "@wordpress/media-utils"

import { validateFile } from "../../../shared-module/utils/files"

import { uploadFileFromPage } from "."

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
    validateFileAndBroadcastErrors(file, allowedTypes ?? [], maxUploadFileSize, onError),
  )

  const mediaItems: Pick<MediaItem, "url">[] = validFiles.map((file) => {
    // Indicate in the UI that the upload has started by initially placing a placeholder blob url.
    return { url: createBlobURL(file) }
  })
  // Tell gutenberg to show the placeholders
  onFileChange(mediaItems)

  const results = await Promise.all(
    validFiles.map<Promise<Partial<MediaItem> | null>>(async (file, i) => {
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
        onError(`${file.name}: ${error?.data?.detail || "Upload failed"}`)
      } finally {
        // Upload has either succeeded or failed so we can remove the placeholder that is being used as a upload indicator.
        revokeBlobURL(mediaItems[i].url)
      }
      return res
    }),
    // Broadcast only succeeded items to the consumer
  )
  onFileChange(results.filter((o): o is Partial<MediaItem> => !!o))
}

function validateFileAndBroadcastErrors(
  file: File,
  allowedTypes: string[],
  maxSize: number,
  onError: (message: string) => void,
): boolean {
  try {
    validateFile(file, allowedTypes, maxSize)
  } catch (e) {
    onError(e.message)
    return false
  }
  return true
}
