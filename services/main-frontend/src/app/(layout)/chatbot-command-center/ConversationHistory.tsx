"use client"

import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { Button } from "@/shared-module/components"

interface ConversationHistory {
  setConversationId: React.Dispatch<string>
  conversations: ChatbotConversation[]
  setValue: UseFormSetValue<ChatbotConfiguration>
  chatbots: ChatbotConfiguration[]
}

import { css } from "@emotion/css"
import type { UseFormSetValue } from "react-hook-form"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"

const ConversationHistory: React.FC<ConversationHistory> = ({
  setConversationId,
  conversations,
  setValue,
  chatbots,
}) => {
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
      `}
    >
      {conversations.map((conversation) => (
        <div key={conversation.id}>
          <Button
            size="medium"
            variant="icon"
            onClick={() => {
              setConversationId(conversation.id)
              setValue("id", conversation.chatbot_configuration_id, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }}
            className={css`
              font-size: 14px;
              font-weight: 500;
            `}
          >
            <div
              className={css`
                display: flex;
                flex-direction: column;
                align-items: flex-start;
              `}
            >
              <div
                className={css`
                  white-space: nowrap;
                  max-width: 250px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                `}
              >
                {conversation.conversation_title !== null
                  ? conversation.conversation_title
                  : // oxlint-disable-next-line i18next/no-literal-string
                    "untitled conversation"}
              </div>
              <span
                className={css`
                  padding-top: 0.25rem;
                  font-size: 10px;
                  white-space: nowrap;
                  width: 200px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  text-align: left;
                  border: 1px solid #8fb4b2;
                  border-radius: 999px;
                  color: gray;
                  max-width: 100px;
                  padding-left: 10px;
                  margin-top: 5px;
                  padding-bottom: 5px;
                `}
              >
                {
                  chatbots.find((chatbot) => chatbot.id === conversation.chatbot_configuration_id)
                    ?.chatbot_name
                }
              </span>
            </div>
          </Button>
        </div>
      ))}
    </div>
  )
}

export default ConversationHistory
