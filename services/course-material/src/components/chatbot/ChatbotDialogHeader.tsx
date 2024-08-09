import { css } from "@emotion/css"
import { Account } from "@vectopus/atlas-icons-react"
import { useTranslation } from "react-i18next"

import { ChatbotDialogProps } from "./ChatbotDialog"

import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"

const ChatbotDialogHeader: React.FC<ChatbotDialogProps> = ({ setDialogOpen }) => {
  const { t } = useTranslation()

  return (
    <div
      className={css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px;
        background-color: ${baseTheme.colors.gray[100]};
        border-radius: 10px 10px 0px 0px;
      `}
    >
      <div
        className={css`
          background-color: ${baseTheme.colors.clear[200]};
          color: ${baseTheme.colors.gray[400]};
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0.5rem;
          border-radius: 50%;
        `}
      >
        <Account />
      </div>
      <div
        className={css`
          font-size: 18px;
          font-weight: 700;
        `}
      >
        {t("chatbot.title")}
      </div>
      <button
        onClick={() => setDialogOpen(false)}
        className={css`
          font-size: 20px;
          cursor: pointer;
          background-color: transparent;
          border-radius: 50%;
          border: none;
          color: ${baseTheme.colors.gray[400]};

          transition: filter 0.2s;

          &:hover {
            filter: brightness(0.7) contrast(1.1);
          }
        `}
        aria-label={t("close")}
      >
        <DownIcon />
      </button>
    </div>
  )
}

export default ChatbotDialogHeader
