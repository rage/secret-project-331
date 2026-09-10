"use client"

import { css } from "@emotion/css"
import type { OverlayTriggerState } from "@react-stately/overlays"
import type React from "react"
import { useTranslation } from "react-i18next"

import { useChatbotContext } from "@/components/course-material/chatbot/shared/ChatbotContext"
import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, Infobox } from "@/shared-module/components"

interface ConversationHistoryProps {
  conversations: ChatbotConversation[]
  chatbots: ChatbotConfiguration[]
  menuState?: OverlayTriggerState
  setConfigurationId: React.Dispatch<string>
}

const buttonCss = css`
  width: calc(100%);
  justify-content: flex-start;
  border-top: 1px solid ${baseTheme.colors.gray[75]};
  padding: 2rem 1rem;
  transition: background-color 0.2s;

  border-radius: 0;
  &:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--color-green-75);
    color: var(--btn-icon-fg-hover);
    border-color: var(--color-green-300);
    box-shadow: var(--btn-icon-shadow-hover);
    border-radius: 6px;
  }
  color: var(--field-fg);
`

const chatbotLabelCss = css`
  padding: 5px 8px;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  max-width: calc(400px - 2.1rem);
  text-overflow: ellipsis;
  text-align: left;
  border: 1px solid ${baseTheme.colors.green[300]};
  border-radius: 999px;
  color: gray;
`

const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  conversations,
  chatbots,
  menuState,
  setConfigurationId,
}) => {
  const { t } = useTranslation()
  const { setConvId } = useChatbotContext()
  return (
    <div>
      {conversations.length === 0 ? (
        <div
          className={css`
            padding: 0 1rem;
          `}
        >
          <Infobox>{t("no-existing-conversations")}</Infobox>
        </div>
      ) : (
        conversations.map((conversation) => (
          <Button
            size="medium"
            variant="icon"
            onClick={() => {
              setConfigurationId(conversation.chatbot_configuration_id)
              setConvId(conversation.id)
              if (menuState) {
                menuState.close()
              }
            }}
            className={buttonCss}
            key={conversation.id}
            aria-label={t("select-conversation", { title: conversation.conversation_title })}
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
                  // 400px is the width of the sidebar
                  max-width: calc(400px - 2.1rem);
                  overflow: hidden;
                  text-overflow: ellipsis;
                  padding-bottom: 5px;
                `}
              >
                {conversation.conversation_title !== null
                  ? conversation.conversation_title
                  : t("untitled-conversation")}
              </div>
              <span className={chatbotLabelCss}>
                {
                  chatbots.find((chatbot) => chatbot.id === conversation.chatbot_configuration_id)
                    ?.chatbot_name
                }
              </span>
            </div>
          </Button>
        ))
      )}
    </div>
  )
}

export default ConversationHistory
