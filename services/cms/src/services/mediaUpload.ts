import { createBlobURL, revokeBlobURL } from "@wordpress/blob"

import { ALT_TEXT_NOT_CHANGED_PLACEHOLDER } from "@/services/altTextPlaceholder"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import { validateFile } from "@/shared-module/common/utils/files"

export interface MediaItem {
  url: string
  alt?: string
  caption?: string
  title?: string
}

export interface MediaUploadProps {
  allowedTypes: string[]
  filesList: File[]
  onError: (message: string) => void
  onFileChange: (files: Partial<MediaItem>[]) => void
}

type MediaUploadType = { courseId: string } | { examId: string }

/** Uploads one file to a CMS media endpoint. */
const uploadFileFromPage = async (file: File, uploadType: MediaUploadType): Promise<MediaItem> => {
  const data = new FormData()
  data.append("file", file, file.name || "unknown")

  const headers = {
    "X-File-Type": file.type || "application/octet-stream",
  }

  const requestPath =
    "courseId" in uploadType
      ? `/api/v0/cms/courses/${uploadType.courseId}/upload`
      : `/api/v0/cms/exams/${uploadType.examId}/upload`

  const response = await fetch(requestPath, {
    method: "POST",
    headers,
    body: data,
  })

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`)
  }

  const uploadedMedia = (await response.json()) as Partial<MediaItem>
  if (typeof uploadedMedia.url !== "string" || uploadedMedia.url.length === 0) {
    throw new Error("Upload succeeded but response did not contain a media URL")
  }

  return {
    url: uploadedMedia.url,
    alt: uploadedMedia.alt,
    caption: uploadedMedia.caption,
    title: uploadedMedia.title,
  }
}

/** Validates file and reports user-visible errors. */
const validateFileAndBroadcastErrors = (
  file: File,
  allowedTypes: string[],
  onError: (message: string) => void,
): boolean => {
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

/** Uploads editor media files and maps response items for Gutenberg. */
const uploadMedia = async ({
  allowedTypes,
  filesList,
  onError = () => undefined,
  onFileChange,
  uploadType,
}: Omit<MediaUploadArgs, "signal">): Promise<void> => {
  const validFiles = Array.from(filesList).filter((file) =>
    validateFileAndBroadcastErrors(file, allowedTypes ?? [], onError),
  )

  const initialItems = validFiles.map<Partial<MediaItem>>((file) => ({
    url: createBlobURL(file),
  }))
  onFileChange(initialItems)

  const mediaItems = initialItems as ((typeof initialItems)[0] | null)[]

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
        const detail = error instanceof Error ? error.message : "Upload failed"
        onError(`${file.name}: ${detail}`)
        showErrorNotification({
          header: "Upload failed",
          message: detail,
        })
      } finally {
        const url = mediaItems[i]?.url
        if (url) {
          revokeBlobURL(url)
        }
        mediaItems[i] = res
        onFileChange(mediaItems.filter((o): o is Partial<MediaItem> => !!o))
      }
    }),
  )
}

interface MediaUploadArgs {
  allowedTypes?: string[]
  filesList: File[]
  onError: (message: string) => void
  onFileChange: (files: Partial<MediaItem>[]) => void
  uploadType: MediaUploadType
}

/** Builds Gutenberg mediaUpload callback for course or exam context. */
export function mediaUploadBuilder(
  uploadType: MediaUploadType,
): (props: MediaUploadProps) => Promise<void> {
  const mediaUpload = async (props: MediaUploadProps): Promise<void> => {
    await uploadMedia({ ...props, uploadType })
  }
  return mediaUpload
}

export default mediaUploadBuilder
