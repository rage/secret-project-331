import { css } from "@emotion/css"
import { useContext } from "react"
import { useTranslation } from "react-i18next"
import Zoom from "react-medium-image-zoom"

import { BlockRendererProps } from "../../.."
import { ImageAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import { parseText } from "../../../util/textParsing"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface ExtraAttributes {
  align?: string
}

const ImageBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ImageAttributes & ExtraAttributes>>
> = ({ data }) => {
  const { t } = useTranslation()
  const {
    alt,
    // blurDataUrl,
    // linkDestination, // is custom if image link defined manually, can send user out from our web page
    align,
    caption,
    height,
    href,
    linkClass,
    linkTarget,
    rel,
    // sizeSlug,
    title,
    url,
    width,
    aspectRatio,
    scale,
  } = data.attributes

  const { terms } = useContext(GlossaryContext)

  const ENSURE_REL_NO_OPENER_IF_TARGET_BLANK =
    linkTarget && linkTarget.includes("_blank")
      ? rel && !rel.includes("noopener")
        ? rel.split(" ").join(" ").concat(" noopener")
        : "noopener"
      : rel
  return (
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

        [data-rmiz-ghost] {
          display: none;
        }
      `}
    >
      <Zoom>
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
            <a
              href={href}
              target={linkTarget}
              rel={ENSURE_REL_NO_OPENER_IF_TARGET_BLANK}
              className={linkClass}
            >
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
            </a>
          </div>
        </figure>
      </Zoom>
      <figcaption
        className={css`
          caption-side: bottom;
          text-align: center;
          font-size: 0.8125rem;
          margin-top: 0.5rem;
          margin-bottom: 0.8125rem;
        `}
        dangerouslySetInnerHTML={{
          __html: parseText(caption ?? "", terms).parsedText,
        }}
      />
    </div>
  )
}

export default withErrorBoundary(ImageBlock)
