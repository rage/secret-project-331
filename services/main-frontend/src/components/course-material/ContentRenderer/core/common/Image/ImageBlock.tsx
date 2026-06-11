"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import Zoom from "react-medium-image-zoom"

import { BlockRendererProps } from "../../.."

import { useImageInteractivity } from "./ImageInteractivityContext"

import { ImageAttributes } from "@/../types/GutenbergBlockAttributes"
import ParsedText from "@/components/course-material/ParsedText"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface ExtraAttributes {
  align?: string
}

const StyledZoomWrapper = styled.div`
  [data-rmiz-ghost] {
    display: none;
  }
`

/* eslint-disable i18next/no-literal-string */
const normalizeCssSize = (value: number | string | undefined): string | undefined => {
  // Treat an empty string the same as "unset" because some images from material migration have
  // width="" / height="", which would lead to invalid CSS (`width: ;`)
  if (value === undefined || value === null || value === "") {
    return undefined
  }
  if (typeof value === "number") {
    return `${value}px`
  }
  return /^\d+$/.test(value) ? `${value}px` : value
}
/* eslint-enable i18next/no-literal-string */

const ImageBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ImageAttributes & ExtraAttributes>>
> = ({ data }) => {
  const { t } = useTranslation()
  const { disableInteractivity } = useImageInteractivity()
  const imageRef = useRef<HTMLImageElement>(null)
  // Some SVG images from material migration declare no intrinsic dimensions (only a viewBox, or
  // width/height="100%"). These images report naturalWidth 0 and collapse to nothing inside the
  // shrink-wrapped (floated / inline-block / fit-content) containers below, so they don't render at
  // all. When we detect that on load, we fall back to the content column width so the image becomes
  // visible. The fallback has to be a concrete pixel value: a percentage width would itself
  // collapse against the shrink-wrapping ancestors. Images that have real dimensions keep their
  // intrinsic / explicit size.
  const [fallbackWidthPx, setFallbackWidthPx] = useState<number | null>(null)
  const {
    alt,
    align,
    caption,
    height,
    linkTarget,
    title,
    url,
    width,
    aspectRatio,
    scale,
    focalPoint,
  } = data.attributes

  const focalPointPos =
    focalPoint && typeof focalPoint.x === "number" && typeof focalPoint.y === "number"
      ? `${focalPoint.x * 100}% ${focalPoint.y * 100}%`
      : undefined

  // Fall back to the measured column width only when the image collapsed for lack of intrinsic
  // dimensions and no explicit width was given.
  const fallbackWidth =
    fallbackWidthPx !== null && normalizeCssSize(width) === undefined
      ? // eslint-disable-next-line i18next/no-literal-string
        `${fallbackWidthPx}px`
      : undefined

  // eslint-disable-next-line i18next/no-literal-string
  const imageWidthCss = normalizeCssSize(width) ?? fallbackWidth ?? "auto"
  // For floated (left/right) images, constrain the whole figure to the image's width. Otherwise the
  // wrapper is sized to the caption's natural width, and a caption wider than the image leaves room
  // for it to flow *beside* the floated image instead of stacking underneath it.
  // eslint-disable-next-line i18next/no-literal-string
  const floatWidthCss = imageWidthCss === "auto" ? "fit-content" : imageWidthCss
  const isFloated = align === "left" || align === "right"
  // eslint-disable-next-line i18next/no-literal-string
  const wrapperWidthCss = isFloated ? floatWidthCss : "fit-content"

  const handleImageLoad = () => {
    const image = imageRef.current
    if (image && image.naturalWidth === 0) {
      const column = image.closest("[data-block-name]")
      const columnWidth = column?.clientWidth ?? 0
      setFallbackWidthPx(columnWidth > 0 ? columnWidth : 700)
    }
  }

  const renderImage = () => (
    <>
      <img
        ref={imageRef}
        title={title}
        onLoad={handleImageLoad}
        className={css`
          width: ${imageWidthCss};
          max-width: 100%;
          height: ${normalizeCssSize(height) ?? "auto"};
          margin: 1rem 0;
          ${scale && `transform: scale(${scale});`}
          ${aspectRatio && `aspect-ratio: ${aspectRatio};`}
          ${focalPointPos && `object-fit: cover; object-position: ${focalPointPos};`}
        `}
        src={url}
        alt={alt}
      />
      {linkTarget && linkTarget.includes("_blank") && (
        <span className="screen-reader-only">{t("screen-reader-opens-in-new-tab")}</span>
      )}
    </>
  )

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
        margin-left: 1em;`}
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

  return disableInteractivity ? (
    imageContent
  ) : (
    <StyledZoomWrapper>
      <Zoom>{imageContent}</Zoom>
    </StyledZoomWrapper>
  )
}

export default withErrorBoundary(ImageBlock)
