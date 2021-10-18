import { css } from "@emotion/css"

import { BlockRendererProps } from "../../.."
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"
import { ImageAttributes } from "../../../../../types/GutenbergBlockAttributes"

const ImageBlock: React.FC<BlockRendererProps<ImageAttributes>> = ({ data }) => {
  const {
    alt,
    // blurDataUrl,
    linkDestination, // is custom if image link defined manually, can send user out from our web page
    // align,
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
    <figure
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
      {...(anchor && { id: anchor })}
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
        `}
      >
        {caption}
      </figcaption>
    </figure>
  )
}

export default ImageBlock
