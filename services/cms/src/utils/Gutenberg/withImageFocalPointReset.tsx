"use client"

import { createHigherOrderComponent } from "@wordpress/compose"
import { useEffect, useState } from "@wordpress/element"

const IMAGE_BLOCK_NAME = "core/image"

interface ImageEditProps {
  name: string
  attributes: {
    url?: string
    width?: string | number
    height?: string | number
    scale?: string
    aspectRatio?: string
    focalPoint?: { x: number; y: number }
    [key: string]: unknown
  }
  setAttributes: (attributes: Record<string, unknown>) => void
  [key: string]: unknown
}

/** Parses a Gutenberg dimension value (e.g. "200px" or 200) into pixels, or undefined for auto. */
const toPx = (value: string | number | undefined): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined
  }
  // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseFloat intended; Number() differs
  const parsed = typeof value === "number" ? value : parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Gutenberg shows the "Focal point" control whenever `scale` (object-fit) is set, and keeps `scale`
 * even after the width/height that introduced it are cleared — leaving the control visible when the
 * image isn't cropped. This HOC clears `scale` and `focalPoint` when there is no crop: a dimension
 * is back to auto, or the box matches the image's aspect ratio.
 */
const withImageFocalPointReset = createHigherOrderComponent((BlockEdit) => {
  const ImageFocalPointReset = (props: ImageEditProps) => {
    const { name, attributes, setAttributes } = props
    const url = attributes?.url
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)

    // Measure the image's natural size so we can tell whether the chosen dimensions crop it.
    useEffect(() => {
      if (name !== IMAGE_BLOCK_NAME || !url || !attributes.scale) {
        return
      }
      let cancelled = false
      const image = new Image()
      // oxlint-disable-next-line unicorn/prefer-add-event-listener -- Image onload intentional property-handler
      image.onload = () => {
        if (!cancelled) {
          setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight })
        }
      }
      image.src = url
      return () => {
        cancelled = true
      }
    }, [name, url, attributes.scale])

    useEffect(() => {
      if (name !== IMAGE_BLOCK_NAME || !attributes.scale) {
        return
      }
      // An aspect ratio is its own crop independent of width/height, so the focal point stays relevant.
      if (attributes.aspectRatio && attributes.aspectRatio !== "auto") {
        return
      }
      const width = toPx(attributes.width)
      const height = toPx(attributes.height)
      // Cropping (object-fit) requires both dimensions; with one auto the aspect ratio is preserved.
      const missingDimension = width === undefined || height === undefined
      // With both dimensions set, object-fit: cover crops only when the box aspect ratio differs
      // from the image's natural one (size alone doesn't matter). Small tolerance for px rounding.
      const matchesNaturalAspectRatio =
        naturalSize !== null &&
        naturalSize.width > 0 &&
        naturalSize.height > 0 &&
        width !== undefined &&
        height !== undefined &&
        Math.abs(width / height - naturalSize.width / naturalSize.height) <=
          (naturalSize.width / naturalSize.height) * 0.02
      if (missingDimension || matchesNaturalAspectRatio) {
        setAttributes({ scale: undefined, focalPoint: undefined })
      }
    }, [
      name,
      attributes.scale,
      attributes.aspectRatio,
      attributes.width,
      attributes.height,
      naturalSize,
      setAttributes,
    ])

    return <BlockEdit {...props} />
  }

  ImageFocalPointReset.displayName = "ImageFocalPointReset"
  return ImageFocalPointReset
  // oxlint-disable-next-line i18next/no-literal-string
}, "withImageFocalPointReset")

export default withImageFocalPointReset
