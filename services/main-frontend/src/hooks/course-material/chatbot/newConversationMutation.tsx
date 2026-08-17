"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useContext } from "react"

import ConversationIdContext from "@/contexts/course-material/ConversationIdContext"
import {
  getCurrentConversationIdQueryKey,
  allUserConversationsQueryKey,
} from "@/generated/course-material-api/@tanstack/react-query.generated"
import { newChatbotConversation } from "@/generated/course-material-api/sdk.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { saveChatbotAnonymousToken } from "@/utils/anonymousTokenLocalStorage"

const useNewConversationMutation = (
  chatbotConfigurationId: string,
  setNewMessage: React.Dispatch<React.SetStateAction<string>>,
  setError: React.Dispatch<React.SetStateAction<Error | null>>,
) => {
  const setConversationId = useContext(ConversationIdContext)

  const queryClient = useQueryClient()
  return useToastMutation(
    () =>
      newChatbotConversation({
        path: {
          chatbot_configuration_id: chatbotConfigurationId,
        },
      }),
    { notify: false },
    {
      onSuccess: (res) => {
        const anonymousToken = res.anonymous_token
        saveChatbotAnonymousToken(anonymousToken)
        queryClient.refetchQueries({
          queryKey: getCurrentConversationIdQueryKey({
            path: {
              chatbot_configuration_id: chatbotConfigurationId,
            },
          }),
        })
        queryClient.refetchQueries({
          queryKey: allUserConversationsQueryKey({
            path: {
              chatbot_configuration_id: chatbotConfigurationId,
            },
          }),
        })
        setNewMessage("")
        setConversationId && setConversationId(null)
        setError(null) // Clear any existing errors when starting a new conversation
      },
    },
  )
}

export default useNewConversationMutation
