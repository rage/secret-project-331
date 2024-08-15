import { css } from "@emotion/css"
import { Conversation } from "@vectopus/atlas-icons-react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

interface OpenChatbotButtonProps {
  dialogOpen: boolean
  setDialogOpen: (dialogOpen: boolean) => void
}

const OpenChatbotButton: React.FC<OpenChatbotButtonProps> = ({ dialogOpen, setDialogOpen }) => {
  const { t } = useTranslation()

  return (
    <button
      className={css`
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
        background-color: ${baseTheme.colors.gray[300]};

        &:hover {
          background-color: ${baseTheme.colors.gray[400]};
        }
      `}
      aria-label={t("heading-chatbot")}
      onClick={() => setDialogOpen(!dialogOpen)}
    >
      <Conversation />
    </button>
  )
}

export default OpenChatbotButton
