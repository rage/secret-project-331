/**
 * External dependencies
 */
import { compact, get, includes, noop, some, startsWith } from "lodash"
import { uploadFile } from "."

/**
 * WordPress dependencies
 */
import { createBlobURL, revokeBlobURL } from "@wordpress/blob"
import { UploadMediaOptions, MediaItem } from "@wordpress/media-utils"

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

  const filesSet = []
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

  const validFiles = files.map((file) => {
    if (file.type && !isAllowedType(file.type)) {
      triggerError({
        message: "This file type is not supported here.",
        file,
      })
      return
    }
    if (maxUploadFileSize && file.size > maxUploadFileSize) {
      triggerError({
        message: "File exceeds maximum upload size.",
        file,
      })
      return
    }

    if (file.size <= 0) {
      triggerError({
        message: "File is empty.",
        file,
      })
      return
    }
    filesSet.push({ url: createBlobURL(file) })
    onFileChange(filesSet)
    return file
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
      setMediaFiles(i, null)
      const message = error.data.detail
      triggerError({ message, file })
    }
  })
}

function uploadMediaFromFile(file: File, pageId: string): Promise<MediaItem> {
  const data = new window.FormData()
  data.append("file", file, file.name || file.type.replace("/", "."))
  return uploadFile({ uploadData: data, pageId })
}
