"use client"

import { css } from "@emotion/css"
import { useQuery, type UseMutationResult } from "@tanstack/react-query"
import { AddMessage } from "@vectopus/atlas-icons-react"
import type React from "react"
import type { UseFormSetValue } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import { allUserConversationsOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, QueryResult } from "@/shared-module/components"

import ConversationHistory from "./ConversationHistory"

interface SideBarProps {
  newConversationMutation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
  setConversationId: React.Dispatch<string>
  setValue: UseFormSetValue<ChatbotConfiguration>
}

const SideBar: React.FC<SideBarProps> = ({
  newConversationMutation,
  setConversationId,
  setValue,
}) => {
  const { t } = useTranslation()

  const allConversationsQuery = useQuery(allUserConversationsOptions())

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
      <QueryResult query={allConversationsQuery}>
        {(conversations) => (
          <ConversationHistory
            conversations={conversations}
            setConversationId={setConversationId}
            setValue={setValue}
          />
        )}
      </QueryResult>
    </div>
  )
}

export default SideBar
