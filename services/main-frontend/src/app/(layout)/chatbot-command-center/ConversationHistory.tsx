"use client"

import { css } from "@emotion/css"
import type { OverlayTriggerState } from "@react-stately/overlays"
import type React from "react"
import { useTranslation } from "react-i18next"

import { useChatbotContext } from "@/components/course-material/chatbot/shared/ChatbotContext"
import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { SIDEBAR_WIDTH_PX } from "@/shared-module/common/utils/constants"
import { Infobox } from "@/shared-module/components"

interface ConversationHistoryProps {
  conversations: ChatbotConversation[]
  chatbots: ChatbotConfiguration[]
  menuState?: OverlayTriggerState
  setConfigurationId: React.Dispatch<string>
}

const chatbotLabelCss = css`
  padding: 5px 8px;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  max-width: calc(${SIDEBAR_WIDTH_PX} - 2.1rem);
  text-overflow: ellipsis;
  text-align: left;
  border: 1px solid ${baseTheme.colors.green[300]};
  border-radius: 999px;
  color: ${baseTheme.colors.gray[400]};
`

const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  conversations,
  chatbots,
  menuState,
  setConfigurationId,
}) => {
  const { t } = useTranslation()
  const { setConvId, convId } = useChatbotContext()

  if (conversations.length === 0) {
    return (
      <div
        className={css`
          padding: 0 1rem;
          margin-top: 1rem;
        `}
      >
        <Infobox>{t("no-existing-conversations")}</Infobox>
      </div>
    )
  }

  return (
    <>
      {conversations.map((conversation) => (
        <button
          onClick={() => {
            setConfigurationId(conversation.chatbot_configuration_id)
            setConvId(conversation.id)
            if (menuState) {
              menuState.close()
            }
          }}
          className={css`
            padding: 0.5rem 1rem;
            border: none;
            width: calc(100%);
            justify-content: flex-start;
            border-bottom: 1px solid ${baseTheme.colors.gray[75]};
            transition: background-color 0.2s;

            &:hover:not(:disabled):not([aria-disabled="true"]) {
              background: var(--color-green-75);
              transition: 0.2s;
              cursor: pointer;
            }
            color: var(--field-fg);
            background-color: ${conversation.id === convId ? "var(--color-green-75); border: 1px solid var(--color-green-300); box-shadow: var(--btn-icon-shadow-hover);" : "transparent"};
          `}
          key={conversation.id}
          aria-label={t("conversation-title", {
            title: conversation.conversation_title ?? t("untitled-conversation"),
          })}
        >
          <div
            className={css`
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              font-size: 14px;
              font-weight: 500;
            `}
          >
            <div
              className={css`
                white-space: nowrap;
                max-width: calc(${SIDEBAR_WIDTH_PX} - 2.1rem);
                overflow: hidden;
                text-overflow: ellipsis;
                padding-bottom: 5px;
              `}
            >
              {conversation.conversation_title ?? t("untitled-conversation")}
            </div>
            <span className={chatbotLabelCss}>
              {
                chatbots.find((chatbot) => chatbot.id === conversation.chatbot_configuration_id)
                  ?.chatbot_name
              }
            </span>
          </div>
        </button>
      ))}
    </>
  )
}

export default ConversationHistory
