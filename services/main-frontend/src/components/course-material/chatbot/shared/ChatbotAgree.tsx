"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { MessageAction } from "./hooks/useChatbotStateAndData"

import Button from "@/shared-module/common/components/Button"

interface ChatbotAgreeProps {
  newConversation: () => void
  dispatch: (action: MessageAction) => void
}

const ChatbotAgree: React.FC<ChatbotAgreeProps> = ({ newConversation, dispatch }) => {
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
        <h2>{t("about-the-chatbot")}</h2>
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
      <Button
        className={css`
          margin-top: 6px;
        `}
        size="medium"
        variant="secondary"
        onClick={() => {
          newConversation()
          dispatch({ type: "RESET_MESSAGES" })
        }}
      >
        {t("button-text-agree")}
      </Button>
    </div>
  )
}

export default ChatbotAgree
