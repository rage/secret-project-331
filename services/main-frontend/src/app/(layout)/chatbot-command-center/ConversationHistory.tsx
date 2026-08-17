"use client"

import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { Button } from "@/shared-module/components"

interface ConversationHistory {
  setConversationId: React.Dispatch<string>
  conversations: ChatbotConversation[]
  newConversationMutation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
  setValue
}

import { css } from "@emotion/css"
import type { UseMutationResult } from "@tanstack/react-query"
import { AddMessage } from "@vectopus/atlas-icons-react"
import { useTranslation } from "react-i18next"

import AIChat from "@/img/course-material/ai-chat.svg"
import { baseTheme } from "@/shared-module/common/styles"

const ConversationHistory: React.FC<ConversationHistory> = ({
  setConversationId,
  conversations,
  newConversationMutation,
  setValue,
}) => {
  const { t } = useTranslation()

  return (
    <div>
      <Button
        className={css`
          padding-bottom: 1rem;
        `}
        icon={
          <AddMessage
            className={css`
              color: ${baseTheme.colors.green[700]};
            `}
          />
        }
        iconPosition="start"
        size="medium"
        variant="icon"
        onClick={() => newConversationMutation.mutate()}
      >
        {t("new-conversation")}
      </Button>
      {conversations.map((conversation) => (
        <div key={conversation.id}>
          <Button
            icon={<AIChat></AIChat>}
            iconPosition="start"
            size="medium"
            variant="icon"
            onClick={() => {
              setConversationId(conversation.id)
              setValue("id", conversation.chatbot_configuration_id, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }}
          >
            {conversation.created_at}
          </Button>
        </div>
      ))}
    </div>
  )
}

export default ConversationHistory
