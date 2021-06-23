/**
 * External dependencies
 */
import { compact, get, includes, noop, some, startsWith } from "lodash"
import { uploadFileFromPage } from "."

/**
 * WordPress dependencies
 */
import { createBlobURL, revokeBlobURL } from "@wordpress/blob"
import { UploadMediaOptions, MediaItem } from "@wordpress/media-utils"

// This thingy should support multiple file uploads, but Gutenberg seem to call uploadMedia for each file separately
// if user uploads many file, for example using the Gallery block.
export async function uploadMedia({
  allowedTypes,
  filesList,
  maxUploadFileSize,
  onError = noop,
  onFileChange,
  pageId,
}: Omit<UploadMediaOptions, "onError" | "onFileChange" | "additionalData"> & {
  // We need to omit the UploadMediaOptions onError function,
  // because it seems to not be supported yet or the types definition is not up-to-date
  // Blocks still seem to use one param:
  // https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/image/edit.js#L113-L116
  pageId: string
  onError: (message: string) => void
  onFileChange: (files: Partial<MediaItem>[]) => void
}): Promise<void> {
  const files = [...(filesList as File[])]

  const filesSet: Partial<MediaItem>[] = []
  const setMediaFiles = (i: number, value: Partial<MediaItem> | null) => {
    revokeBlobURL(get(filesSet, [i, "url"]))
    filesSet[i] = value
    onFileChange(compact(filesSet))
  }

  const isAllowedType = (fileType: string) => {
    if (!allowedTypes) {
      return true
    }
    return some(allowedTypes, (allowedType) => {
      if (includes(allowedType, "/")) {
        return allowedType === fileType
      }
      return startsWith(fileType, `${allowedType}/`)
    })
  }

  const triggerError = (error: { message: string; file: File }) => {
    const message = [error.file.name, ": ", error.message].join("")
    onError(message)
  }

  const validFiles = files.flatMap((file) => {
    if (file.type && !isAllowedType(file.type)) {
      triggerError({
        message: "This file type is not supported here.",
        file,
      })
      return []
    }

    if (maxUploadFileSize && file.size > maxUploadFileSize) {
      triggerError({
        message: "File exceeds maximum upload size 10MB.",
        file,
      })
      return []
    }

    if (file.size <= 0) {
      triggerError({
        message: "File is empty.",
        file,
      })
      return []
    }

    filesSet.push({ url: createBlobURL(file) })
    onFileChange(filesSet)
    return [file]
  })

  validFiles.forEach(async (file, i) => {
    try {
      const uploadedMedia = await uploadMediaFromFile(file, pageId)
      const mediaObject = {
        alt: uploadedMedia.alt,
        caption: uploadedMedia.caption,
        title: uploadedMedia.title,
        url: uploadedMedia.url,
      }
      setMediaFiles(i, mediaObject)
    } catch (error) {
      /*
        Issue #124, figure out this race condition.
        setMediaFiles(index, null) should revoke the blob
        and set the Image edit to MediaPlaceholder and be able to use noticeUi (???)
        https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/image/edit.js#L290-L328

        Or perhaps this could be fixed in some other way so that we can get the backend errors visible.
      */
      setMediaFiles(i, null)
      const message = error.data.detail
      triggerError({ message, file })
    }
  })
}

function uploadMediaFromFile(file: File, pageId: string): Promise<MediaItem> {
  const data = new window.FormData()
  data.append("file", file, file.name || "unknown")
  return uploadFileFromPage({ uploadData: data, pageId })
}
