import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"
import Zoom from "react-medium-image-zoom"

import { BlockRendererProps } from "../../.."
import { ImageAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

const ImageBlock: React.FC<BlockRendererProps<ImageAttributes>> = ({ data }) => {
  const { t } = useTranslation()
  const {
    alt,
    // blurDataUrl,
    // linkDestination, // is custom if image link defined manually, can send user out from our web page
    align,
    anchor,
    caption,
    className,
    height,
    href,
    linkClass,
    linkTarget,
    rel,
    // sizeSlug,
    title,
    url,
    width,
  } = data.attributes

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
      `}
    >
      {/* eslint-disable-next-line i18next/no-literal-string*/}
      <Zoom wrapStyle={{ display: "block" }}>
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
          {...(anchor && { id: anchor })}
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
                  ${className === "is-style-rounded" && "border-radius: 9999px"}
                `}
                src={url}
                alt={alt}
              />
              {linkTarget && linkTarget.includes("_blank") && (
                <span className="screen-reader-only">{t("screen-reader-opens-in-new-tab")}</span>
              )}
            </a>
          </div>
          <figcaption
            className={css`
              caption-side: bottom;
              text-align: center;
              font-size: 0.8125rem;
              margin-top: 0.5rem;
              margin-bottom: 0.8125rem;
            `}
            dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(caption ?? "") }}
          />
        </figure>
      </Zoom>
    </div>
  )
}

export default ImageBlock
