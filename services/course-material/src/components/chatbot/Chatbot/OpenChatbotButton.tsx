import { css } from "@emotion/css"
import React from "react"
import { Button } from "react-aria-components"
import { useTranslation } from "react-i18next"

import AIChat from "../../../img/ai-chat.svg"

import { baseTheme } from "@/shared-module/common/styles"

const buttonStyle = css`
  position: fixed;
  bottom: 62px;
  right: 14px;
  z-index: 1000;
  background: white;
  border-radius: 100px;
  width: 60px;
  height: 60px;
  cursor: pointer;
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  background-color: ${baseTheme.colors.green[300]};

  &:hover {
    background-color: ${baseTheme.colors.green[400]};
  }
`

const OpenChatbotButton = () => {
  const { t } = useTranslation()

  return (
    <Button className={buttonStyle} aria-label={t("open-chatbot")}>
      <AIChat
        className={css`
          position: relative;
          bottom: -1px;
          width: 35px;
          height: 35px;
        `}
      />
    </Button>
  )
}

export default React.memo(OpenChatbotButton)
