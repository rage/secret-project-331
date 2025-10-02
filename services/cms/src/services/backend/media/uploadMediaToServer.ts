import { createBlobURL, revokeBlobURL } from "@wordpress/blob"

import { MediaUploadType, uploadFileFromPage } from "."

import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import { validateFile } from "@/shared-module/common/utils/files"

// Don't change this, with this default value we can detect when the teacher has not changed the alt text.
const ALT_TEXT_NOT_CHANGED_PLACEHOLDER = "Add alt"

export interface UploadMediaArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additionalData?: any
  allowedTypes?: string[]
  filesList: File[]
  signal?: AbortSignal
}

export interface MediaItem {
  url: string
  alt?: string
  caption?: string
  title?: string
}

// This thingy should support multiple file uploads, but Gutenberg seem to call uploadMedia for each file separately
// if user uploads many file, for example using the Gallery block.
export async function uploadMedia({
  allowedTypes,
  filesList,
  onError = () => undefined,
  onFileChange,
  uploadType,
}: Omit<UploadMediaArgs, "onError" | "onFileChange" | "additionalData" | "maxUploadFileSize"> & {
  uploadType: MediaUploadType
  onError: (message: string) => void
  onFileChange: (files: Partial<MediaItem>[]) => void
}): Promise<void> {
  console.info("[UploadMedia] Starting upload process:", {
    fileCount: filesList.length,
    allowedTypes,
    uploadType,
  })

  const validFiles = Array.from(filesList).filter((file) =>
    validateFileAndBroadcastErrors(file, allowedTypes ?? [], onError),
  )
  console.info("[UploadMedia] Valid files after validation:", validFiles.length)

  const initialItems = validFiles.map<Partial<MediaItem>>((file) => {
    const blobUrl = createBlobURL(file)
    console.info("[UploadMedia] Created blob URL for file:", { fileName: file.name, blobUrl })
    return { url: blobUrl }
  })
  onFileChange(initialItems)

  const mediaItems = initialItems as Array<(typeof initialItems)[0] | null>

  await Promise.all(
    validFiles.map(async (file, i) => {
      console.info("[UploadMedia] Processing file:", {
        name: file.name,
        size: file.size,
        type: file.type,
        index: i,
      })

      let res: (Pick<MediaItem, "url"> & Partial<MediaItem>) | null = null
      try {
        console.info("[UploadMedia] Uploading file:", file.name)
        const uploadedMedia = await uploadFileFromPage(file, uploadType)
        res = {
          alt: ALT_TEXT_NOT_CHANGED_PLACEHOLDER,
          caption: undefined,
          title: undefined,
          url: uploadedMedia.url,
        }
        console.info("[UploadMedia] File uploaded successfully:", {
          fileName: file.name,
          url: uploadedMedia.url,
        })
      } catch (error: unknown) {
        console.error("[UploadMedia] Upload failed for file:", {
          fileName: file.name,
          error,
        })
        // @ts-expect-error: null checked
        const detail = error?.response?.data?.message
        onError(`${file.name}: ${detail || "Upload failed"}`)
        showErrorNotification({
          header: "Upload failed",
          message: detail || "Upload failed",
        })
      } finally {
        const url = mediaItems[i]?.url
        if (url) {
          console.info("[UploadMedia] Revoking blob URL:", { fileName: file.name, url })
          revokeBlobURL(url)
        }
        mediaItems[i] = res
        const successfulItems = mediaItems.filter((o): o is Partial<MediaItem> => !!o)
        console.info("[UploadMedia] Broadcasting updated media items:", {
          fileName: file.name,
          successfulItemsCount: successfulItems.length,
        })
        onFileChange(successfulItems)
      }
    }),
  )

  console.info("[UploadMedia] Upload process completed")
}

function validateFileAndBroadcastErrors(
  file: File,
  allowedTypes: string[],
  onError: (message: string) => void,
): boolean {
  try {
    validateFile(file, allowedTypes)
  } catch (e: unknown) {
    if (!(e instanceof Error)) {
      throw e
    }
    showErrorNotification({
      header: "Upload failed",
      message: e.message,
    })
    onError(e.message)
    return false
  }
  return true
}
