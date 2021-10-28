import { css } from "@emotion/css"

import { BlockRendererProps } from "../../.."
import { ImageAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"

const ImageBlock: React.FC<BlockRendererProps<ImageAttributes>> = ({ data }) => {
  const {
    alt,
    // blurDataUrl,
    linkDestination, // is custom if image link defined manually, can send user out from our web page
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

  const warnUserIfLinkCustom = () => {
    if (linkDestination === "custom") {
      return confirm(
        // eslint-disable-next-line i18next/no-literal-string
        `This image link will take you to:\n${href}\n\nAre you sure you want to continue?`,
      )
    }
    return true
  }

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
          ${align === "center" && `text-align: center; display: table;`}
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
            onClick={warnUserIfLinkCustom}
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
          </a>
          <figcaption
            className={css`
              text-align: center;
              font-size: 0.8125rem;
              margin-top: 0.40625rem;
              margin-bottom: 0.8125rem;
            `}
          >
            {caption}
          </figcaption>
        </div>
      </figure>
    </div>
  )
}

export default ImageBlock
