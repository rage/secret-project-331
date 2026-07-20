"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useRef, useState } from "react"
import Zoom from "react-medium-image-zoom"

import type { ImageAttributes } from "@/../types/GutenbergBlockAttributes"
import ParsedText from "@/components/course-material/ParsedText"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from "../../.."
import { OpensInNewTabNotice, relForLinkTarget } from "../../../util/links"
import { useImageInteractivity } from "./ImageInteractivityContext"

interface ExtraAttributes {
  align?: string
}

const StyledZoomWrapper = styled.div`
  [data-rmiz-ghost] {
    display: none;
  }
`

const normalizeCssSize = (value: number | string | undefined): string | undefined => {
  // Treat an empty string the same as "unset" because some images from material migration have
  // width="" / height="", which would lead to invalid CSS (`width: ;`)
  if (value === undefined || value === null || value === "") {
    return undefined
  }
  if (typeof value === "number") {
    // oxlint-disable-next-line i18next/no-literal-string
    return `${value}px`
  }
  // oxlint-disable-next-line i18next/no-literal-string
  return /^\d+$/.test(value) ? `${value}px` : value
}

/** Strips HTML tags from a rich-text caption to get a plain-text fallback label. */
const stripTags = (html: string): string => html.replaceAll(/<[^>]*>/g, "").trim()

const ImageBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ImageAttributes & ExtraAttributes>>
> = ({ data }) => {
  const { disableInteractivity } = useImageInteractivity()
  const imageRef = useRef<HTMLImageElement>(null)
  // SVGs without intrinsic dimensions (only a viewBox, or width/height="100%") report naturalWidth
  // 0 and collapse to nothing inside the shrink-wrapped containers below. We fall back to the
  // column width on load. It must be a concrete pixel value; a percentage would collapse too.
  const [fallbackWidthPx, setFallbackWidthPx] = useState<number | null>(null)
  const {
    alt,
    isDecorative,
    align,
    caption,
    className,
    height,
    href,
    rel,
    linkDestination,
    linkTarget,
    title,
    url,
    width,
    aspectRatio,
    scale,
    focalPoint,
  } = data.attributes

  const isRounded = Boolean(className?.includes("is-style-rounded"))

  // Gutenberg links the image when a destination is set (custom URL, the media file, etc.). The
  // image must then be wrapped in an anchor; otherwise the `href` is silently dropped.
  const hasLink = Boolean(href) && linkDestination !== "none"
  const linkRel = relForLinkTarget(rel, linkTarget)
  // Fallback accessible name for a linked image with no alt text (used by the link below).
  const captionText = caption ? stripTags(caption) : undefined
  const linkFallbackName = captionText || title || href

  const focalPointPos =
    focalPoint && typeof focalPoint.x === "number" && typeof focalPoint.y === "number"
      ? `${focalPoint.x * 100}% ${focalPoint.y * 100}%`
      : undefined

  // Only use the fallback when no explicit width was given.
  const fallbackWidth =
    fallbackWidthPx !== null && normalizeCssSize(width) === undefined
      ? // oxlint-disable-next-line i18next/no-literal-string
        `${fallbackWidthPx}px`
      : undefined

  // oxlint-disable-next-line i18next/no-literal-string
  const imageWidthCss = normalizeCssSize(width) ?? fallbackWidth ?? "auto"
  // Constrain a floated figure to the image's width, else a caption wider than the image flows
  // beside the float instead of stacking under it.
  // oxlint-disable-next-line i18next/no-literal-string
  const floatWidthCss = imageWidthCss === "auto" ? "fit-content" : imageWidthCss
  const isFloated = align === "left" || align === "right"
  // oxlint-disable-next-line i18next/no-literal-string
  const wrapperWidthCss = isFloated ? floatWidthCss : "fit-content"

  // Width can shrink to the container (max-width: 100%), so height follows via aspect-ratio, not a
  // fixed px height that would distort on narrow screens. Cropped images (object-fit via `scale`)
  // pin the crop-box ratio (Gutenberg's aspectRatio, else author's width:height); uncropped keep
  // their intrinsic ratio with height: auto.
  // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseFloat intended; Number() differs
  const widthNumber = typeof width === "number" ? width : parseFloat(width ?? "")
  // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseFloat intended; Number() differs
  const heightNumber = typeof height === "number" ? height : parseFloat(height ?? "")
  const gutenbergAspectRatio = aspectRatio && aspectRatio !== "auto" ? aspectRatio : undefined
  const cropAspectRatio =
    scale && Number.isFinite(widthNumber) && Number.isFinite(heightNumber)
      ? `${widthNumber} / ${heightNumber}`
      : undefined
  const effectiveAspectRatio = gutenbergAspectRatio ?? cropAspectRatio

  const handleImageLoad = () => {
    const image = imageRef.current
    if (image && image.naturalWidth === 0) {
      // The full-width block wrapper's clientWidth is the content/column width available here.
      const blockWrapper = image.closest("[data-block-name]")
      const wrapperWidth = blockWrapper?.clientWidth ?? 0
      setFallbackWidthPx(wrapperWidth > 0 ? wrapperWidth : 700)
    }
  }

  const renderImage = () => {
    const image = (
      <img
        ref={imageRef}
        title={title}
        onLoad={handleImageLoad}
        className={css`
          width: ${imageWidthCss};
          max-width: 100%;
          height: auto;
          margin: 1rem 0;
          ${isRounded && `border-radius: 9999px;`}
          ${scale && `object-fit: ${scale};`}
          ${effectiveAspectRatio && `aspect-ratio: ${effectiveAspectRatio};`}
          ${focalPointPos && `object-position: ${focalPointPos};`}
        `}
        src={url}
        alt={isDecorative ? "" : alt}
      />
    )
    if (!hasLink) {
      return image
    }
    // The link's accessible name comes from the image's alt; when that's empty we supply a name with
    // visually-hidden text, and append the "opens in a new tab" hint inside the link so it's part of
    // the announced name rather than detached sibling text.
    return (
      <a href={href} target={linkTarget} rel={linkRel}>
        {image}
        {!alt && <span className="screen-reader-only">{linkFallbackName}</span>}
        <OpensInNewTabNotice linkTarget={linkTarget} />
      </a>
    )
  }

  const imageContent = (
    <div
      className={css`
        width: ${wrapperWidthCss};
        ${(align === "center" || align === undefined) &&
        `margin-left: auto;
        margin-right: auto;
        text-align: center;`}
        ${align === "right" &&
        `
        float: right;
        margin-left: 1rem;`}
        ${align === "left" &&
        `
        float: left;
        margin-right: 1em;`}
      `}
    >
      <figure
        className={css`
          ${align === "center" && `text-align: center;display: table;  margin: 0 auto;`}
          ${align !== "center" &&
          `margin-top: 3rem;
        margin-bottom: 3rem;`}
        `}
      >
        <div
          className={css`
            ${align && "display: inline-block;"}
          `}
        >
          {disableInteractivity ? renderImage() : <>{renderImage()}</>}
        </div>
      </figure>
      <ParsedText
        text={caption ?? ""}
        tag="figcaption"
        tagProps={{
          className: css`
            caption-side: bottom;
            text-align: center;
            font-size: 0.8125rem;
            margin-top: 0.5rem;
            margin-bottom: 0.8125rem;
          `,
        }}
        useWrapperElement={true}
      />
    </div>
  )

  // A linked image should navigate on click, so it must not be wrapped in the zoom interaction.
  return disableInteractivity || hasLink ? (
    imageContent
  ) : (
    <StyledZoomWrapper>
      <Zoom>{imageContent}</Zoom>
    </StyledZoomWrapper>
  )
}

export default withErrorBoundary(ImageBlock)
