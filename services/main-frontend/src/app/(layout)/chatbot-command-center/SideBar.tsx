"use client"

import { css } from "@emotion/css"
import { useQuery, type UseMutationResult } from "@tanstack/react-query"
import { AddMessage } from "@vectopus/atlas-icons-react"
import type React from "react"
import type { UseFormSetValue } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import {
  allFirstMessagesOptions,
  allUserConversationsOptions,
} from "@/generated/course-material-api/@tanstack/react-query.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, QueryResults } from "@/shared-module/components"

import ConversationHistory from "./ConversationHistory"

interface SideBarProps {
  newConversationMutation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
  setConversationId: React.Dispatch<string>
  setValue: UseFormSetValue<ChatbotConfiguration>
  chatbots
}

const SideBar: React.FC<SideBarProps> = ({
  newConversationMutation,
  setConversationId,
  setValue,
  chatbots,
}) => {
  const { t } = useTranslation()

  const allConversationsQuery = useQuery(allUserConversationsOptions())
  const messageQuery = useQuery(allFirstMessagesOptions())
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
        // oxlint-disable-next-line i18next/no-literal-string
        iconPosition="start"
        size="medium"
        variant="icon"
        onClick={() => newConversationMutation.mutate()}
      >
        {t("new-conversation")}
      </Button>
      <QueryResults
        queries={[allConversationsQuery, messageQuery] as const}
        renderData={([conversations, messages]) => (
          <ConversationHistory
            conversations={conversations}
            messages={messages}
            setConversationId={setConversationId}
            setValue={setValue}
            chatbots={chatbots}
          />
        )}
      />
    </div>
  )
}

export default SideBar
