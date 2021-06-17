/* eslint-disable eslint-custom-rules/ban-ts-ignore-without-comment */
/**
 * External dependencies
 */
import { noop } from "lodash"
import classnames from "classnames"

/**
 * WordPress dependencies
 */
import { Button, FormFileUpload, Placeholder, DropZone, Dashicon } from "@wordpress/components"
import { __ } from "@wordpress/i18n"
import { useState, useEffect } from "@wordpress/element"
import { useSelect } from "@wordpress/data"
import deprecated from "@wordpress/deprecated"
import { keyboardReturn } from "@wordpress/icons"

/**
 * Internal dependencies
 */
import { MediaUpload } from "@wordpress/block-editor"
import { MediaUploadCheck } from "@wordpress/block-editor"
import { URLPopover } from "@wordpress/block-editor"
import { EditorBlockListSettings, EditorSettings } from "@wordpress/block-editor"
import { MediaUploadProps } from "../../services/backend/media/mediaUpload"
import { MouseEventHandler } from "react"
import { UploadMediaErrorCode } from "@wordpress/media-utils"

const InsertFromURLPopover = ({ src, onChange, onSubmit, onClose }) => (
  // @ts-ignore
  <URLPopover onClose={onClose}>
    <form className="block-editor-media-placeholder__url-input-form" onSubmit={onSubmit}>
      <input
        className="block-editor-media-placeholder__url-input-field"
        type="url"
        aria-label={__("URL")}
        placeholder={__("Paste or type URL")}
        onChange={onChange}
        value={src}
      />
      <Button
        className="block-editor-media-placeholder__url-input-submit-button"
        icon={keyboardReturn}
        label={__("Apply")}
        type="submit"
      />
    </form>
  </URLPopover>
)

interface MediaPlaceholderProps extends Pick<DropZone.Props, "onHTMLDrop"> {
  value: Record<string, never>
  multiple: boolean
  labels: { title?: string; instructions?: string }
  allowedTypes?: string[]
  className?: string
  icon?: Dashicon.Icon | JSX.Element
  mediaPreview?: JSX.Element
  notices?: JSX.Element
  isAppender?: boolean
  accept?: string
  addToGallery?: boolean
  dropZoneUIOnly?: boolean
  disableDropZone?: boolean
  disableMediaButtons?: boolean
  onError: (error: { code: UploadMediaErrorCode; message: string; file: File }) => void
  onSelect(
    value:
      | Array<{ id: number } & { [k: string]: never }>
      | ({ id: number } & { [k: string]: never }),
  ): void
  onCancel?(): void
  onSelectURL?(src: string): void
  onDoubleClick?: MouseEventHandler<HTMLDivElement>
  onFilesPreUpload?(files: unknown): void
  children?: never
}

function ReplaceMediaPlaceholder({
  value = {},
  allowedTypes,
  className,
  icon,
  labels = {},
  mediaPreview,
  notices,
  isAppender,
  accept,
  addToGallery,
  multiple = false,
  dropZoneUIOnly,
  disableDropZone,
  disableMediaButtons,
  onError,
  onSelect,
  onCancel,
  onSelectURL,
  onDoubleClick,
  onHTMLDrop = noop,
  onFilesPreUpload = noop,
  children,
}: MediaPlaceholderProps): JSX.Element {
  const mediaUpload = useSelect((select) => {
    const settings = select("core/block-editor").getSettings() as Partial<
      EditorSettings & EditorBlockListSettings & { mediaUpload: (props: MediaUploadProps) => void }
    >
    return settings.mediaUpload
  }, [])
  const [src, setSrc] = useState("")
  const [isURLInputVisible, setIsURLInputVisible] = useState(false)

  useEffect(() => {
    setSrc(value?.src ?? "")
  }, [value?.src])

  const onlyAllowsImages = () => {
    if (!allowedTypes || allowedTypes.length === 0) {
      return false
    }

    return allowedTypes.every(
      (allowedType) => allowedType === "image" || allowedType.startsWith("image/"),
    )
  }

  const onChangeSrc = (event) => {
    setSrc(event.target.value)
  }

  const openURLInput = () => {
    setIsURLInputVisible(true)
  }
  const closeURLInput = () => {
    setIsURLInputVisible(false)
  }

  const onSubmitSrc = (event) => {
    event.preventDefault()
    if (src && onSelectURL) {
      onSelectURL(src)
      closeURLInput()
    }
  }

  const onFilesUpload = (files) => {
    onFilesPreUpload(files)
    let setMedia
    if (multiple) {
      if (addToGallery) {
        // Since the setMedia function runs multiple times per upload group
        // and is passed newMedia containing every item in its group each time, we must
        // filter out whatever this upload group had previously returned to the
        // gallery before adding and returning the image array with replacement newMedia
        // values.

        // Define an array to store urls from newMedia between subsequent function calls.
        let lastMediaPassed = []
        setMedia = (newMedia) => {
          // Remove any images this upload group is responsible for (lastMediaPassed).
          // Their replacements are contained in newMedia.
          const filteredMedia = (value ?? []).filter((item) => {
            // If Item has id, only remove it if lastMediaPassed has an item with that id.
            if (item.id) {
              return !lastMediaPassed.some(
                // Be sure to convert to number for comparison.
                ({ id }) => Number(id) === Number(item.id),
              )
            }
            // Compare transient images via .includes since gallery may append extra info onto the url.
            return !lastMediaPassed.some(({ urlSlug }) => item.url.includes(urlSlug))
          })
          // Return the filtered media array along with newMedia.
          onSelect(filteredMedia.concat(newMedia))
          // Reset lastMediaPassed and set it with ids and urls from newMedia.
          lastMediaPassed = newMedia.map((media) => {
            // Add everything up to '.fileType' to compare via .includes.
            const cutOffIndex = media.url.lastIndexOf(".")
            const urlSlug = media.url.slice(0, cutOffIndex)
            return { id: media.id, urlSlug }
          })
        }
      } else {
        setMedia = onSelect
      }
    } else {
      setMedia = ([media]) => onSelect(media)
    }
    mediaUpload({
      allowedTypes,
      filesList: files,
      onFileChange: setMedia,
      onError,
    })
  }

  const onUpload = (event) => {
    onFilesUpload(event.target.files)
  }

  const renderPlaceholder = (content, onClick?) => {
    let { instructions, title } = labels

    if (!mediaUpload && !onSelectURL) {
      instructions = __("To edit this block, you need permission to upload media.")
    }

    if (instructions === undefined || title === undefined) {
      const typesAllowed = allowedTypes ?? []

      const [firstAllowedType] = typesAllowed
      const isOneType = 1 === typesAllowed.length
      const isAudio = isOneType && "audio" === firstAllowedType
      const isImage = isOneType && "image" === firstAllowedType
      const isVideo = isOneType && "video" === firstAllowedType

      if (instructions === undefined && mediaUpload) {
        instructions = __("Upload a media file or pick one from your media library.")

        if (isAudio) {
          instructions = __(
            "Upload an audio file, pick one from your media library, or add one with a URL.",
          )
        } else if (isImage) {
          instructions = __(
            "Upload an image file, pick one from your media library, or add one with a URL.",
          )
        } else if (isVideo) {
          instructions = __(
            "Upload a video file, pick one from your media library, or add one with a URL.",
          )
        }
      }

      if (title === undefined) {
        title = __("Media")

        if (isAudio) {
          title = __("Audio")
        } else if (isImage) {
          title = __("Image")
        } else if (isVideo) {
          title = __("Video")
        }
      }
    }

    const placeholderClassName = classnames("block-editor-media-placeholder", className, {
      "is-appender": isAppender,
    })

    return (
      <Placeholder
        icon={icon}
        label={title}
        instructions={instructions}
        className={placeholderClassName}
        notices={notices}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        preview={mediaPreview}
      >
        {content}
        {children}
      </Placeholder>
    )
  }

  const renderDropZone = () => {
    if (disableDropZone) {
      return null
    }

    return <DropZone onFilesDrop={onFilesUpload} onHTMLDrop={onHTMLDrop} />
  }

  const renderCancelLink = () => {
    return (
      onCancel && (
        <Button
          className="block-editor-media-placeholder__cancel-button"
          title={__("Cancel")}
          isLink={true}
          onClick={onCancel}
        >
          {__("Cancel")}
        </Button>
      )
    )
  }

  const renderUrlSelectionUI = () => {
    return (
      onSelectURL && (
        <div className="block-editor-media-placeholder__url-input-container">
          <Button
            className="block-editor-media-placeholder__button"
            onClick={openURLInput}
            isPressed={isURLInputVisible}
            isTertiary
          >
            {__("Insert from URL")}
          </Button>
          {isURLInputVisible && (
            <InsertFromURLPopover
              src={src}
              onChange={onChangeSrc}
              onSubmit={onSubmitSrc}
              onClose={closeURLInput}
            />
          )}
        </div>
      )
    )
  }

  const renderMediaUploadChecked = () => {
    const mediaLibraryButton = (
      // @ts-ignore
      <MediaUpload
        addToGallery={addToGallery}
        gallery={multiple && onlyAllowsImages()}
        multiple={multiple}
        onSelect={onSelect}
        allowedTypes={allowedTypes}
        value={Array.isArray(value) ? value.map(({ id }) => id) : value.id}
        render={({ open }) => {
          return (
            <Button
              isTertiary
              onClick={(event) => {
                event.stopPropagation()
                open()
              }}
            >
              {__("Media Library")}
            </Button>
          )
        }}
      />
    )

    if (mediaUpload && isAppender) {
      return (
        <>
          {renderDropZone()}
          <FormFileUpload
            onChange={onUpload}
            accept={accept}
            multiple={multiple}
            render={({ openFileDialog }) => {
              const content = (
                <>
                  <Button
                    isPrimary
                    className={classnames(
                      "block-editor-media-placeholder__button",
                      "block-editor-media-placeholder__upload-button",
                    )}
                  >
                    {__("Upload")}
                  </Button>
                  {mediaLibraryButton}
                  {renderUrlSelectionUI()}
                  {renderCancelLink()}
                </>
              )
              return renderPlaceholder(content, openFileDialog)
            }}
          />
        </>
      )
    }

    if (mediaUpload) {
      const content = (
        <>
          {renderDropZone()}
          <FormFileUpload
            isPrimary
            className={classnames(
              "block-editor-media-placeholder__button",
              "block-editor-media-placeholder__upload-button",
            )}
            onChange={onUpload}
            accept={accept}
            multiple={multiple}
          >
            {__("Upload")}
          </FormFileUpload>
          {mediaLibraryButton}
          {renderUrlSelectionUI()}
          {renderCancelLink()}
        </>
      )
      return renderPlaceholder(content)
    }

    return renderPlaceholder(mediaLibraryButton)
  }

  if (dropZoneUIOnly || disableMediaButtons) {
    if (dropZoneUIOnly) {
      deprecated("wp.blockEditor.MediaPlaceholder dropZoneUIOnly prop", {
        since: "5.4",
        alternative: "disableMediaButtons",
      })
    }
    // @ts-ignore
    return <MediaUploadCheck>{renderDropZone()}</MediaUploadCheck>
  }

  return (
    // @ts-ignore
    <MediaUploadCheck fallback={renderPlaceholder(renderUrlSelectionUI())}>
      {renderMediaUploadChecked()}
    </MediaUploadCheck>
  )
}

export const replaceMediaPlaceholder = (): ((props: MediaPlaceholderProps) => JSX.Element) => {
  return ReplaceMediaPlaceholder
}
