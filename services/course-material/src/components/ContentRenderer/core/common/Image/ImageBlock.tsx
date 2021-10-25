import { css } from "@emotion/css"

import { BlockRendererProps } from "../../.."
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"
import { ImageAttributes } from "../../../../../types/GutenbergBlockAttributes"

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
    // linkClass,
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
        `This image link will take you to:\n${href}\n\nAre you sure you want to continue?`,
      )
    }
    return true
  }

  return (
    // TODO: Should image be full width blockerino in course material and CMS
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
            target={linkTarget ?? "_blank"}
            rel={rel ?? "noreferrer"}
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
