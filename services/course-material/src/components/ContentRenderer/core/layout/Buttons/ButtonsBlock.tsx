import { css } from "@emotion/css"

import { BlockRendererProps } from "../../.."
import Button from "../../../../../shared-module/components/Button"
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"
import colorMapper from "../../../../../styles/colorMapper"
import fontSizeMapper from "../../../../../styles/fontSizeMapper"
import { ButtonAttributes, ButtonsAttributes } from "../../../../../types/GutenbergBlockAttributes"

const ButtonsBlock: React.FC<BlockRendererProps<ButtonsAttributes>> = ({ data }) => {
  // TODO: Fix align of button or figure out how it works
  const { orientation, /*align ,*/ anchor, contentJustification } = data.attributes

  const mappedButtons = data.innerBlocks.map((button) => {
    const {
      // align,
      anchor,
      backgroundColor,
      // className,
      fontSize,
      gradient,
      linkTarget,
      placeholder,
      rel,
      // style,
      text,
      textColor,
      // title
      url,
      width,
    } = button.attributes as ButtonAttributes

    const ensureRelNoOpenerIfTargetBlank =
      linkTarget && linkTarget.includes("blank")
        ? rel && !rel.includes("noopener")
          ? rel.split(" ").join(" ").concat(" noopener")
          : "noopener"
        : rel

    return (
      <a key={button.clientId} rel={ensureRelNoOpenerIfTargetBlank} href={url} target={linkTarget}>
        <Button
          className={css`
            ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
            ${gradient && `background: ${colorMapper(gradient)};`}
            ${textColor && `color: ${colorMapper(textColor)};`}
            ${fontSize && `background: ${fontSizeMapper(fontSize)};`}
            ${width && `width: ${width}%;`}
            margin: 0.5rem 0rem;
            margin-right: 0.5rem;
          `}
          variant="primary"
          size="medium"
          {...(anchor && { id: anchor })}
        >
          {text ?? placeholder ?? "BUTTON TEXT"}
        </Button>
      </a>
    )
  })
  return (
    <div
      className={css`
        ${courseMaterialCenteredComponentStyles}
        ${orientation === "vertical" && "flex-direction: column;"}
        ${contentJustification && `justify-content: ${contentJustification};`}
      `}
      {...(anchor && { id: anchor })}
    >
      {mappedButtons}
    </div>
  )
}

export default ButtonsBlock
