import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from "../.."
import { SeparatorAttributes } from "../../../../../types/GutenbergBlockAttributes"
import colorMapper from "../../../../styles/colorMapper"

const SeparatorBlock: React.FC<BlockRendererProps<SeparatorAttributes>> = ({ data }) => {
  const { anchor, className, color } = data.attributes
  return (
    <div>
      <hr
        className={css`
          ${color && `background-color: ${colorMapper(color)};`}
          ${color && `color: ${colorMapper(color)};`}
          ${
            (!className || className === "is-style-default") &&
            "width: 6.25rem; text-align: center;" /* Is not style-wide or dots */
          }
          ${className &&
          className.includes("is-style-dots") &&
          `
            border: none;
            background: none !important;
            font-size: 1.5rem;
            text-align: center;
            ::before {
              content: '···';
              padding-left: 2rem;
              letter-spacing: 2rem;
            }`}
        `}
        {...(anchor && { id: anchor })}
      />
    </div>
  )
}

export default SeparatorBlock
