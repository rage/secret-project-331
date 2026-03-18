"use client"

import { css } from "@emotion/css"
import { ReactNode } from "react"
import { useTranslation } from "react-i18next"

interface ChatbotAgreeProps {
  agreeButton?: ReactNode
  hideHeader?: boolean
}

const ChatbotAgree: React.FC<ChatbotAgreeProps> = ({ agreeButton, hideHeader = false }) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        padding: 20px;
        overflow: hidden;

        h2 {
          font-size: 24px;
          margin-bottom: 10px;
        }

        p {
          margin-bottom: 5px;
        }

        ul {
          margin-bottom: 10px;
          padding-left: 20px;
        }

        li {
          margin-bottom: 5px;
        }
      `}
    >
      <div
        className={css`
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          overflow: scroll;
        `}
      >
        {!hideHeader && <h2>{t("about-the-chatbot")}</h2>}
        <p>{t("chatbot-disclaimer-start")}</p>
        <ul>
          <li>{t("chatbot-discalimer-sensitive-information")}</li>
          <li>{t("chatbot-disclaimer-check")}</li>
          <li>
            {t("chatbot-disclaimer-disclose-part-1")}
            <a href="https://studies.helsinki.fi/instructions/article/using-ai-support-learning">
              {" "}
              {t("chatbot-disclaimer-disclose-part-2")}
            </a>
            .{" "}
          </li>
        </ul>
      </div>
      {agreeButton}
    </div>
  )
}

export default ChatbotAgree
