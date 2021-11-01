import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../../.."
import { ImageAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"
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
    linkTarget && linkTarget.includes("blank")
      ? rel && !rel.includes("noopener")
        ? rel.split(" ").join(" ").concat(" noopener")
        : "noopener"
      : rel

  return (
    <div
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      <figure
        className={css`
          ${align === "center" && `text-align: center; display: table; margin: 0 auto;`}
          ${align !== "center" &&
          `float: ${align};
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          ${align === "right" ? "margin-left: 1rem;" : "margin-right: 1rem;"}
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
                ${className === "is-style-rounded" && "border-radius: 9999px"}
              `}
              src={url}
              alt={alt}
            />
            {linkTarget === "_blank" && (
              <span className="screen-reader-only">{t("screen-reader-opens-in-new-tab")}</span>
            )}
          </a>
          <figcaption
            className={css`
              text-align: center;
              font-size: 0.8125rem;
              margin-top: 0.40625rem;
              margin-bottom: 0.8125rem;
            `}
            dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(caption ?? "") }}
          />
        </div>
      </figure>
    </div>
  )
}

export default ImageBlock
