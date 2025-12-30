"use client"
import { css } from "@emotion/css"
import styled from "@emotion/styled"
import "react"
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

const ImageBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ImageAttributes & ExtraAttributes>>
> = ({ data }) => {
  const { t } = useTranslation()
  const { disableInteractivity } = useImageInteractivity()
  const {
    alt,
    // blurDataUrl,
    // linkDestination, // is custom if image link defined manually, can send user out from our web page
    align,
    caption,
    height,
    linkTarget,
    // sizeSlug,
    title,
    url,
    width,
    aspectRatio,
    scale,
  } = data.attributes

  const renderImage = () => (
    <>
      <img
        title={title}
        height={height}
        width={width}
        className={css`
          max-width: 100%;
          height: auto;
          margin: 1rem 0;
          ${scale && `transform: scale(${scale});`}
          ${aspectRatio && `aspect-ratio: ${aspectRatio};`}
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
        width: fit-content;
        ${(align === "center" || align === undefined) &&
        `margin-left: auto;
        margin-right: auto;
        text-align: center;`}
        ${align === "right" &&
        `
        float: ${align};`}
        ${align === "left" &&
        `
        float: ${align};
        margin-right: 1em;`}
      `}
    >
      <figure
        className={css`
          ${align === "center" && `text-align: center;display: table;  margin: 0 auto;`}
          ${align !== "center" &&
          `float: ${align};
        margin-top: 3rem;
        margin-bottom: 3rem;
        ${align === "right" && "margin-left: 1rem;"}
        ${align === "left" && "margin-right: 1rem;"}
        `}
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
