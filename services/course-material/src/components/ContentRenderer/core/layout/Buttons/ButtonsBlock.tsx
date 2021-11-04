import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../../.."
import {
  ButtonAttributes,
  ButtonsAttributes,
} from "../../../../../../types/GutenbergBlockAttributes"
import Button from "../../../../../shared-module/components/Button"
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"
import colorMapper from "../../../../../styles/colorMapper"
import fontSizeMapper from "../../../../../styles/fontSizeMapper"

const ButtonsBlock: React.FC<BlockRendererProps<ButtonsAttributes>> = ({ data }) => {
  const { t } = useTranslation()
  const { orientation, anchor, contentJustification } = data.attributes

  const getContentJustification = (contentJustification: string) => {
    if (contentJustification === "center") {
      return "justify-content: center; align-items: center;"
    } else if (contentJustification === "right") {
      return "justify-content: flex-end; align-items: flex-end;"
    } else if (contentJustification === "space-between") {
      return "justify-content: space-between;"
    } else {
      return "justify-content: flex-start; align-items: flex-start;"
    }
  }

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

    const ENSURE_REL_NO_OPENER_IF_TARGET_BLANK =
      linkTarget && linkTarget.includes("_blank")
        ? rel && !rel.includes("noopener")
          ? rel.split(" ").join(" ").concat(" noopener")
          : "noopener"
        : rel

    return (
      <a
        key={button.clientId}
        rel={ENSURE_REL_NO_OPENER_IF_TARGET_BLANK}
        href={url}
        target={linkTarget}
        className={css`
          ${width && `width: ${width}%;`}
        `}
      >
        <Button
          className={css`
            ${backgroundColor && `background: ${colorMapper(backgroundColor)} !important;`}
            ${gradient && `background: ${colorMapper(gradient)} !important;`}
            ${textColor &&
            `color: ${colorMapper(textColor)} !important; border-color: ${colorMapper(
              textColor,
            )} !important;`}
            ${fontSize && `font-size: ${fontSizeMapper(fontSize)} !important;`}
            ${width && `width: calc(100% - ${1 - width / 100}rem);`}
            margin: 0.5rem 0rem;
            margin-right: 0.5rem;
          `}
          variant="primary"
          size="medium"
          {...(anchor && { id: anchor })}
          dangerouslySetInnerHTML={{ __html: text ?? placeholder ?? "BUTTON" }}
        />
        {linkTarget && linkTarget.includes("_blank") && (
          <span className="screen-reader-only">{t("screen-reader-opens-in-new-tab")}</span>
        )}
      </a>
    )
  })
  return (
    <div
      className={css`
        ${courseMaterialCenteredComponentStyles}
        display: flex;
        flex-wrap: wrap;
        ${orientation === "vertical" ? "flex-direction: column;" : "flex-direction: row;"}
        ${contentJustification && getContentJustification(contentJustification)}
      `}
      {...(anchor && { id: anchor })}
    >
      {mappedButtons}
    </div>
  )
}

export default ButtonsBlock
