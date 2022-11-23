/* eslint-disable i18next/no-literal-string */
import { createBlobURL, revokeBlobURL } from "@wordpress/blob"
import { MediaItem, UploadMediaOptions } from "@wordpress/media-utils"

import { validateFile } from "../../../shared-module/utils/files"

import { MediaUploadType, uploadFileFromPage } from "."

// Don't change this, with this default value we can detect when the teacher has not changed the alt text.
const ALT_TEXT_NOT_CHANGED_PLACEHOLDER = "Add alt"

// This thingy should support multiple file uploads, but Gutenberg seem to call uploadMedia for each file separately
// if user uploads many file, for example using the Gallery block.
export async function uploadMedia({
  allowedTypes,
  filesList,
  maxUploadFileSize,
  onError = () => undefined,
  onFileChange,
  uploadType,
}: Omit<UploadMediaOptions, "onError" | "onFileChange" | "additionalData"> & {
  // We need to omit the UploadMediaOptions onError function,
  // because it seems to not be supported yet or the types definition is not up-to-date
  // Blocks still seem to use one param:
  // https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/image/edit.js#L113-L116
  uploadType: MediaUploadType
  onError: (message: string) => void
  onFileChange: (files: Partial<MediaItem>[]) => void
}): Promise<void> {
  const validFiles = Array.from(filesList).filter((file) =>
    validateFileAndBroadcastErrors(file, allowedTypes ?? [], maxUploadFileSize, onError),
  )

  const initialItems = validFiles.map<Partial<MediaItem>>((file) => {
    // Indicate in the UI that the upload has started by initially placing a placeholder blob url.
    return { url: createBlobURL(file) }
  })
  // Tell gutenberg to show the placeholders
  onFileChange(initialItems)

  const mediaItems = initialItems as Array<typeof initialItems[0] | null>

  await Promise.all(
    validFiles.map(async (file, i) => {
      let res: (Pick<MediaItem, "url"> & Partial<MediaItem>) | null = null
      try {
        const uploadedMedia = await uploadFileFromPage(file, uploadType)
        res = {
          alt: ALT_TEXT_NOT_CHANGED_PLACEHOLDER,
          caption: undefined,
          title: undefined,
          url: uploadedMedia.url,
        }
      } catch (error: unknown) {
        // @ts-ignore: null checked
        const detail = error?.data?.message
        onError(`${file.name}: ${detail || "Upload failed"}`)
      } finally {
        // Upload has either succeeded or failed so we can remove the placeholder that is being used as a upload indicator.
        const url = mediaItems[i]?.url
        if (url) {
          revokeBlobURL(url)
        }
        // Either sets the result or sets the item to null
        mediaItems[i] = res
        // Broadcast only succeeded items to the consumer
        onFileChange(mediaItems.filter((o): o is Partial<MediaItem> => !!o))
      }
    }),
  )
}

function validateFileAndBroadcastErrors(
  file: File,
  allowedTypes: string[],
  maxSize: number,
  onError: (message: string) => void,
): boolean {
  try {
    validateFile(file, allowedTypes, maxSize)
  } catch (e: unknown) {
    if (!(e instanceof Error)) {
      throw e
    }
    onError(e.message)
    return false
  }
  return true
}
