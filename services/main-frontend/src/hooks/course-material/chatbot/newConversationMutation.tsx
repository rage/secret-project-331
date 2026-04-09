"use client"

import { UseQueryResult } from "@tanstack/react-query"

import { newChatbotConversation } from "@/generated/course-material-api/sdk.generated"
import type {
  ChatbotConversation,
  ChatbotConversationInfo,
} from "@/generated/course-material-api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

const useNewConversationMutation = (
  chatbotConfigurationId: string,
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>,
  setNewMessage: React.Dispatch<React.SetStateAction<string>>,
  setError: React.Dispatch<React.SetStateAction<Error | null>>,
) => {
  return useToastMutation(
    () =>
      newChatbotConversation({
        path: {
          chatbot_configuration_id: chatbotConfigurationId,
        },
        throwOnError: true,
      }),
    { notify: false },
    {
      onSuccess: () => {
        currentConversationInfo.refetch()
        setNewMessage("")
        setError(null) // Clear any existing errors when starting a new conversation
      },
    },
  )
}

export default useNewConversationMutation
