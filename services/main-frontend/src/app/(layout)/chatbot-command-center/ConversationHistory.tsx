"use client"

import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { Button } from "@/shared-module/components"

interface ConversationHistory {
  setConversationId: React.Dispatch<string>
  conversations: ChatbotConversation[]
  setConfigurationId: React.Dispatch<string>
  chatbots: ChatbotConfiguration[]
}

import { css } from "@emotion/css"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

const ConversationHistory: React.FC<ConversationHistory> = ({
  setConversationId,
  conversations,
  setConfigurationId,
  chatbots,
}) => {
  return (
    <>
      {conversations.map((conversation) => (
        <Button
          size="medium"
          variant="icon"
          onClick={() => {
            setConversationId(conversation.id)
            setConfigurationId(conversation.chatbot_configuration_id)
          }}
          className={css`
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
          `}
          key={conversation.id}
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
                max-width: 300px;
                overflow: hidden;
                text-overflow: ellipsis;
                padding-bottom: 5px;
              `}
            >
              {conversation.conversation_title !== null
                ? conversation.conversation_title
                : // oxlint-disable-next-line i18next/no-literal-string
                  "untitled conversation"}
            </div>
            <span
              className={css`
                padding: 5px 8px;
                font-size: 10px;
                white-space: nowrap;
                width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                text-align: left;
                border: 1px solid ${baseTheme.colors.green[300]};
                border-radius: 999px;
                color: gray;
                max-width: 100px;
              `}
            >
              {
                chatbots.find((chatbot) => chatbot.id === conversation.chatbot_configuration_id)
                  ?.chatbot_name
              }
            </span>
          </div>
        </Button>
      ))}
    </>
  )
}

export default ConversationHistory
