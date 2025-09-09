import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import AIChat from "../../../img/ai-chat.svg"

import { baseTheme } from "@/shared-module/common/styles"

interface OpenChatbotButtonProps {
  setDialogOpen: (dialogOpen: boolean) => void
}

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

const OpenChatbotButton: React.FC<OpenChatbotButtonProps> = ({ setDialogOpen }) => {
  const { t } = useTranslation()

  const handleClick = () => {
    setDialogOpen(true)
  }

  return (
    <button className={buttonStyle} aria-label={t("open-chatbot")} onClick={handleClick}>
      <AIChat
        className={css`
          width: 35px;
          height: 35px;
        `}
      />
    </button>
  )
}

export default React.memo(OpenChatbotButton)
