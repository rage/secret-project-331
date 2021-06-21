/**
 * External dependencies
 */
import { compact, forEach, get, has, includes, noop, some, startsWith } from "lodash"

/**
 * WordPress dependencies
 */
import { createBlobURL, revokeBlobURL } from "@wordpress/blob"
import { __, sprintf } from "@wordpress/i18n"
import { uploadFile } from "."
import { UploadMediaOptions, MediaItem, UploadMediaErrorCode } from "@wordpress/media-utils"

/**
 *	Media Upload is used by audio, image, gallery, video, and file blocks to
 *	handle uploading a media file when a file upload button is activated.
 *
 *	TODO: future enhancement to add an upload indicator.
 *
 * @param {Object}   $0                    Parameters object passed to the function.
 * @param {?Array}   $0.allowedTypes       Array with the types of media that can be uploaded, if unset all types are allowed.
 * @param {?Object}  $0.additionalData     Additional data to include in the request.
 * @param {Array}    $0.filesList          List of files.
 * @param {?number}  $0.maxUploadFileSize  Maximum upload size in bytes allowed for the site.
 * @param {Function} $0.onError            Function called when an error happens.
 * @param {Function} $0.onFileChange       Function called each time a file or a temporary representation of the file is available.
 */
export async function uploadMedia({
  allowedTypes,
  additionalData = {},
  filesList,
  maxUploadFileSize,
  onError = noop,
  onFileChange,
  pageId,
}: Omit<UploadMediaOptions, "onError"> & {
  // We need to omit the UploadMediaOptions onError function,
  // because it seems to not be supported yet or the types definition is not up-to-date
  // Blocks still seem to use one param:
  // https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/image/edit.js#L113-L116
  pageId: string
  onError: (message: string) => void
}): Promise<void> {
  // Cast filesList to array
  const files = [...(filesList as File[])]

  const filesSet = []
  const setAndUpdateFiles = (idx: number, value: Partial<MediaItem>) => {
    revokeBlobURL(get(filesSet, [idx, "url"]))
    filesSet[idx] = value
    onFileChange(compact(filesSet))
  }

  // Allowed type specified by consumer
  const isAllowedType = (fileType) => {
    if (!allowedTypes) {
      return true
    }
    return some(allowedTypes, (allowedType) => {
      // If a complete mimetype is specified verify if it matches exactly the mime type of the file.
      if (includes(allowedType, "/")) {
        return allowedType === fileType
      }
      // Otherwise a general mime type is used and we should verify if the file mimetype starts with it.
      return startsWith(fileType, `${allowedType}/`)
    })
  }

  // Build the error message including the filename
  const triggerError = (error: { code: UploadMediaErrorCode; message: string; file: File }) => {
    // error.message = [error.file.name, ": ", error.message].join("")
    // onError(error)
    const message = [error.file.name, ": ", error.message].join("")
    onError(message)
  }

  const validFiles = []

  for (const mediaFile of files) {
    // Check if the block supports this mime type.
    // Defer to the server when type not detected.
    if (mediaFile.type && !isAllowedType(mediaFile.type)) {
      triggerError({
        code: "MIME_TYPE_NOT_SUPPORTED",
        message: __("Sorry, this file type is not supported here."),
        file: mediaFile,
      })
      continue
    }

    // verify if file is greater than the maximum file upload size allowed for the site.
    if (maxUploadFileSize && mediaFile.size > maxUploadFileSize) {
      triggerError({
        code: "SIZE_ABOVE_LIMIT",
        message: __("This file exceeds the maximum upload size for this site."),
        file: mediaFile,
      })
      continue
    }

    // Don't allow empty files to be uploaded.
    if (mediaFile.size <= 0) {
      triggerError({
        code: "EMPTY_FILE",
        message: __("This file is empty."),
        file: mediaFile,
      })
      continue
    }

    validFiles.push(mediaFile)

    // Set temporary URL to create placeholder media file, this is replaced
    // with final file from media gallery when upload is `done` below
    filesSet.push({ url: createBlobURL(mediaFile) })
    onFileChange(filesSet)
  }

  for (let idx = 0; idx < validFiles.length; ++idx) {
    const mediaFile = validFiles[idx]
    try {
      const savedMedia = await createMediaFromFile(mediaFile, additionalData, pageId)
      const mediaObject = {
        alt: savedMedia.alt,
        caption: savedMedia.caption,
        title: savedMedia.title,
        url: savedMedia.url,
      }
      setAndUpdateFiles(idx, mediaObject)
    } catch (error) {
      console.log(error)
      // Reset to empty on failure.
      setAndUpdateFiles(idx, null)
      let message
      if (has(error, ["message"])) {
        message = get(error, ["message"])
      } else {
        message = sprintf(
          // translators: %s: file name
          __("Error while uploading file %s to the media library."),
          mediaFile.name,
        )
      }
      triggerError({
        code: "GENERAL",
        message,
        file: mediaFile,
      })
    }
  }
}

/**
 * @param {File}    file           Media File to Save.
 * @param {?Object} additionalData Additional data to include in the request.
 *
 * @return {Promise} Media Object Promise.
 */
function createMediaFromFile(
  file: File,
  // We shall not fight against Gutenberg any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additionalData: Record<string, any>,
  pageId: string,
): Promise<MediaItem> {
  // Create upload payload
  const data = new window.FormData()
  data.append("file", file, file.name || file.type.replace("/", "."))
  forEach(additionalData, (value, key) => data.append(key, value))
  return uploadFile({ uploadData: data, pageId })
}
